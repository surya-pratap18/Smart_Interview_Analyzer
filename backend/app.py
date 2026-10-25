"""
Smart Interview Analyzer — Flask Backend
─────────────────────────────────────────
Entry point. Wires together:
  - Flask app + CORS
  - Flask-SocketIO for real-time WebSocket
  - All route blueprints
  - Database initialization
  - Upload folder setup

Run:
    python app.py

Or with gunicorn (production):
    gunicorn --worker-class eventlet -w 1 app:app
"""
import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL']  = '2'
from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from dotenv import load_dotenv

load_dotenv()    # Load .env file variables

# ── App factory ───────────────────────────────────────────────────────────────

def create_app():
    app = Flask(__name__)

    # Secret key for sessions
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-in-production")

    # Upload folder
    upload_folder = os.path.join(os.path.dirname(__file__), os.getenv("UPLOAD_FOLDER", "uploads"))
    os.makedirs(upload_folder, exist_ok=True)
    app.config["UPLOAD_FOLDER"]      = upload_folder
    app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_FILE_SIZE_MB", 100)) * 1024 * 1024

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Allow React dev server (localhost:5173) and production domain
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",    # Vite dev server
                "http://localhost:3000",    # Create React App
                "http://127.0.0.1:5173",
                os.getenv("FRONTEND_URL", ""),
            ],
            "methods": ["GET", "POST", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    })

    # ── Register Blueprints ───────────────────────────────────────────────────
    from routes.analyze  import analyze_bp
    from routes.history  import history_bp
    from routes.realtime import translate_bp

    app.register_blueprint(analyze_bp,   url_prefix="/api")
    app.register_blueprint(history_bp,   url_prefix="/api")
    app.register_blueprint(translate_bp, url_prefix="/api")

    # ── Health check ──────────────────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return jsonify({
            "status":  "ok",
            "version": "1.0.0",
            "name":    "Smart Interview Analyzer API",
        })

    # ── Error handlers ────────────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint not found"}), 404

    @app.errorhandler(413)
    def file_too_large(e):
        max_mb = os.getenv("MAX_FILE_SIZE_MB", 100)
        return jsonify({"error": f"File too large. Maximum size is {max_mb}MB"}), 413

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app


# ── Create app + SocketIO ─────────────────────────────────────────────────────

app = create_app()
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",      # Use 'eventlet' in production with gunicorn
    logger=False,
    engineio_logger=False,
)

# Register WebSocket handlers
from routes.realtime import register_socketio
register_socketio(socketio)

# ── Initialize database ───────────────────────────────────────────────────────
from services.database import init_db
with app.app_context():
    init_db()


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"

    print("\n" + "="*55)
    print("  🎙️  Smart Interview Analyzer — Backend")
    print("="*55)
    print(f"  URL:      http://localhost:{port}")
    print(f"  Debug:    {debug}")
    print(f"  Whisper:  {os.getenv('WHISPER_MODEL', 'base')}")
    print(f"  Uploads:  {app.config['UPLOAD_FOLDER']}")
    print("="*55 + "\n")

    socketio.run(app, host="0.0.0.0", port=port, debug=debug)
