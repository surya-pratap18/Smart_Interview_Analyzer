"""
POST /api/analyze
──────────────────
Main analysis endpoint. Accepts audio/video file + optional camera frames.

Pipeline:
  1. Save uploaded file
  2. Transcribe (Whisper via librosa)
  3. Process camera frames for emotion (if provided)
  4. Vision analysis on video file (if MP4 with face)
  5. NLP analysis (sentiment, fillers, keywords, clarity, score, feedback)
  6. Translation (if target_language provided)
  7. Generate subtitles (SRT + VTT)
  8. Save to database
  9. Return full result
"""

import os
import uuid
import json
import base64
import traceback
import numpy as np
import cv2
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

from services.transcription import transcribe
from services.nlp_analysis   import analyze_full
from services.vision         import (
    analyze_video, analyze_frame_live,
    _default_vision_result, EMOTION_LIST
)
from services.translation    import (
    translate_text, translate_segments,
    generate_srt, generate_vtt,
    SUPPORTED_LANGUAGES
)
from services.database import save_interview

analyze_bp = Blueprint("analyze", __name__)

ALLOWED_EXTENSIONS = {
    "wav", "mp3", "mp4", "mov", "avi",
    "webm", "ogg", "m4a", "mkv"
}
VIDEO_EXTENSIONS = {"mp4", "mov", "avi", "mkv"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def is_video(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in VIDEO_EXTENSIONS


# ── Process camera frames sent from browser ───────────────────────────────────

def process_camera_frames(frames_b64: list) -> dict:
    """
    Analyze base64-encoded JPEG frames captured from browser camera.
    Runs your trained emotion CNN + eye contact + posture on each frame.

    Args:
        frames_b64: List of base64 JPEG strings from browser canvas

    Returns:
        emotion_summary, emotion_timeline, posture_summary, eye_contact_score
    """
    from services.vision import detect_face_and_emotion, detect_eye_contact, detect_posture

    print(f"😊 [Frames] Processing {len(frames_b64)} camera frames...")

    emotion_timeline  = []
    posture_counts    = {"good": 0, "leaning": 0, "slouching": 0, "unknown": 0}
    eye_contact_count = 0
    total             = len(frames_b64)
    duration_estimate = total * 2   # 1 frame every 2 seconds

    for i, b64_str in enumerate(frames_b64):
        try:
            # Decode base64 → numpy array → BGR image
            if ',' in b64_str:
                b64_str = b64_str.split(',')[1]

            img_bytes = base64.b64decode(b64_str)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            frame     = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            timestamp = i * 2.0   # 1 frame per 2 seconds

            # Run emotion detection using your trained CNN
            er = detect_face_and_emotion(frame)
            if er["face_detected"]:
                emotion_timeline.append({
                    "t": timestamp,
                    **er["emotions"]
                })

            # Eye contact
            gr = detect_eye_contact(frame)
            if gr["eye_contact"]:
                eye_contact_count += 1

            # Posture
            pr = detect_posture(frame)
            posture_counts[pr["posture"]] += 1

            print(f"   Frame {i+1}/{total}: face={'✓' if er['face_detected'] else '✗'} "
                  f"emotion={er['dominant']} eye={'✓' if gr['eye_contact'] else '✗'}", end="\r")

        except Exception as e:
            print(f"   Frame {i+1} error: {e}")
            continue

    print(f"\n✅ [Frames] Done — {len(emotion_timeline)} faces detected out of {total} frames")

    # Aggregate emotion summary
    emotion_summary = {}
    if emotion_timeline:
        for em in EMOTION_LIST:
            vals = [f.get(em, 0) for f in emotion_timeline]
            emotion_summary[em] = round(sum(vals) / len(vals), 1)
    else:
        emotion_summary = {e: 0 for e in EMOTION_LIST}

    # Posture summary
    posture_summary = {
        k: round(posture_counts.get(k, 0) / max(total, 1) * 100)
        for k in ["good", "leaning", "slouching"]
    }

    eye_contact_score = round((eye_contact_count / max(total, 1)) * 100)

    print(f"   Dominant emotion: {max(emotion_summary, key=emotion_summary.get) if emotion_summary else 'N/A'}")
    print(f"   Eye contact: {eye_contact_score}%")
    print(f"   Posture - good: {posture_summary['good']}% leaning: {posture_summary['leaning']}%")

    return {
        "emotion_timeline":  emotion_timeline,
        "emotion_summary":   emotion_summary,
        "posture_summary":   posture_summary,
        "eye_contact_score": eye_contact_score,
        "vision_available":  True,
    }


# ── Main route ────────────────────────────────────────────────────────────────

@analyze_bp.route("/analyze", methods=["POST"])
def analyze():
    """
    Accepts multipart/form-data:
      file:           audio or video file (required)
      target_language: ISO language code for translation (optional)
      run_vision:     'true' | 'false'
      camera_frames:  JSON array of base64 JPEG strings from browser camera
      frames_count:   number of frames captured
    """

    # ── Validate file ──
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400

    file = request.files["file"]
    if not file.filename or not allowed_file(file.filename):
        return jsonify({
            "error": f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        }), 400

    target_language  = request.form.get("target_language", "").strip() or None
    run_vision_str   = request.form.get("run_vision", "false").lower()
    run_vision       = run_vision_str == "true"
    camera_frames_str = request.form.get("camera_frames", "")
    frames_count     = int(request.form.get("frames_count", 0))

    session_id = str(uuid.uuid4())
    filename   = secure_filename(file.filename)
    filepath   = os.path.join(current_app.config["UPLOAD_FOLDER"], f"{session_id}_{filename}")

    file.save(filepath)

    print(f"\n{'='*60}")
    print(f"🆕 Session: {session_id}")
    print(f"📄 File:    {filename}")
    print(f"🌍 Target:  {target_language or 'none'}")
    print(f"📸 Frames:  {frames_count} camera frames")
    print(f"{'='*60}")

    try:
        # ── Step 1: Transcription ──────────────────────────────────────────
        trans = transcribe(filepath)
        transcript    = trans["text"]
        language      = trans["language"]
        language_name = trans["language_name"]
        segments      = trans["segments"]
        duration      = trans["duration"]

        # ── Step 2: Vision analysis ────────────────────────────────────────────────
        vision_result = None
        file_size_mb  = os.path.getsize(filepath) / (1024 * 1024)

        # Priority 1: Browser camera frames (from live recording)
        if camera_frames_str and frames_count > 0:
            try:
                camera_frames = json.loads(camera_frames_str)
                if camera_frames:
                    print(f"📸 [Pipeline] Processing {len(camera_frames)} browser camera frames...")
                    vision_result = process_camera_frames(camera_frames)
            except Exception as e:
                print(f"⚠️  [Pipeline] Camera frames error: {e}")

        # Priority 2: MP4/MOV/AVI video file — always run vision
        if vision_result is None and is_video(filename):
            print(f"📹 [Pipeline] Running vision on: {filename} ({file_size_mb:.1f} MB)")
            try:
                vision_result = analyze_video(filepath, sample_interval=5.0)
                if vision_result and vision_result.get("vision_available"):
                    print(f"✅ [Pipeline] Vision complete")
                else:
                    print(f"⚠️  [Pipeline] Vision returned no data")
                    vision_result = None
            except Exception as e:
                print(f"❌ [Pipeline] Vision error: {e}")
                vision_result = None

        # Skip vision
        if vision_result is None:
            print(f"⏭️  [Pipeline] Skipping vision — audio file")
            
        # Extract vision signals for scoring
        emotion_summary   = vision_result.get("emotion_summary")   if vision_result else None
        eye_contact_score = vision_result.get("eye_contact_score") if vision_result else None

        # ── Step 3: NLP analysis ───────────────────────────────────────────
        analysis = analyze_full(
            transcript   = transcript,
            duration     = duration,
            emotion      = emotion_summary,
            eye_contact  = eye_contact_score,
        )

        # ── Step 4: Translation ────────────────────────────────────────────
        translated_transcript = None
        translated_segments   = segments

        if target_language and target_language != language:
            lang_name = SUPPORTED_LANGUAGES.get(target_language, target_language)
            print(f"🌍 [Pipeline] Translating to {lang_name}...")
            try:
                translated_transcript = translate_text(
                    transcript, target_language, source_lang=language
                )
                translated_segments = translate_segments(
                    segments, target_language, source_lang=language
                )

                if translated_transcript.strip() == transcript.strip():
                    print("⚠️  [Pipeline] Translation returned same text — may have failed")
                    translated_transcript = None
                else:
                    print(f"✅ [Pipeline] Translation successful")
                    print(f"   Original  : {transcript[:80]}")
                    print(f"   Translated: {translated_transcript[:80]}")
                    print(f"🌍 Translation preview: {translated_transcript[:80]}")

            except Exception as e:
                print(f"❌ [Pipeline] Translation error: {e}")
                translated_transcript = None
                translated_segments   = segments

        # ── Step 5: Subtitles ──────────────────────────────────────────────
        display_segments = translated_segments if translated_transcript else segments
        srt = generate_srt(display_segments)
        vtt = generate_vtt(display_segments)

        # ── Step 6: Build response ─────────────────────────────────────────
        response = {
            "session_id":            session_id,
            "filename":              filename,
            "language":              language,
            "language_name":         language_name,
            "duration":              duration,
            "transcript":            transcript,
            "translated_transcript": translated_transcript,
            "target_language":       target_language,
            "target_language_name":  SUPPORTED_LANGUAGES.get(target_language) if target_language else None,
            "segments":              display_segments,
            "subtitles":             {"srt": srt, "vtt": vtt},
            "sentiment":             analysis["sentiment"],
            "fillers":               analysis["fillers"],
            "keywords":              analysis["keywords"],
            "clarity":               analysis["clarity"],
            "score":                 analysis["score"],
            "feedback":              analysis["feedback"],
            "emotion_summary":       vision_result.get("emotion_summary")   if vision_result else None,
            "emotion_timeline":      vision_result.get("emotion_timeline")  if vision_result else [],
            "posture_summary":       vision_result.get("posture_summary")   if vision_result else None,
            "eye_contact_score":     vision_result.get("eye_contact_score") if vision_result else None,
            "hand_summary":          vision_result.get("hand_summary")      if vision_result else None,
            "overall_score":         analysis["score"]["overall"],
        }

        # ── Step 7: Save to database ───────────────────────────────────────
        save_interview({
            **response,
            "score_breakdown": analysis["score"]["breakdown"],
        })

        print(f"✅ [Pipeline] Done — Score: {response['overall_score']}/100\n")
        return jsonify(response), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        if os.path.exists(filepath):
            os.remove(filepath)
            print(f"🗑️  Cleaned up: {filepath}")


@analyze_bp.route("/languages", methods=["GET"])
def get_languages():
    """Return all supported translation languages."""
    return jsonify({
        "languages": [
            {"code": code, "name": name}
            for code, name in SUPPORTED_LANGUAGES.items()
        ]
    })