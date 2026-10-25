"""
History Routes
  GET  /api/history          — list past sessions
  GET  /api/history/stats    — improvement trend data
  GET  /api/interview/<id>   — single full session
  DELETE /api/interview/<id> — delete a session
"""
from flask import Blueprint, jsonify, request
from services.database import get_history, get_interview, get_progress_stats, delete_interview

history_bp = Blueprint("history", __name__)


@history_bp.route("/history", methods=["GET"])
def history():
    limit  = int(request.args.get("limit",  20))
    offset = int(request.args.get("offset",  0))
    return jsonify({
        "interviews": get_history(limit, offset),
        "limit":  limit,
        "offset": offset,
    })


@history_bp.route("/history/stats", methods=["GET"])
def stats():
    limit = int(request.args.get("limit", 10))
    return jsonify(get_progress_stats(limit))


@history_bp.route("/interview/<session_id>", methods=["GET"])
def get_single(session_id):
    data = get_interview(session_id)
    if not data:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(data)


@history_bp.route("/interview/<session_id>", methods=["DELETE"])
def delete_single(session_id):
    success = delete_interview(session_id)
    if not success:
        return jsonify({"error": "Could not delete session"}), 500
    return jsonify({"message": "Deleted successfully"})
