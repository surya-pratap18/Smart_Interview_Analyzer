"""
Real-Time WebSocket Handler (Flask-SocketIO)
─────────────────────────────────────────────
Handles live interview session:
  - Receives video frames from browser every ~1 second
  - Runs fast emotion + gaze detection per frame
  - Fires alerts back to browser in real-time
  - Accumulates data for final report

Events (browser → server):
  join_session    — start a new live session
  video_frame     — base64 encoded frame from webcam
  audio_chunk     — partial audio for live filler detection
  leave_session   — session ended, return summary

Events (server → browser):
  frame_result    — emotion + gaze result for this frame
  alert           — real-time alert (filler, posture, etc.)
  session_summary — aggregated results when session ends
"""

import base64
import time
import numpy as np
import cv2
from flask import request
from flask_socketio import SocketIO, emit, join_room, leave_room

from services.vision  import analyze_frame_live
from services.alerts  import check_all_alerts, reset_cooldowns

# In-memory session store (resets if server restarts)
# For production: use Redis
_sessions: dict = {}


def register_socketio(socketio: SocketIO):
    """Register all WebSocket event handlers on the SocketIO instance."""

    @socketio.on("join_session")
    def handle_join(data):
        session_id = data.get("session_id", request.sid)
        join_room(session_id)
        reset_cooldowns()

        _sessions[session_id] = {
            "start_time":      time.time(),
            "frames_processed": 0,
            "frames_away":     0,
            "emotion_history": [],
            "alerts_fired":    [],
            "last_posture":    "good",
        }

        emit("joined", {"session_id": session_id, "status": "ready"})
        print(f"🔌 [WS] Session started: {session_id}")


    @socketio.on("video_frame")
    def handle_frame(data):
        """
        Receive a base64 encoded video frame from the browser.
        Run fast emotion + gaze detection and return results.
        """
        session_id = data.get("session_id", request.sid)
        b64_frame  = data.get("frame")
        timestamp  = data.get("timestamp", 0.0)

        if not b64_frame:
            return

        try:
            # Decode base64 → numpy array
            img_bytes = base64.b64decode(b64_frame)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            frame     = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            if frame is None:
                return

            # Run fast vision analysis
            result = analyze_frame_live(frame)

            # Update session state
            session = _sessions.get(session_id, {})
            session["frames_processed"] = session.get("frames_processed", 0) + 1

            if not result.get("eye_contact"):
                session["frames_away"] = session.get("frames_away", 0) + 1
            else:
                session["frames_away"] = 0

            if result.get("emotions"):
                session["emotion_history"].append(result["emotions"])

            # Check alerts
            alerts = check_all_alerts(
                current_time = timestamp,
                emotions     = result.get("emotions"),
                eye_contact  = result.get("eye_contact"),
                posture      = session.get("last_posture", "good"),
                frames_away  = session.get("frames_away", 0),
            )

            for alert in alerts:
                session["alerts_fired"].append(alert)
                emit("alert", alert, room=session_id)

            _sessions[session_id] = session

            # Send frame result back
            emit("frame_result", {
                "timestamp":    timestamp,
                "emotions":     result.get("emotions", {}),
                "dominant":     result.get("dominant", "neutral"),
                "eye_contact":  result.get("eye_contact", False),
                "gaze":         result.get("gaze", "unknown"),
                "face_detected":result.get("face_detected", False),
            })

        except Exception as e:
            print(f"❌ [WS] Frame error: {e}")


    @socketio.on("leave_session")
    def handle_leave(data):
        session_id = data.get("session_id", request.sid)
        session    = _sessions.pop(session_id, {})

        # Aggregate emotion history
        emotion_history = session.get("emotion_history", [])
        if emotion_history:
            keys = emotion_history[0].keys()
            emotion_summary = {
                k: round(sum(f.get(k, 0) for f in emotion_history) / len(emotion_history), 1)
                for k in keys
            }
        else:
            emotion_summary = {}

        summary = {
            "session_id":      session_id,
            "frames_processed":session.get("frames_processed", 0),
            "emotion_summary": emotion_summary,
            "alerts_fired":    session.get("alerts_fired", []),
            "duration":        time.time() - session.get("start_time", time.time()),
        }

        emit("session_summary", summary)
        leave_room(session_id)
        print(f"🔌 [WS] Session ended: {session_id} ({summary['frames_processed']} frames)")


# ── Translate route (separate blueprint) ──────────────────────────────────────
from flask import Blueprint
from services.translation import translate_text, translate_segments, generate_srt, generate_vtt

translate_bp = Blueprint("translate", __name__)

@translate_bp.route("/translate", methods=["POST"])
def translate():
    """On-demand translation of existing transcript."""
    from flask import request
    body = request.get_json()
    if not body:
        return {"error": "JSON body required"}, 400

    text        = body.get("text", "")
    segments    = body.get("segments", [])
    target_lang = body.get("target_language")
    source_lang = body.get("source_language", "auto")

    if not target_lang:
        return {"error": "target_language is required"}, 400

    try:
        translated_text = translate_text(text, target_lang, source_lang) if text else None
        translated_segs = translate_segments(segments, target_lang, source_lang) if segments else []
        return {
            "translated_text":     translated_text,
            "translated_segments": translated_segs,
            "srt":                 generate_srt(translated_segs),
            "vtt":                 generate_vtt(translated_segs),
        }
    except Exception as e:
        return {"error": str(e)}, 500
