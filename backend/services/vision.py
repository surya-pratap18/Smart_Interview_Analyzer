"""
Vision Analysis Service
────────────────────────
Uses your custom trained models:
  - emotion_model.h5   → CNN trained on FER2013
  - gesture_model.pkl  → Gradient Boosting trained on your hand photos

Also uses OpenCV Haar cascades for face/eye detection.
Falls back gracefully if anything is unavailable.
"""

import os
import json
import threading
import numpy as np
import cv2

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR           = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR         = os.path.join(BASE_DIR, "models")
EMOTION_MODEL_PATH = os.path.join(MODELS_DIR, "emotion_model.h5")
GESTURE_MODEL_PATH = os.path.join(MODELS_DIR, "gesture_model.pkl")
LABELS_PATH        = os.path.join(MODELS_DIR, "emotion_labels.json")

# ── Emotion labels ────────────────────────────────────────────────────────────
DEFAULT_EMOTION_LABELS = {
    "0": "angry",   "1": "disgust", "2": "fear",
    "3": "happy",   "4": "neutral", "5": "sad", "6": "surprise"
}

def load_emotion_labels() -> dict:
    if os.path.exists(LABELS_PATH):
        with open(LABELS_PATH, "r") as f:
            return json.load(f)
    return DEFAULT_EMOTION_LABELS

EMOTION_LABELS = load_emotion_labels()
EMOTION_LIST   = [EMOTION_LABELS[str(i)] for i in range(len(EMOTION_LABELS))]

# ── TensorFlow availability ───────────────────────────────────────────────────
TF_AVAILABLE = False
try:
    import tensorflow as tf
    TF_AVAILABLE = True
    print("✅ [Vision] TensorFlow available")
except Exception as e:
    print(f"⚠️  [Vision] TensorFlow not available: {e}")

# ── Cached models ─────────────────────────────────────────────────────────────
_emotion_model   = None
_gesture_model   = None
_gesture_classes = None


def get_emotion_model():
    """Load and cache the trained CNN emotion model."""
    global _emotion_model
    if _emotion_model is None and TF_AVAILABLE:
        if os.path.exists(EMOTION_MODEL_PATH):
            try:
                _emotion_model = tf.keras.models.load_model(EMOTION_MODEL_PATH)
                print("✅ [Vision] Emotion model loaded")
            except Exception as e:
                print(f"❌ [Vision] Emotion model load failed: {e}")
        else:
            print(f"⚠️  [Vision] emotion_model.h5 not found in {MODELS_DIR}")
    return _emotion_model


def get_gesture_model():
    """Load and cache the trained gesture classifier."""
    global _gesture_model, _gesture_classes
    if _gesture_model is None:
        if os.path.exists(GESTURE_MODEL_PATH):
            try:
                import pickle
                with open(GESTURE_MODEL_PATH, "rb") as f:
                    data = pickle.load(f)
                _gesture_model   = data["model"]
                _gesture_classes = data["classes"]
                print(f"✅ [Vision] Gesture model loaded: {_gesture_classes}")
            except Exception as e:
                print(f"❌ [Vision] Gesture model load failed: {e}")
        else:
            print(f"⚠️  [Vision] gesture_model.pkl not found in {MODELS_DIR}")
    return _gesture_model, _gesture_classes


# ── Haar cascade loader ───────────────────────────────────────────────────────
def _get_cascade(filename: str):
    """
    Load a Haar cascade XML file.
    Tries multiple locations to handle different OpenCV versions.
    """
    # Try 1: standard cv2.data location
    try:
        path = os.path.join(cv2.data.haarcascades, filename)
        if os.path.exists(path):
            cascade = cv2.CascadeClassifier(path)
            if not cascade.empty():
                return cascade
    except Exception:
        pass

    # Try 2: search inside cv2 package directory
    try:
        import cv2 as _cv2
        pkg_dir = os.path.dirname(_cv2.__file__)
        for root, dirs, files in os.walk(pkg_dir):
            if filename in files:
                path    = os.path.join(root, filename)
                cascade = cv2.CascadeClassifier(path)
                if not cascade.empty():
                    return cascade
    except Exception:
        pass

    # Try 3: local cascades folder in backend
    local_path = os.path.join(BASE_DIR, "cascades", filename)
    if os.path.exists(local_path):
        cascade = cv2.CascadeClassifier(local_path)
        if not cascade.empty():
            return cascade

    print(f"⚠️  [Vision] Cascade not found: {filename}")
    return None


# ── Emotion detection ─────────────────────────────────────────────────────────

def detect_face_and_emotion(frame_bgr: np.ndarray) -> dict:
    """
    Detect face using Haar cascade then run your emotion CNN on it.
    Returns emotion scores, dominant emotion, and face bounding box.
    """
    default = {
        "emotions":      {e: 0 for e in EMOTION_LIST},
        "dominant":      "neutral",
        "confidence":    0,
        "face_detected": False,
        "face_box":      None,
    }

    try:
        face_cascade = _get_cascade("haarcascade_frontalface_default.xml")
        if face_cascade is None:
            return default

        gray  = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        h, w  = frame_bgr.shape[:2]
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )

        if len(faces) == 0:
            return default

        # Use the largest detected face
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        face_roi     = frame_bgr[y:y+fh, x:x+fw]

        # Run CNN emotion model
        model = get_emotion_model()
        if model is None:
            return {**default, "face_detected": True}

        # Preprocess face: grayscale → 48x48 → normalize → batch
        face_gray   = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
        face_resized = cv2.resize(face_gray, (48, 48))
        face_norm   = face_resized.astype(np.float32) / 255.0
        face_input  = face_norm.reshape(1, 48, 48, 1)

        # Predict emotions
        preds    = model.predict(face_input, verbose=0)[0]
        emotions = {
            EMOTION_LIST[i]: round(float(preds[i]) * 100, 1)
            for i in range(len(EMOTION_LIST))
        }
        dominant   = max(emotions, key=emotions.get)
        confidence = emotions[dominant]

        return {
            "emotions":      emotions,
            "dominant":      dominant,
            "confidence":    confidence,
            "face_detected": True,
            "face_box": {
                "x_pct": round(x  / w  * 100, 1),
                "y_pct": round(y  / h  * 100, 1),
                "w_pct": round(fw / w  * 100, 1),
                "h_pct": round(fh / h  * 100, 1),
            }
        }

    except Exception as e:
        print(f"❌ [Vision] Emotion detection error: {e}")
        return default


# ── Eye contact detection ─────────────────────────────────────────────────────

def detect_eye_contact(frame_bgr: np.ndarray) -> dict:
    """
    Estimate eye contact using OpenCV eye detection.
    Returns whether the person appears to be looking at the camera.
    """
    try:
        eye_cascade = _get_cascade("haarcascade_eye.xml")
        if eye_cascade is None:
            return {"eye_contact": False, "gaze": "unknown"}

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        h, w = frame_bgr.shape[:2]
        eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)

        if len(eyes) == 0:
            return {"eye_contact": False, "gaze": "away"}

        center_x = w / 2
        for (ex, ey, ew, eh) in eyes:
            eye_center_x = ex + ew / 2
            # Eye within 35% of horizontal center → looking at camera
            if abs(eye_center_x - center_x) < w * 0.35:
                return {"eye_contact": True, "gaze": "center"}

        return {"eye_contact": False, "gaze": "side"}

    except Exception as e:
        return {"eye_contact": False, "gaze": "unknown"}


# ── Posture detection ─────────────────────────────────────────────────────────

def detect_posture(frame_bgr: np.ndarray) -> dict:
    """
    Simple posture detection using face position in the frame.
    Good posture = face centered and in upper portion.
    """
    try:
        face_cascade = _get_cascade("haarcascade_frontalface_default.xml")
        if face_cascade is None:
            return {"posture": "unknown", "body_visible": False}

        gray  = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        h, w  = frame_bgr.shape[:2]
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )

        if len(faces) == 0:
            return {"posture": "unknown", "body_visible": False}

        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        face_cx      = x + fw / 2
        face_cy      = y + fh / 2

        # Horizontal lean check
        lean         = abs(face_cx - w / 2) / w

        # Vertical position check (face should be in upper 60% of frame)
        vertical     = face_cy / h

        if lean > 0.25:
            posture = "leaning"
        elif vertical > 0.65:
            posture = "slouching"
        else:
            posture = "good"

        return {"posture": posture, "body_visible": True}

    except Exception as e:
        return {"posture": "unknown", "body_visible": False}


# ── Frame extraction ──────────────────────────────────────────────────────────

def extract_frames(video_path: str, sample_every_n_seconds: float = 5.0) -> list:
    MAX_FRAMES = 20
    try:
        print(f"   Opening video: {os.path.basename(video_path)}")
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            print(f"   ❌ Cannot open video file")
            return []

        fps          = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration     = total_frames / fps if fps > 0 else 0

        print(f"   Video info: {fps:.1f} fps, {total_frames} frames, {duration:.1f}s")

        if fps == 0 or total_frames == 0:
            print(f"   ❌ Invalid video metadata — fps={fps} frames={total_frames}")
            cap.release()
            return []

        # ... rest of function

        # Adjust interval to get at most MAX_FRAMES
        if duration > 0:
            min_interval = duration / MAX_FRAMES
            sample_every_n_seconds = max(sample_every_n_seconds, min_interval)

        frame_interval = max(1, int(fps * sample_every_n_seconds))
        frames         = []
        idx            = 0

        while cap.isOpened() and len(frames) < MAX_FRAMES:
            ret, frame = cap.read()
            if not ret:
                break
            if idx % frame_interval == 0:
                frames.append((round(idx / fps, 2), frame))
            idx += 1

        cap.release()
        print(f"📹 [Vision] Extracted {len(frames)} frames "
              f"(duration: {duration:.1f}s, interval: {sample_every_n_seconds:.1f}s)")
        return frames

    except Exception as e:
        print(f"❌ [Vision] Frame extraction error: {e}")
        return []


# ── Internal video analysis ───────────────────────────────────────────────────

def _analyze_video_internal(video_path: str, sample_interval: float = 5.0) -> dict:
    """Core video analysis — runs emotion, eye contact, and posture per frame."""
    print(f"👁️  [Vision] Analyzing: {os.path.basename(video_path)}")
    frames = extract_frames(video_path, sample_interval)

    if not frames:
        return _default_vision_result()

    emotion_timeline  = []
    posture_counts    = {"good": 0, "leaning": 0, "slouching": 0, "unknown": 0}
    eye_contact_count = 0
    total             = len(frames)

    for i, (timestamp, frame) in enumerate(frames):
        print(f"   Analyzing frame {i+1}/{total} @ {timestamp:.1f}s", end="\r")

        # Emotion
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

    print(f"\n✅ [Vision] Done — {total} frames analyzed")

    # Aggregate emotions
    emotion_summary = {}
    if emotion_timeline:
        for emotion in EMOTION_LIST:
            vals = [f.get(emotion, 0) for f in emotion_timeline]
            emotion_summary[emotion] = round(sum(vals) / len(vals), 1)
    else:
        emotion_summary = {e: 0 for e in EMOTION_LIST}

    # Posture as percentages
    posture_summary = {
        k: round(posture_counts.get(k, 0) / max(total, 1) * 100)
        for k in ["good", "leaning", "slouching"]
    }

    eye_contact_score = round((eye_contact_count / max(total, 1)) * 100)

    return {
        "emotion_timeline":  emotion_timeline,
        "emotion_summary":   emotion_summary,
        "posture_summary":   posture_summary,
        "eye_contact_score": eye_contact_score,
        "gaze_timeline":     [],
        "hand_summary":      {},
        "vision_available":  True,
    }


# ── Public analyze_video with 60s timeout ────────────────────────────────────

def analyze_video(video_path: str, sample_interval: float = 5.0) -> dict:
    """
    Run full vision analysis with a 60-second timeout.
    Returns default empty result if it takes too long.
    """
    result_holder = [None]
    error_holder  = [None]

    def run():
        try:
            result_holder[0] = _analyze_video_internal(video_path, sample_interval)
        except Exception as e:
            error_holder[0] = e

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    thread.join(timeout=60)

    if thread.is_alive():
        print("⚠️  [Vision] Analysis timed out after 60s — skipping")
        return _default_vision_result()

    if error_holder[0]:
        print(f"❌ [Vision] Analysis error: {error_holder[0]}")
        return _default_vision_result()

    return result_holder[0] or _default_vision_result()


# ── Real-time single frame for WebSocket ─────────────────────────────────────

def analyze_frame_live(frame_bgr: np.ndarray) -> dict:
    """
    Fast single-frame analysis for real-time WebSocket feedback.
    Called ~1x per second during live recording.
    """
    er = detect_face_and_emotion(frame_bgr)
    gr = detect_eye_contact(frame_bgr)
    pr = detect_posture(frame_bgr)

    return {
        "emotions":      er["emotions"],
        "dominant":      er["dominant"],
        "confidence":    er["confidence"],
        "face_detected": er["face_detected"],
        "face_box":      er.get("face_box"),
        "eye_contact":   gr["eye_contact"],
        "gaze":          gr["gaze"],
        "posture":       pr["posture"],
    }


# ── Default empty result ──────────────────────────────────────────────────────

def _default_vision_result() -> dict:
    """Return empty vision result when analysis fails or is skipped."""
    return {
        "emotion_timeline":  [],
        "emotion_summary":   {e: 0 for e in EMOTION_LIST},
        "posture_summary":   {"good": 0, "leaning": 0, "slouching": 0},
        "eye_contact_score": 0,
        "gaze_timeline":     [],
        "hand_summary":      {},
        "vision_available":  False,
    }