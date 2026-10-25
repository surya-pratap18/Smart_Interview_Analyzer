"""
Real-Time Alert Service
────────────────────────
Generates alerts DURING the interview based on live signals.
Called every few seconds from the WebSocket handler.

Alert types:
  filler      — too many filler words in recent speech
  eye_contact — looking away from camera
  posture     — slouching or leaning
  pace        — speaking too fast or too slow
  emotion     — nervous/fearful expression detected
  silence     — too long a pause
"""

from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class Alert:
    type:      str       # 'filler' | 'eye_contact' | 'posture' | 'pace' | 'emotion' | 'silence'
    severity:  str       # 'low' | 'medium' | 'high'
    message:   str       # Short message shown to user
    tip:       str       # Quick fix suggestion
    timestamp: float     # Seconds into the interview
    emoji:     str       # Visual indicator

    def to_dict(self):
        return asdict(self)


# ── Alert cooldowns ────────────────────────────────────────────────────────────
# Prevent the same alert from firing repeatedly
# Keys: alert_type → last_fired_timestamp
_cooldowns: dict = {}
COOLDOWN_SECONDS = {
    "filler":      30,   # don't re-alert about fillers for 30 sec
    "eye_contact": 15,
    "posture":     20,
    "pace":        25,
    "emotion":     20,
    "silence":     10,
}


def _can_fire(alert_type: str, current_time: float) -> bool:
    """Check if enough time has passed since last alert of this type."""
    last = _cooldowns.get(alert_type, -999)
    cooldown = COOLDOWN_SECONDS.get(alert_type, 20)
    return (current_time - last) >= cooldown


def _record_fired(alert_type: str, current_time: float):
    """Record that an alert was just fired."""
    _cooldowns[alert_type] = current_time


def reset_cooldowns():
    """Reset all cooldowns — call this at the start of a new session."""
    _cooldowns.clear()


# ── Individual alert checks ───────────────────────────────────────────────────

def check_filler_alert(
    recent_fillers: int,
    window_seconds: float,
    current_time:   float
) -> Optional[Alert]:
    """
    Fire alert if user has said too many fillers in recent window.

    Args:
        recent_fillers: Number of fillers detected in last N seconds
        window_seconds: The window size (e.g. 30 seconds)
        current_time:   Current timestamp in interview
    """
    fillers_per_minute = (recent_fillers / max(window_seconds, 1)) * 60

    if fillers_per_minute >= 6 and _can_fire("filler", current_time):
        _record_fired("filler", current_time)
        return Alert(
            type="filler", severity="high",
            message=f"Too many filler words! ({recent_fillers} in last {int(window_seconds)}s)",
            tip="Pause silently for 1 second instead of saying 'um' or 'like'",
            timestamp=current_time, emoji="🔴"
        )
    elif fillers_per_minute >= 3 and _can_fire("filler", current_time):
        _record_fired("filler", current_time)
        return Alert(
            type="filler", severity="medium",
            message="Watch the filler words — try to slow down",
            tip="Take a breath. Silence is better than 'um'.",
            timestamp=current_time, emoji="🟡"
        )
    return None


def check_eye_contact_alert(
    eye_contact:    bool,
    frames_away:    int,
    current_time:   float
) -> Optional[Alert]:
    """
    Fire alert if user has been looking away for too long.

    Args:
        eye_contact:  Current frame eye contact status
        frames_away:  How many consecutive frames without eye contact
        current_time: Current timestamp
    """
    if not eye_contact and frames_away >= 5 and _can_fire("eye_contact", current_time):
        _record_fired("eye_contact", current_time)
        return Alert(
            type="eye_contact", severity="medium",
            message="Maintain eye contact with the camera",
            tip="Look directly at the camera lens, not at your own face on screen",
            timestamp=current_time, emoji="👁️"
        )
    return None


def check_posture_alert(
    posture:      str,
    current_time: float
) -> Optional[Alert]:
    """
    Fire alert for poor posture detection.

    Args:
        posture:      'good' | 'leaning' | 'slouching'
        current_time: Current timestamp
    """
    if posture == "slouching" and _can_fire("posture", current_time):
        _record_fired("posture", current_time)
        return Alert(
            type="posture", severity="high",
            message="Sit up straight — slouching affects your confidence score",
            tip="Imagine a string pulling the top of your head toward the ceiling",
            timestamp=current_time, emoji="🧍"
        )
    elif posture == "leaning" and _can_fire("posture", current_time):
        _record_fired("posture", current_time)
        return Alert(
            type="posture", severity="medium",
            message="You're leaning — try to sit centered",
            tip="Keep your weight evenly distributed. Feet flat on the floor.",
            timestamp=current_time, emoji="↗️"
        )
    return None


def check_pace_alert(
    current_wpm:  int,
    current_time: float
) -> Optional[Alert]:
    """
    Fire alert for speaking pace issues.

    Args:
        current_wpm:  Estimated words per minute in recent speech
        current_time: Current timestamp
    """
    if current_wpm > 190 and _can_fire("pace", current_time):
        _record_fired("pace", current_time)
        return Alert(
            type="pace", severity="high",
            message=f"Slow down! Speaking at ~{current_wpm} wpm — too fast",
            tip="Take a breath after each sentence. Pause = confidence.",
            timestamp=current_time, emoji="⚡"
        )
    elif current_wpm < 90 and current_wpm > 0 and _can_fire("pace", current_time):
        _record_fired("pace", current_time)
        return Alert(
            type="pace", severity="medium",
            message=f"Speaking slowly (~{current_wpm} wpm) — try to be more energetic",
            tip="Think of your ideal pace as a confident news presenter",
            timestamp=current_time, emoji="🐢"
        )
    return None


def check_emotion_alert(
    emotions:     dict,
    current_time: float
) -> Optional[Alert]:
    """
    Fire alert for concerning emotional states.

    Args:
        emotions:     {happy, neutral, fearful, angry, ...} — current frame
        current_time: Current timestamp
    """
    fearful   = emotions.get("fearful",   0)
    angry     = emotions.get("angry",     0)
    disgusted = emotions.get("disgusted", 0)
    neutral   = emotions.get("neutral",   0)

    if fearful > 40 and _can_fire("emotion", current_time):
        _record_fired("emotion", current_time)
        return Alert(
            type="emotion", severity="high",
            message="You look nervous — take a breath and relax your face",
            tip="Smile slightly. Relax your jaw. Take one slow deep breath.",
            timestamp=current_time, emoji="😰"
        )
    elif (angry + disgusted) > 30 and _can_fire("emotion", current_time):
        _record_fired("emotion", current_time)
        return Alert(
            type="emotion", severity="medium",
            message="Expression looks tense — try to soften your face",
            tip="Unclench your jaw. Think of something positive briefly.",
            timestamp=current_time, emoji="😤"
        )
    elif neutral > 80 and _can_fire("emotion", current_time):
        _record_fired("emotion", current_time)
        return Alert(
            type="emotion", severity="low",
            message="Expressionless — show more engagement",
            tip="Nod when making a point. Smile when mentioning achievements.",
            timestamp=current_time, emoji="😐"
        )
    return None


def check_silence_alert(
    silence_seconds: float,
    current_time:    float
) -> Optional[Alert]:
    """
    Fire alert if user has been silent for too long.

    Args:
        silence_seconds: Seconds of detected silence
        current_time:    Current timestamp
    """
    if silence_seconds > 10 and _can_fire("silence", current_time):
        _record_fired("silence", current_time)
        return Alert(
            type="silence", severity="medium",
            message=f"Long pause ({int(silence_seconds)}s) — it's okay to think out loud",
            tip="Say 'That's a great question, let me think...' to buy time naturally",
            timestamp=current_time, emoji="🤫"
        )
    return None


# ── Master check ──────────────────────────────────────────────────────────────

def check_all_alerts(
    current_time:    float,
    emotions:        dict  = None,
    eye_contact:     bool  = None,
    posture:         str   = None,
    current_wpm:     int   = None,
    recent_fillers:  int   = None,
    window_seconds:  float = 30.0,
    frames_away:     int   = 0,
    silence_seconds: float = 0.0,
) -> list:
    """
    Run all alert checks and return list of fired alerts.
    Called every ~2 seconds from the WebSocket handler.

    Returns:
        List of Alert dicts (empty if no alerts fired)
    """
    fired = []

    if emotions is not None:
        a = check_emotion_alert(emotions, current_time)
        if a: fired.append(a.to_dict())

    if eye_contact is not None:
        a = check_eye_contact_alert(eye_contact, frames_away, current_time)
        if a: fired.append(a.to_dict())

    if posture is not None:
        a = check_posture_alert(posture, current_time)
        if a: fired.append(a.to_dict())

    if current_wpm is not None:
        a = check_pace_alert(current_wpm, current_time)
        if a: fired.append(a.to_dict())

    if recent_fillers is not None:
        a = check_filler_alert(recent_fillers, window_seconds, current_time)
        if a: fired.append(a.to_dict())

    if silence_seconds > 0:
        a = check_silence_alert(silence_seconds, current_time)
        if a: fired.append(a.to_dict())

    return fired
