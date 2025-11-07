# Backend/routes/payments/__init__.py
import os, hmac, hashlib
from flask import Blueprint, request, jsonify, current_app
import razorpay

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")  # create in Razorpay dashboard

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

@payments_bp.post("/order")
def create_order():
    """
    Body: { "amount": 1999 }  # INR rupees
    Returns: { order_id, amount, currency, key_id }
    """
    data = request.get_json(silent=True) or {}
    amount_rupees = int(data.get("amount", 0))
    if amount_rupees <= 0:
        return jsonify({"error": "amount must be > 0"}), 400

    order = client.order.create({
        "amount": amount_rupees * 100,  # paise
        "currency": "INR",
        "payment_capture": 1,
        "receipt": f"rcpt_{amount_rupees}_{os.urandom(3).hex()}",
    })

    return jsonify({
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": RAZORPAY_KEY_ID,
    }), 201

@payments_bp.post("/verify")
def verify_payment_signature():
    """
    Body from frontend after success:
    {
      "razorpay_order_id": "...",
      "razorpay_payment_id": "...",
      "razorpay_signature": "..."
    }
    """
    payload = request.get_json(silent=True) or {}
    oid = payload.get("razorpay_order_id")
    pid = payload.get("razorpay_payment_id")
    sig = payload.get("razorpay_signature")
    if not (oid and pid and sig):
        return jsonify({"error":"missing fields"}), 400

    body = f"{oid}|{pid}".encode()
    expected_sig = hmac.new(
        RAZORPAY_KEY_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()

    if expected_sig != sig:
        return jsonify({"ok": False, "verified": False}), 400

    # TODO: mark order paid in DB here
    return jsonify({"ok": True, "verified": True})

@payments_bp.post("/webhook")
def webhook():
    """
    Set this endpoint in Razorpay Dashboard (Webhooks) with the secret RAZORPAY_WEBHOOK_SECRET
    """
    signature = request.headers.get("X-Razorpay-Signature", "")
    body = request.data

    if not RAZORPAY_WEBHOOK_SECRET:
        return jsonify({"error": "Webhook secret not set"}), 500

    expected = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        return jsonify({"error": "invalid signature"}), 400

    event = request.get_json(silent=True) or {}
    # TODO: handle payment.captured, refund.created, etc.
    current_app.logger.info(f"Razorpay webhook: {event.get('event')}")
    return jsonify({"ok": True})
