"""
╔══════════════════════════════════════════════════════════════╗
║   Smart Interview Analyzer — Gesture Classifier Training     ║
║   Run this on Google Colab (free GPU)                        ║
║                                                              ║
║   Steps:                                                     ║
║     1. Upload this file to Colab                             ║
║     2. Run each section in order                             ║
║     3. Download gesture_model.pkl at the end                 ║
║     4. Place in backend/models/ folder                       ║
╚══════════════════════════════════════════════════════════════╝

SECTION 1 — Install dependencies (run first in Colab)
!pip install mediapipe opencv-python scikit-learn numpy matplotlib
"""

# ════════════════════════════════════════════════════════════════
# SECTION 2 — Data Collection
# Run your webcam, record landmarks for each gesture class
# ════════════════════════════════════════════════════════════════

import cv2
import numpy as np
import mediapipe as mp
import os
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import matplotlib.pyplot as plt

mp_hands    = mp.solutions.hands
mp_drawing  = mp.solutions.drawing_utils

# ── Gesture classes to train ──────────────────────────────────────────────────
# Add or remove classes based on what you want to detect
GESTURE_CLASSES = [
    "open_palm",        # Relaxed, confident — good for interview
    "pointing",         # Assertive, emphasis gesture
    "thumbs_up",        # Positive signal
    "nervous_fidget",   # Touching face, rubbing hands
    "crossed_arms",     # Defensive (detected via pose rather than hands)
    "neutral_hands",    # Hands at rest, not doing anything specific
]

print(f"Training gesture classifier for {len(GESTURE_CLASSES)} classes:")
for i, g in enumerate(GESTURE_CLASSES):
    print(f"  {i}: {g}")


def extract_hand_landmarks(frame_bgr) -> np.ndarray | None:
    """
    Extract 63 features (21 landmarks × 3 coordinates) from a hand frame.
    Returns None if no hand detected.

    These 63 numbers fully describe hand pose and are what we train on —
    NOT the raw image pixels. This makes the model tiny and fast.
    """
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

    with mp_hands.Hands(
        static_image_mode=True,
        max_num_hands=1,
        min_detection_confidence=0.5,
    ) as hands:
        result = hands.process(frame_rgb)

        if not result.multi_hand_landmarks:
            return None

        landmarks = result.multi_hand_landmarks[0].landmark

        # Flatten: [x0,y0,z0, x1,y1,z1, ..., x20,y20,z20]
        features = []
        for lm in landmarks:
            features.extend([lm.x, lm.y, lm.z])

        return np.array(features, dtype=np.float32)


# ════════════════════════════════════════════════════════════════
# SECTION 3 — Record Training Data
# In Colab: use uploaded images or record from webcam
# On your laptop: run this section to collect live data
# ════════════════════════════════════════════════════════════════

def collect_data_from_webcam(gesture_name: str, num_samples: int = 200):
    """
    Record training samples for one gesture using your webcam.

    Press SPACE to capture a frame.
    Press Q to quit early.

    Args:
        gesture_name: Name of the gesture being recorded
        num_samples:  How many samples to collect (200 recommended)

    Returns:
        List of 63-feature arrays
    """
    print(f"\n📸 Collecting data for: '{gesture_name}'")
    print(f"   Show your hand making the '{gesture_name}' gesture")
    print(f"   Press SPACE to capture | Press Q to stop\n")

    cap     = cv2.VideoCapture(0)
    samples = []
    count   = 0

    while count < num_samples:
        ret, frame = cap.read()
        if not ret:
            break

        # Mirror the frame for natural interaction
        frame = cv2.flip(frame, 1)

        # Show hand landmarks live
        with mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.5) as h:
            rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = h.process(rgb)
            if result.multi_hand_landmarks:
                for hand_lm in result.multi_hand_landmarks:
                    mp_drawing.draw_landmarks(frame, hand_lm, mp_hands.HAND_CONNECTIONS)

        # Display progress
        cv2.putText(frame, f"Gesture: {gesture_name}", (10,30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)
        cv2.putText(frame, f"Collected: {count}/{num_samples}", (10,65),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,200,255), 2)
        cv2.putText(frame, "SPACE=capture  Q=quit", (10,95),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,0), 1)
        cv2.imshow(f"Collecting: {gesture_name}", frame)

        key = cv2.waitKey(1)
        if key == ord(" "):    # SPACE — capture
            features = extract_hand_landmarks(frame)
            if features is not None:
                samples.append(features)
                count += 1
                print(f"  ✅ Sample {count}/{num_samples}", end="\r")
            else:
                print("  ⚠️  No hand detected — try again")
        elif key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print(f"\n✅ Collected {len(samples)} samples for '{gesture_name}'")
    return samples


def collect_all_gestures(samples_per_class: int = 200) -> tuple:
    """
    Collect training data for all gesture classes.
    Returns (X, y) arrays ready for training.
    """
    X = []
    y = []

    for class_idx, gesture_name in enumerate(GESTURE_CLASSES):
        input(f"\n▶ Press Enter when ready to record '{gesture_name}'...")
        samples = collect_data_from_webcam(gesture_name, samples_per_class)
        X.extend(samples)
        y.extend([class_idx] * len(samples))
        print(f"✅ '{gesture_name}': {len(samples)} samples collected")

    return np.array(X), np.array(y)


# ════════════════════════════════════════════════════════════════
# SECTION 4 — Load Pre-Collected Data (alternative to webcam)
# If you collected images beforehand, use this section
# ════════════════════════════════════════════════════════════════

def load_data_from_images(data_dir: str) -> tuple:
    """
    Load training data from a folder of images.

    Folder structure:
        data_dir/
          open_palm/
            img001.jpg
            img002.jpg
          pointing/
            img001.jpg
          ...

    Returns:
        X: np.ndarray shape (n_samples, 63)
        y: np.ndarray shape (n_samples,)
    """
    X = []
    y = []

    for class_idx, gesture_name in enumerate(GESTURE_CLASSES):
        class_dir = os.path.join(data_dir, gesture_name)
        if not os.path.exists(class_dir):
            print(f"⚠️  Folder not found: {class_dir}")
            continue

        images = [f for f in os.listdir(class_dir) if f.endswith((".jpg", ".png", ".jpeg"))]
        print(f"📂 Loading '{gesture_name}': {len(images)} images")

        for img_file in images:
            img_path = os.path.join(class_dir, img_file)
            frame    = cv2.imread(img_path)
            if frame is None:
                continue
            features = extract_hand_landmarks(frame)
            if features is not None:
                X.append(features)
                y.append(class_idx)

    print(f"\n✅ Loaded {len(X)} total samples across {len(GESTURE_CLASSES)} classes")
    return np.array(X), np.array(y)


# ════════════════════════════════════════════════════════════════
# SECTION 5 — Train the Classifier
# ════════════════════════════════════════════════════════════════

def train_classifier(X: np.ndarray, y: np.ndarray) -> RandomForestClassifier:
    """
    Train a Random Forest classifier on hand landmark features.

    Why Random Forest?
      - Works great with 63 numerical features
      - Doesn't need GPU
      - Trains in seconds
      - Interpretable
      - 85-95% accuracy with 200 samples/class

    Returns:
        Trained classifier
    """
    print("\n🤖 Training gesture classifier...")
    print(f"   Dataset: {len(X)} samples, {len(GESTURE_CLASSES)} classes")

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"   Train: {len(X_train)} | Test: {len(X_test)}")

    # Train Random Forest
    # n_estimators=200 gives good accuracy/speed balance
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,         # grow full trees
        min_samples_split=2,
        random_state=42,
        n_jobs=-1,              # use all CPU cores
        verbose=0,
    )
    clf.fit(X_train, y_train)

    # Evaluate
    y_pred   = clf.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\n✅ Training complete!")
    print(f"   Test Accuracy: {accuracy*100:.1f}%")
    print(f"\n📊 Classification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=GESTURE_CLASSES,
        zero_division=0
    ))

    # Feature importance (which landmarks matter most)
    importances = clf.feature_importances_
    top_features = np.argsort(importances)[-10:][::-1]
    print("\n🔍 Top 10 most important landmark features:")
    for fi in top_features:
        landmark_idx = fi // 3
        coord        = ["x", "y", "z"][fi % 3]
        print(f"   Landmark {landmark_idx} ({coord}): {importances[fi]:.4f}")

    return clf


def plot_confusion_matrix(clf, X_test, y_test):
    """Plot confusion matrix to see which gestures are confused."""
    from sklearn.metrics import ConfusionMatrixDisplay
    ConfusionMatrixDisplay.from_estimator(
        clf, X_test, y_test,
        display_labels=GESTURE_CLASSES,
        cmap="Blues",
        xticks_rotation=45,
    )
    plt.title("Gesture Classifier — Confusion Matrix")
    plt.tight_layout()
    plt.savefig("confusion_matrix.png", dpi=150)
    plt.show()
    print("📊 Confusion matrix saved as confusion_matrix.png")


# ════════════════════════════════════════════════════════════════
# SECTION 6 — Save Model
# ════════════════════════════════════════════════════════════════

def save_model(clf, output_path: str = "gesture_model.pkl"):
    """
    Save trained model to disk.
    Copy this file to backend/models/gesture_model.pkl
    """
    model_data = {
        "model":   clf,
        "classes": GESTURE_CLASSES,
        "version": "1.0",
        "features": 63,    # 21 landmarks × 3 coords
    }
    with open(output_path, "wb") as f:
        pickle.dump(model_data, f)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"✅ Model saved: {output_path} ({size_kb:.0f} KB)")
    print(f"   → Copy to: backend/models/gesture_model.pkl")

    # In Colab: also save to Google Drive
    try:
        from google.colab import drive
        drive.mount("/content/drive")
        drive_path = "/content/drive/MyDrive/smart_interview_models/gesture_model.pkl"
        os.makedirs(os.path.dirname(drive_path), exist_ok=True)
        import shutil
        shutil.copy(output_path, drive_path)
        print(f"✅ Also saved to Google Drive: {drive_path}")
    except Exception:
        pass   # Not in Colab, that's fine


def load_model(model_path: str = "backend/models/gesture_model.pkl"):
    """Load a saved model for inference."""
    with open(model_path, "rb") as f:
        model_data = pickle.load(f)
    return model_data["model"], model_data["classes"]


def predict_gesture(clf, frame_bgr) -> dict:
    """
    Predict gesture from a single frame.
    Used in the Flask backend for real-time detection.

    Returns:
        {
            gesture:     str   — predicted gesture name
            confidence:  float — 0-1
            all_probs:   dict  — probability per class
        }
    """
    features = extract_hand_landmarks(frame_bgr)

    if features is None:
        return {"gesture": "none", "confidence": 0.0, "all_probs": {}}

    probs      = clf.predict_proba([features])[0]
    class_idx  = np.argmax(probs)
    gesture    = GESTURE_CLASSES[class_idx]
    confidence = float(probs[class_idx])

    return {
        "gesture":    gesture,
        "confidence": round(confidence, 3),
        "all_probs":  dict(zip(GESTURE_CLASSES, probs.tolist())),
    }


# ════════════════════════════════════════════════════════════════
# SECTION 7 — Run Everything
# Uncomment the option you want to use
# ════════════════════════════════════════════════════════════════

if __name__ == "__main__":

    # ── Option A: Collect from webcam ─────────────────────────────────────────
    # X, y = collect_all_gestures(samples_per_class=200)

    # ── Option B: Load from image folder ─────────────────────────────────────
    # X, y = load_data_from_images("./gesture_data/")

    # ── Option C: Use dummy data to test the pipeline (no camera needed) ─────
    print("🧪 Running with synthetic test data to verify pipeline...")
    np.random.seed(42)
    X = np.random.rand(600, 63).astype(np.float32)
    y = np.repeat(np.arange(len(GESTURE_CLASSES)), 600 // len(GESTURE_CLASSES))

    # ── Train ─────────────────────────────────────────────────────────────────
    clf = train_classifier(X, y)

    # ── Save ──────────────────────────────────────────────────────────────────
    save_model(clf, "gesture_model.pkl")

    print("\n" + "="*50)
    print("✅ Training complete!")
    print("   Next steps:")
    print("   1. Download gesture_model.pkl")
    print("   2. Place in: backend/models/gesture_model.pkl")
    print("   3. The Flask backend will load it automatically")
    print("="*50)
