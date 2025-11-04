# Backend/routes/email_routes.py
from flask import Blueprint, request, jsonify, current_app
from flask_mail import Message
from flask import current_app as app

email_bp = Blueprint("email", __name__, url_prefix="/api/email")

@email_bp.post("/send")
def send_mail():
    """
    Body: { "to": "user@example.com", "subject": "Hello", "text": "Hi there", "html": "<b>Hi</b>" }
    """
    data = request.get_json(silent=True) or {}
    to = data.get("to")
    subject = data.get("subject", "Message from NAZMI Boutique")
    text = data.get("text", "")
    html = data.get("html")

    if not to:
        return jsonify({"error":"to is required"}), 400

    try:
        mail = app.extensions["mail"]
        msg = Message(subject=subject, recipients=[to])
        msg.body = text or " "
        if html:
            msg.html = html
        mail.send(msg)
        return jsonify({"ok": True, "sent_to": to})
    except Exception as e:
        current_app.logger.error(f"Mail send error: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500

@email_bp.get("/test")
def test_mail():
    return jsonify({"ok": True, "note": "POST /api/email/send to send emails"})
