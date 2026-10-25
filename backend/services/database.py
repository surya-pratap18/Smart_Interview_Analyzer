"""
Database Service — PostgreSQL
─────────────────────────────
Handles all database operations:
  - Creating tables on first run
  - Saving interview analysis results
  - Fetching session history
  - Retrieving single sessions
"""

import os
import json
import psycopg2
import psycopg2.extras
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/smart_interview")


# ─── Connection ───────────────────────────────────────────────────────────────

def get_connection():
    """Get a fresh database connection."""
    return psycopg2.connect(DATABASE_URL)


# ─── Table Creation ───────────────────────────────────────────────────────────

CREATE_INTERVIEWS_TABLE = """
CREATE TABLE IF NOT EXISTS interviews (
    id                  SERIAL PRIMARY KEY,
    session_id          VARCHAR(64) UNIQUE NOT NULL,
    filename            VARCHAR(255),

    -- Audio / Language
    language_detected   VARCHAR(16),
    language_name       VARCHAR(64),
    duration            FLOAT,
    transcript          TEXT,

    -- Translation
    target_language     VARCHAR(16),
    target_language_name VARCHAR(64),
    translated_transcript TEXT,

    -- Scores
    overall_score       INTEGER,
    score_breakdown     JSONB,          -- {sentiment, filler_usage, clarity, pace, emotion, eye_contact}

    -- Analysis results
    sentiment           JSONB,          -- {label, confidence}
    fillers             JSONB,          -- {found, total_count, filler_rate_percent, word_count}
    keywords            JSONB,          -- [{word, count}]
    clarity             JSONB,          -- {avg_sentence_length, clarity_score, sentence_count}
    feedback            JSONB,          -- [{category, priority, icon, message}]

    -- Vision / emotion
    emotion_summary     JSONB,          -- {happy, neutral, surprised, fearful, angry, disgusted}
    emotion_timeline    JSONB,          -- [{t, happy, neutral, ...}]
    posture_summary     JSONB,          -- {good, leaning, looking_away}
    eye_contact_score   INTEGER,

    -- Segments / subtitles
    segments            JSONB,          -- [{id, start, end, text}]

    created_at          TIMESTAMP DEFAULT NOW()
);
"""

CREATE_ALERTS_TABLE = """
CREATE TABLE IF NOT EXISTS session_alerts (
    id          SERIAL PRIMARY KEY,
    session_id  VARCHAR(64) REFERENCES interviews(session_id) ON DELETE CASCADE,
    timestamp   FLOAT,              -- seconds into the interview
    type        VARCHAR(50),        -- 'filler', 'eye_contact', 'posture', 'pace', 'emotion'
    severity    VARCHAR(20),        -- 'low', 'medium', 'high'
    message     TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);
"""

CREATE_INDEX = """
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_session_id ON interviews(session_id);
"""


def init_db():
    """
    Create all tables if they don't exist.
    Called once when the Flask app starts.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(CREATE_INTERVIEWS_TABLE)
        cur.execute(CREATE_ALERTS_TABLE)
        # Run each index separately
        cur.execute("CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at DESC);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_interviews_session_id ON interviews(session_id);")
        conn.commit()
        cur.close()
        conn.close()
        print("✅ [DB] Tables initialized successfully")
        return True
    except Exception as e:
        print(f"⚠️  [DB] Could not connect to database: {e}")
        print("   Running without database persistence.")
        print("   Set DATABASE_URL in your .env file to enable history.")
        return False


# ─── Write Operations ─────────────────────────────────────────────────────────

def save_interview(data: dict) -> bool:
    """
    Save a complete interview analysis to the database.

    Args:
        data: The full analysis result dictionary from the analyze route.

    Returns:
        True if saved successfully, False otherwise.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO interviews (
                session_id, filename,
                language_detected, language_name, duration, transcript,
                target_language, target_language_name, translated_transcript,
                overall_score, score_breakdown,
                sentiment, fillers, keywords, clarity, feedback,
                emotion_summary, emotion_timeline, posture_summary, eye_contact_score,
                segments
            )
            VALUES (
                %(session_id)s, %(filename)s,
                %(language)s, %(language_name)s, %(duration)s, %(transcript)s,
                %(target_language)s, %(target_language_name)s, %(translated_transcript)s,
                %(overall_score)s, %(score_breakdown)s,
                %(sentiment)s, %(fillers)s, %(keywords)s, %(clarity)s, %(feedback)s,
                %(emotion_summary)s, %(emotion_timeline)s, %(posture_summary)s, %(eye_contact_score)s,
                %(segments)s
            )
            ON CONFLICT (session_id) DO UPDATE SET
                overall_score = EXCLUDED.overall_score,
                feedback      = EXCLUDED.feedback
        """, {
            "session_id":           data.get("session_id"),
            "filename":             data.get("filename"),
            "language":             data.get("language"),
            "language_name":        data.get("language_name"),
            "duration":             data.get("duration"),
            "transcript":           data.get("transcript"),
            "target_language":      data.get("target_language"),
            "target_language_name": data.get("target_language_name"),
            "translated_transcript":data.get("translated_transcript"),
            "overall_score":        data.get("overall_score"),
            "score_breakdown":      json.dumps(data.get("score_breakdown", {})),
            "sentiment":            json.dumps(data.get("sentiment", {})),
            "fillers":              json.dumps(data.get("fillers", {})),
            "keywords":             json.dumps(data.get("keywords", [])),
            "clarity":              json.dumps(data.get("clarity", {})),
            "feedback":             json.dumps(data.get("feedback", [])),
            "emotion_summary":      json.dumps(data.get("emotion_summary", {})),
            "emotion_timeline":     json.dumps(data.get("emotion_timeline", [])),
            "posture_summary":      json.dumps(data.get("posture_summary", {})),
            "eye_contact_score":    data.get("eye_contact_score", 0),
            "segments":             json.dumps(data.get("segments", [])),
        })

        conn.commit()
        cur.close()
        conn.close()
        print(f"✅ [DB] Session {data.get('session_id')} saved")
        return True

    except Exception as e:
        print(f"❌ [DB] Save error: {e}")
        return False


def save_alerts(session_id: str, alerts: list) -> bool:
    """Save real-time alerts generated during a session."""
    if not alerts:
        return True
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.executemany("""
            INSERT INTO session_alerts (session_id, timestamp, type, severity, message)
            VALUES (%s, %s, %s, %s, %s)
        """, [(session_id, a["timestamp"], a["type"], a["severity"], a["message"]) for a in alerts])
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ [DB] Alert save error: {e}")
        return False


# ─── Read Operations ──────────────────────────────────────────────────────────

def get_history(limit: int = 20, offset: int = 0) -> list:
    """
    Fetch past interview sessions (summary only, not full data).

    Returns list of dicts with: session_id, filename, overall_score,
    language_name, duration, sentiment, emotion_summary, created_at
    """
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT
                session_id, filename, language_name, duration,
                overall_score, score_breakdown, sentiment,
                emotion_summary, eye_contact_score,
                created_at
            FROM interviews
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        # Convert to regular dicts and parse JSONB fields
        result = []
        for row in rows:
            r = dict(row)
            for field in ["score_breakdown", "sentiment", "emotion_summary"]:
                if r.get(field) and isinstance(r[field], str):
                    r[field] = json.loads(r[field])
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
            result.append(r)
        return result

    except Exception as e:
        print(f"❌ [DB] History error: {e}")
        return []


def get_interview(session_id: str) -> dict:
    """Fetch a single complete interview session by session_id."""
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM interviews WHERE session_id = %s", (session_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return None

        r = dict(row)
        json_fields = [
            "score_breakdown", "sentiment", "fillers", "keywords",
            "clarity", "feedback", "emotion_summary", "emotion_timeline",
            "posture_summary", "segments"
        ]
        for field in json_fields:
            if r.get(field) and isinstance(r[field], str):
                r[field] = json.loads(r[field])
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
        return r

    except Exception as e:
        print(f"❌ [DB] Get interview error: {e}")
        return None


def get_progress_stats(limit: int = 10) -> dict:
    """
    Get improvement trend data for the history chart.
    Returns last N sessions with scores for trend visualization.
    """
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT session_id, overall_score, score_breakdown,
                   eye_contact_score, created_at
            FROM interviews
            ORDER BY created_at DESC
            LIMIT %s
        """, (limit,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        result = []
        for row in reversed(rows):   # oldest first for chart
            r = dict(row)
            if r.get("score_breakdown") and isinstance(r["score_breakdown"], str):
                r["score_breakdown"] = json.loads(r["score_breakdown"])
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
            result.append(r)
        return {"sessions": result, "count": len(result)}

    except Exception as e:
        print(f"❌ [DB] Progress stats error: {e}")
        return {"sessions": [], "count": 0}


def delete_interview(session_id: str) -> bool:
    """Delete an interview session (alerts cascade automatically)."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM interviews WHERE session_id = %s", (session_id,))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ [DB] Delete error: {e}")
        return False
