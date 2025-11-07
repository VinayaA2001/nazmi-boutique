# backend/app.py
import os
import re
import hmac
import json
import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, jsonify, current_app
from flask_pymongo import PyMongo
from flask_cors import CORS
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from bson import ObjectId
import razorpay
import jwt

# ==================== LOAD ENV ====================
load_dotenv()

# ==================== APP & CONFIG ====================
app = Flask(__name__)
app.url_map.strict_slashes = False  # tolerate /path and /path/
CORS(app, origins=["*"], supports_credentials=True)  # dev-friendly CORS

# Core
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "nazmi-boutique-secret-key-2025")
JWT_SECRET = os.getenv("JWT_SECRET", app.config["SECRET_KEY"])
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Mongo
app.config["MONGO_URI"] = os.getenv("MONGO_URI")

# Mail
app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USE_SSL"] = False
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.getenv(
    "MAIL_DEFAULT_SENDER", app.config.get("MAIL_USERNAME")
)

# Razorpay
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")

# ==================== EXTENSIONS ====================
mongo = PyMongo(app)
db = mongo.db
mail = Mail(app)
rzp = (
    razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    if (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)
    else None
)

# ==================== HELPERS ====================
def make_jwt(payload: dict, expires_days: int = 7):
    p = payload.copy()
    p["exp"] = datetime.utcnow() + timedelta(days=expires_days)
    return jwt.encode(p, JWT_SECRET, algorithm="HS256")

def decode_jwt(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Token is missing!"}), 401
        try:
            token = token.replace("Bearer ", "")
            data = decode_jwt(token)
            current_user = db.users.find_one({"_id": ObjectId(data["user_id"])})
            if not current_user:
                return jsonify({"error": "User not found"}), 401
        except Exception as e:
            return jsonify({"error": "Token is invalid!", "details": str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def get_current_user_optional():
    token = request.headers.get("Authorization")
    if not token:
        return None
    try:
        token = token.replace("Bearer ", "")
        data = decode_jwt(token)
        return db.users.find_one({"_id": ObjectId(data["user_id"])})
    except Exception:
        return None

def check_db_connection():
    try:
        db.command("ping")
        return True
    except Exception:
        return False

def _looks_pbkdf2(value: str) -> bool:
    return isinstance(value, str) and value.startswith("pbkdf2:")

def _looks_scrypt(value: str) -> bool:
    return isinstance(value, str) and value.startswith("scrypt:")

def _verify_any(stored: str, provided: str) -> bool:
    if not isinstance(stored, str):
        return False
    if _looks_pbkdf2(stored) or _looks_scrypt(stored):
        return check_password_hash(stored, provided)
    return stored == provided

def _check_and_migrate_password(user, provided_password):
    uid = user["_id"]
    current = None
    field = None
    if isinstance(user.get("password"), str):
        current = user["password"]
        field = "password"
    elif isinstance(user.get("password_hash"), str):
        current = user["password_hash"]
        field = "password_hash"
    if not current:
        return False

    ok = _verify_any(current, provided_password)
    if not ok:
        return False

    # migrate plain → pbkdf2
    if not (_looks_pbkdf2(user.get("password", "")) or _looks_scrypt(user.get("password", ""))):
        new_hash = generate_password_hash(provided_password)
        update = {"$set": {"password": new_hash}}
        if field == "password_hash":
            update["$unset"] = {"password_hash": ""}
        db.users.update_one({"_id": uid}, update)
    return True

@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    return resp

# -------- Global OPTIONS catcher (preflight) --------
@app.route("/api/<path:_any>", methods=["OPTIONS"])
def any_options(_any):
    return ("", 204)

# ==================== ROOT & HEALTH ====================
@app.route("/")
def root():
    return jsonify({
        "message": "🚀 NAZMI Boutique API is running!",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "auth": {
                "register": "POST /api/auth/register",
                "login": "POST /api/auth/login",
                "profile": "GET /api/auth/profile",
                "forgot": "POST /api/auth/forgot-password",
                "validate_reset": "POST /api/auth/validate-reset-token",
                "reset": "POST /api/auth/reset-password",
            },
            "products": {"list": "GET /api/products", "single": "GET /api/products/<id>"},
            "orders": {"create": "POST /api/orders", "user_orders": "GET /api/orders/user"},
            "payments": {
                "create_order": "POST /api/payments/create-order",
                "verify": "POST /api/payments/verify",
                "razorpay_create": "POST /api/payments/razorpay/create-order",
                "razorpay_verify": "POST /api/payments/razorpay/verify",
                "webhook": "POST /api/payments/webhook",
            },
            "email": {"send": "POST /api/email/send"},
            "utility": {
                "health": "GET /api/health",
                "categories": "GET /api/categories",
                "debug-db": "GET /api/debug/db",
                "routes": "GET /api/debug/routes",
                "cors-test": "GET/POST/OPTIONS /api/debug/cors-test",
            },
        }
    })

@app.get("/api/health")
def health():
    db_connected = check_db_connection()
    return jsonify({
        "status": "healthy",
        "service": "NAZMI Boutique API",
        "database": "connected" if db_connected else "disconnected",
        "razorpay": "configured" if rzp else "not configured",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.get("/api/debug/routes")
def debug_routes():
    return jsonify(sorted([f"{','.join(sorted(r.methods))} {r.rule}" for r in app.url_map.iter_rules()]))

@app.route("/api/debug/cors-test", methods=["GET", "POST", "OPTIONS"])
def cors_test():
    return jsonify({
        "message": "CORS test successful",
        "method": request.method,
        "origin": request.headers.get("Origin"),
        "headers": dict(request.headers)
    })

# ==================== AUTH ====================
@app.route("/api/auth/register", methods=["POST", "OPTIONS"])
@app.route("/api/auth/register/", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return ("", 204)
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password")
        username = (data.get("username") or "").strip()

        if not email or not password or not username:
            return jsonify({"error": "username, email, password are required"}), 400

        if db.users.find_one({"email": email}):
            return jsonify({"error": "User already exists with this email"}), 400

        user_data = {
            "username": username,
            "email": email,
            "password": generate_password_hash(password),
            "created_at": datetime.utcnow(),
            "is_active": True,
            "is_admin": False,
            "profile": {"phone": "", "address": ""}
        }
        result = db.users.insert_one(user_data)
        token = make_jwt({"user_id": str(result.inserted_id)})

        return jsonify({
            "message": "User registered successfully",
            "token": token,
            "user": {"id": str(result.inserted_id), "username": username, "email": email}
        }), 201
    except Exception:
        logging.exception("Registration error")
        return jsonify({"error": "Internal server error"}), 500

@app.post("/api/auth/seed-admin")
def seed_admin():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password")
        username = (data.get("username") or "admin").strip()

        if not email or not password:
            return jsonify({"error": "email and password required"}), 400

        if db.users.find_one({"email": email}):
            return jsonify({"ok": True, "note": "already exists"}), 200

        hashed = generate_password_hash(password)
        user = {
            "username": username,
            "email": email,
            "password": hashed,
            "created_at": datetime.utcnow(),
            "is_active": True,
            "is_admin": True,
        }
        res = db.users.insert_one(user)
        token = make_jwt({"user_id": str(res.inserted_id)})
        return jsonify({"ok": True, "user": {"id": str(res.inserted_id), "email": email}, "token": token}), 201
    except Exception:
        logging.exception("Seed admin error")
        return jsonify({"error": "seed failed"}), 500

@app.route("/api/auth/login", methods=["POST", "OPTIONS"])
@app.route("/api/auth/login/", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return ("", 204)
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password")
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = db.users.find_one({"email": email})
        if not user:
            return jsonify({"error": "Invalid email or password"}), 401

        if not _check_and_migrate_password(user, password):
            return jsonify({"error": "Invalid email or password"}), 401

        token = make_jwt({"user_id": str(user["_id"])})
        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": {"id": str(user["_id"]), "username": user.get("username", ""), "email": user["email"]}
        })
    except Exception:
        logging.exception("Login error")
        return jsonify({"error": "Internal server error"}), 500

@app.get("/api/auth/profile")
@token_required
def profile(current_user):
    return jsonify({
        "user": {
            "id": str(current_user["_id"]),
            "username": current_user.get("username", ""),
            "email": current_user.get("email", ""),
            "profile": current_user.get("profile", {})
        }
    })

# ------- Debug + temp reset helpers (dev only) -------
@app.post("/api/auth/debug/login-eval")
def auth_debug_login_eval():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        provided = data.get("password") or ""
        user = db.users.find_one({"email": email}) or db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
        if not user:
            return jsonify({"found": False, "reason": "no user with this email"}), 404

        pwd = user.get("password")
        pwdh = user.get("password_hash")

        return jsonify({
            "found": True,
            "user_id": str(user["_id"]),
            "email_in_db": user.get("email"),
            "has_password": isinstance(pwd, str),
            "has_password_hash": isinstance(pwdh, str),
            "password_type": ("pbkdf2" if _looks_pbkdf2(pwd or "") else ("plain" if isinstance(pwd, str) else None)),
            "password_hash_type": ("pbkdf2" if _looks_pbkdf2(pwdh or "") else ("plain" if isinstance(pwdh, str) else None)),
            "checks": {
                "password_pbkdf2_check": (check_password_hash(pwd, provided) if (isinstance(pwd, str) and _looks_pbkdf2(pwd)) else None),
                "password_plain_eq": ((pwd == provided) if isinstance(pwd, str) and not _looks_pbkdf2(pwd) else None),
                "password_hash_pbkdf2_check": (check_password_hash(pwdh, provided) if (isinstance(pwdh, str) and _looks_pbkdf2(pwdh)) else None),
                "password_hash_plain_eq": ((pwdh == provided) if isinstance(pwdh, str) and not _looks_pbkdf2(pwdh) else None),
            }
        })
    except Exception as e:
        logging.exception("login-eval error")
        return jsonify({"error": str(e)}), 500

@app.post("/api/auth/reset-password-temp")
def reset_password_temp():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = (data.get("email") or "").strip()
        new_password = data.get("password") or ""
        if not email or not new_password:
            return jsonify({"error": "email and password required"}), 400

        user = db.users.find_one({"email": email}) or db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
        if not user:
            return jsonify({"error": "user not found"}), 404

        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password": generate_password_hash(new_password)}, "$unset": {"password_hash": ""}}
        )
        return jsonify({"ok": True, "updated_user_id": str(user["_id"])})
    except Exception:
        logging.exception("reset password error")
        return jsonify({"error": "reset failed"}), 500


# ==================== PASSWORD RESET (Mongo) ====================
def _send_reset_email(email: str, reset_link: str):
    """Send reset link using Flask-Mail; log if mail not configured."""
    try:
        if not app.config.get("MAIL_USERNAME"):
            app.logger.info(f"[DEV] Password reset link for {email}: {reset_link}")
            return
        msg = Message(subject="Reset your password - NAZMI Boutique", recipients=[email])
        msg.body = f"Click the link to reset your password:\n\n{reset_link}\n\nIf you didn't request this, ignore this email."
        msg.html = f"""
            <p>Click the link below to reset your password:</p>
            <p><a href="{reset_link}">{reset_link}</a></p>
            <p>If you didn't request this, you can ignore this email.</p>
        """
        mail.send(msg)
    except Exception as e:
        app.logger.warning(f"Reset email send skipped/logged. Reason: {e}")

@app.post("/api/auth/forgot-password")
def forgot_password():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = (data.get("email") or "").strip().lower()

        if not email:
            return jsonify({"success": False, "message": "Email is required"}), 400
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
            return jsonify({"success": False, "message": "Invalid email format"}), 400

        user = db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})

        # Always return success to prevent user enumeration
        if not user:
            return jsonify({"success": True, "message": "If an account with that email exists, a reset link has been sent"}), 200

        token = secrets.token_urlsafe(32)
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=1)  # 1 hour

        db.password_resets.insert_one({
            "user_id": str(user["_id"]),
            "email": user.get("email", email),
            "token": token,
            "created_at": now,
            "expires_at": expires_at,
            "used": False
        })

        reset_link = f"{FRONTEND_URL}/auth/resetpassword?token={token}"
        _send_reset_email(email, reset_link)

        return jsonify({"success": True, "message": "If an account with that email exists, a reset link has been sent"}), 200
    except Exception:
        app.logger.exception("Forgot password error")
        return jsonify({"success": False, "message": "Internal server error"}), 500

@app.post("/api/auth/validate-reset-token")
def validate_reset_token():
    try:
        data = request.get_json(force=True, silent=True) or {}
        token = (data.get("token") or "").strip()
        if not token:
            return jsonify({"success": False, "message": "Token is required"}), 400

        entry = db.password_resets.find_one({"token": token, "used": False})
        if not entry:
            return jsonify({"success": False, "message": "Invalid or expired reset token"}), 400

        if entry.get("expires_at") and datetime.utcnow() > entry["expires_at"]:
            db.password_resets.update_one({"_id": entry["_id"]}, {"$set": {"used": True}})
            return jsonify({"success": False, "message": "Reset token has expired"}), 400

        return jsonify({"success": True, "message": "Token is valid"}), 200
    except Exception:
        app.logger.exception("Validate reset token error")
        return jsonify({"success": False, "message": "Internal server error"}), 500

@app.post("/api/auth/reset-password")
def reset_password():
    try:
        data = request.get_json(force=True, silent=True) or {}
        token = (data.get("token") or "").strip()
        new_password = (data.get("newPassword") or data.get("password") or "").strip()

        if not token or not new_password:
            return jsonify({"success": False, "message": "Token and new password are required"}), 400

        if len(new_password) < 8 or not re.search(r"[A-Z]", new_password) or not re.search(r"[a-z]", new_password) or not re.search(r"\d", new_password):
            return jsonify({"success": False, "message": "Password must include at least 8 chars with uppercase, lowercase and numbers"}), 400

        entry = db.password_resets.find_one({"token": token, "used": False})
        if not entry:
            return jsonify({"success": False, "message": "Invalid or expired reset token"}), 400
        if entry.get("expires_at") and datetime.utcnow() > entry["expires_at"]:
            db.password_resets.update_one({"_id": entry["_id"]}, {"$set": {"used": True}})
            return jsonify({"success": False, "message": "Reset token has expired"}), 400

        user_id = entry.get("user_id")
        if not user_id:
            return jsonify({"success": False, "message": "User not found"}), 400

        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password": generate_password_hash(new_password), "last_password_change": datetime.utcnow()},
             "$unset": {"password_hash": ""}}
        )

        # Invalidate all tokens for this user
        db.password_resets.update_many({"user_id": user_id, "used": False}, {"$set": {"used": True}})

        return jsonify({"success": True, "message": "Password reset successfully"}), 200
    except Exception:
        app.logger.exception("Reset password error")
        return jsonify({"success": False, "message": "Internal server error"}), 500

# ==================== PRODUCTS ====================
@app.get("/api/products")
def get_products():
    try:
        if not check_db_connection():
            return jsonify({"error": "Database not connected"}), 500
        products = list(db.products.find({}))
        for p in products:
            p["_id"] = str(p["_id"])
        return jsonify(products)
    except Exception:
        logging.exception("Products error")
        return jsonify({"error": "Failed to fetch products"}), 500

@app.get("/api/products/<product_id>")
def get_product(product_id):
    try:
        if not check_db_connection():
            return jsonify({"error": "Database not connected"}), 500
        product = db.products.find_one({"_id": ObjectId(product_id)})
        if not product:
            return jsonify({"error": "Product not found"}), 404
        product["_id"] = str(product["_id"])
        return jsonify(product)
    except Exception:
        logging.exception("Product detail error")
        return jsonify({"error": "Failed to fetch product"}), 500

# ==================== ORDERS ====================
@app.post("/api/orders")
def create_order():
    try:
        if not check_db_connection():
            return jsonify({"error": "Database not connected"}), 500

        data = request.get_json(force=True, silent=True) or {}
        current_user = get_current_user_optional()

        items = data.get("items", [])
        if not items:
            return jsonify({"error": "No items in order"}), 400

        subtotal = sum((item.get("price", 0) or 0) * (item.get("quantity", 0) or 0) for item in items)
        shipping_fee = float(data.get("shipping_fee", 0))
        tax = subtotal * 0.18
        grand_total = subtotal + shipping_fee + tax

        customer_info = {
            "name": data.get("customer_name", ""),
            "email": data.get("customer_email", ""),
            "phone": data.get("customer_phone", "")
        }

        order_data = {
            "order_number": f"ORD{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "user_id": str(current_user["_id"]) if current_user else None,
            "customer_info": customer_info,
            "shipping_address": data.get("shipping_address", ""),
            "items": items,
            "subtotal": float(subtotal),
            "shipping_fee": float(shipping_fee),
            "tax": float(tax),
            "total": float(subtotal + tax),
            "grand_total": float(grand_total),
            "status": "pending",
            "payment_status": "pending",
            "payment_method": data.get("payment_method", ""),
            "order_type": data.get("order_type", "cart"),
            "created_at": datetime.utcnow()
        }

        result = db.orders.insert_one(order_data)
        return jsonify({
            "message": "Order created successfully",
            "order_id": str(result.inserted_id),
            "order_number": order_data["order_number"],
            "grand_total": order_data["grand_total"]
        }), 201
    except Exception:
        logging.exception("Order creation error")
        return jsonify({"error": "Failed to create order"}), 500

@app.get("/api/orders/user")
@token_required
def get_user_orders(current_user):
    try:
        if not check_db_connection():
            return jsonify({"error": "Database not connected"}), 500
        orders = list(db.orders.find({"user_id": str(current_user["_id"])}).sort("created_at", -1))
        for o in orders:
            o["_id"] = str(o["_id"])
        return jsonify(orders)
    except Exception:
        logging.exception("User orders error")
        return jsonify({"error": "Failed to fetch orders"}), 500

@app.get("/api/orders/<order_id>")
def get_order(order_id):
    try:
        if not check_db_connection():
            return jsonify({"error": "Database not connected"}), 500
        order = db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            return jsonify({"error": "Order not found"}), 404
        order["_id"] = str(order["_id"])
        return jsonify(order)
    except Exception:
        logging.exception("Order fetch error")
        return jsonify({"error": "Failed to fetch order"}), 500

# ==================== EMAIL ====================
@app.post("/api/email/send")
def send_email():
    try:
        data = request.get_json(force=True, silent=True) or {}
        to = data.get("to")
        subject = data.get("subject", "Message from NAZMI Boutique")
        text = data.get("text", "")
        html = data.get("html")
        if not to:
            return jsonify({"error": "to is required"}), 400

        msg = Message(subject=subject, recipients=[to])
        msg.body = text or " "
        if html:
            msg.html = html
        mail.send(msg)
        return jsonify({"ok": True, "sent_to": to})
    except Exception as e:
        logging.exception("Mail send error")
        return jsonify({"ok": False, "error": str(e)}), 500

# ==================== RAZORPAY PAYMENTS ====================
@app.post("/api/payments/razorpay/create-order")
def create_razorpay_order():
    if not rzp:
        return jsonify({"error": "Razorpay not configured"}), 500

    data = request.get_json(force=True, silent=True) or {}
    order_id = data.get("order_id")
    if not order_id:
        return jsonify({"error": "order_id required"}), 400

    order = db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        return jsonify({"error": "Order not found"}), 404
    if order.get("payment_status") == "paid":
        return jsonify({"error": "Order already paid"}), 400

    amount_paise = int(float(order.get("grand_total", 0)) * 100)

    try:
        rzp_order = rzp.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": order["order_number"],
            "notes": {
                "order_id": str(order["_id"]),
                "order_number": order["order_number"],
                "customer_name": order.get("customer_info", {}).get("name", "")
            },
            "payment_capture": 1
        })
        return jsonify({
            "success": True,
            "razorpay_order_id": rzp_order["id"],
            "amount": rzp_order["amount"],
            "currency": rzp_order["currency"],
            "key": RAZORPAY_KEY_ID
        })
    except Exception as e:
        logging.exception("Razorpay order creation failed")
        return jsonify({"error": f"Failed to create Razorpay order: {str(e)}"}), 500

@app.post("/api/payments/razorpay/verify")
def verify_razorpay_payment():
    if not rzp:
        return jsonify({"error": "Razorpay not configured"}), 500

    data = request.get_json(force=True, silent=True) or {}
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_signature = data.get("razorpay_signature")

    if not razorpay_payment_id or not razorpay_order_id:
        return jsonify({"error": "Payment ID and Order ID required"}), 400

    try:
        if razorpay_signature:
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            rzp.utility.verify_payment_signature(params_dict)

        payment = rzp.payment.fetch(razorpay_payment_id)
        if payment.get("status") != "captured":
            return jsonify({"error": f"Payment status: {payment.get('status')}"}), 400

        notes = payment.get("notes", {}) or {}
        order_id = notes.get("order_id")
        if order_id:
            db.orders.update_one(
                {"_id": ObjectId(order_id)},
                {"$set": {
                    "payment_status": "paid",
                    "status": "confirmed",
                    "paid_at": datetime.utcnow(),
                    "razorpay_payment_id": razorpay_payment_id,
                    "razorpay_order_id": razorpay_order_id
                }}
            )
            updated = db.orders.find_one({"_id": ObjectId(order_id)})
            return jsonify({
                "success": True,
                "message": "Payment verified successfully",
                "order_id": order_id,
                "order_number": updated.get("order_number"),
                "amount": payment.get("amount", 0) / 100
            })
        else:
            return jsonify({"error": "Order ID not found in payment notes"}), 400
    except Exception as e:
        logging.exception("Payment verification failed")
        return jsonify({"error": f"Payment verification failed: {str(e)}"}), 400

# Legacy create/verify for compatibility
@app.post("/api/payments/create-order")
def payments_create_order():
    if not rzp:
        return jsonify({"error": "Razorpay not configured"}), 500

    data = request.get_json(force=True, silent=True) or {}
    amount_rupees = data.get("amount")

    order_doc = None
    if not amount_rupees:
        oid = data.get("order_id")
        onum = data.get("order_number")
        if oid:
            order_doc = db.orders.find_one({"_id": ObjectId(oid)})
        elif onum:
            order_doc = db.orders.find_one({"order_number": onum})
        if not order_doc:
            return jsonify({"error": "Order not found. Provide amount/order_id/order_number"}), 400
        amount_rupees = order_doc.get("grand_total") or order_doc.get("total") or 0

    try:
        order = rzp.order.create({
            "amount": int(float(amount_rupees) * 100),
            "currency": "INR",
            "payment_capture": 1,
            "receipt": f"rcpt_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "notes": {
                "mongo_order_id": str(order_doc["_id"]) if order_doc else "",
                "order_number": order_doc.get("order_number", "") if order_doc else ""
            }
        })
        return jsonify({
            "order_id": order["id"],
            "key_id": RAZORPAY_KEY_ID,
            "amount": order["amount"],
            "currency": order["currency"]
        }), 201
    except Exception:
        logging.exception("Razorpay order create error")
        return jsonify({"error": "Failed to create Razorpay order"}), 500

@app.post("/api/payments/verify")
def payments_verify():
    if not rzp:
        return jsonify({"error": "Razorpay not configured"}), 500

    data = request.get_json(force=True, silent=True) or {}
    pid = data.get("razorpay_payment_id")
    oid = data.get("razorpay_order_id")

    if not pid or not oid:
        return jsonify({"error": "razorpay_payment_id and razorpay_order_id are required"}), 400

    try:
        payment = rzp.payment.fetch(pid)
    except Exception:
        return jsonify({"error": "Invalid payment id"}), 400

    if payment.get("status") != "captured":
        return jsonify({"error": f"Payment status is {payment.get('status')}"}), 400

    notes = payment.get("notes", {}) or {}
    mongo_order_id = notes.get("mongo_order_id")
    order_number = notes.get("order_number")
    order = None

    if mongo_order_id:
        order = db.orders.find_one({"_id": ObjectId(mongo_order_id)})
    if not order and order_number:
        order = db.orders.find_one({"order_number": order_number})

    if order:
        db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": {"payment_status": "paid", "status": "confirmed", "paid_at": datetime.utcnow()}}
        )

    try:
        os.makedirs("instance/payments", exist_ok=True)
        snap = f"instance/payments/payment_{pid}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(snap, "w", encoding="utf-8") as f:
            json.dump(payment, f, indent=2, default=str)
    except Exception:
        pass

    return jsonify({
        "ok": True,
        "verified": True,
        "amount": payment.get("amount", 0) / 100.0,
        "method": payment.get("method"),
        "order_linked": bool(order)
    })

@app.post("/api/payments/webhook")
def payments_webhook():
    if not RAZORPAY_WEBHOOK_SECRET:
        return jsonify({"error": "Webhook secret not set"}), 500

    signature = request.headers.get("X-Razorpay-Signature", "")
    body = request.data
    expected = hmac.new(RAZORPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return jsonify({"error": "invalid signature"}), 400

    event = request.get_json(silent=True) or {}
    app.logger.info(f"Razorpay webhook: {event.get('event')}")
    return jsonify({"ok": True})

# ==================== UTILITY ====================
@app.get("/api/categories")
def categories():
    try:
        if not check_db_connection():
            return jsonify({"error": "Database not connected"}), 500
        cats = db.products.distinct("category")
        return jsonify(cats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.get("/api/debug/db")
def debug_db():
    try:
        if not check_db_connection():
            return jsonify({
                "error": "Database not connected",
                "status": "disconnected",
                "collections": [],
                "users_count": 0,
                "products_count": 0,
                "orders_count": 0
            }), 500
        collections = db.list_collection_names()
        return jsonify({
            "collections": collections,
            "users_count": db.users.count_documents({}),
            "products_count": db.products.count_documents({}),
            "orders_count": db.orders.count_documents({}),
            "status": "connected"
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "status": "disconnected",
            "collections": [],
            "users_count": 0,
            "products_count": 0,
            "orders_count": 0
        }), 500

# ==================== CART ENDPOINTS ====================
@app.post("/api/cart/add")
@token_required
def add_to_cart(current_user):
    try:
        if not check_db_connection():
            return jsonify({"error": "Database not connected"}), 500

        data = request.get_json(force=True, silent=True) or {}
        product_id = data.get("product_id")
        quantity = int(data.get("quantity", 1))

        if not product_id:
            return jsonify({"error": "Product ID required"}), 400

        product = db.products.find_one({"_id": ObjectId(product_id)})
        if not product:
            return jsonify({"error": "Product not found"}), 404

        cart_item = {
            "user_id": str(current_user["_id"]),
            "product_id": product_id,
            "name": product.get("name"),
            "price": product.get("price"),
            "image": product.get("image", ""),
            "quantity": quantity,
            "size": data.get("size"),
            "color": data.get("color"),
            "product_code": product.get("product_code"),
            "max_stock": product.get("stock", 0),
            "added_at": datetime.utcnow()
        }

        db.cart.update_one(
            {"user_id": str(current_user["_id"]), "product_id": product_id},
            {"$set": cart_item},
            upsert=True
        )
        return jsonify({"message": "Item added to cart", "cart_item": cart_item})
    except Exception:
        logging.exception("Add to cart error")
        return jsonify({"error": "Failed to add item to cart"}), 500

@app.get("/api/cart")
@token_required
def get_cart(current_user):
    try:
        if not check_db_connection():
            return jsonify({"error": "Database not connected"}), 500
        cart_items = list(db.cart.find({"user_id": str(current_user["_id"])}))
        for item in cart_items:
            item["_id"] = str(item["_id"])
        return jsonify(cart_items)
    except Exception:
        logging.exception("Get cart error")
        return jsonify({"error": "Failed to fetch cart"}), 500

@app.delete("/api/cart/<product_id>")
@token_required
def remove_from_cart(current_user, product_id):
    try:
        if not check_db_connection():
            return jsonify({"error": "Database not connected"}), 500
        result = db.cart.delete_one({"user_id": str(current_user["_id"]), "product_id": product_id})
        if result.deleted_count:
            return jsonify({"message": "Item removed from cart"})
        else:
            return jsonify({"error": "Item not found in cart"}), 404
    except Exception:
        logging.exception("Remove from cart error")
        return jsonify({"error": "Failed to remove item from cart"}), 500

# ==================== ERRORS ====================
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

# ==================== INIT ====================
def create_indexes():
    try:
        if check_db_connection():
            db.users.create_index("email", unique=True)
            db.products.create_index("product_code")
            db.orders.create_index("order_number", unique=True)
            db.cart.create_index([("user_id", 1), ("product_id", 1)], unique=True)
            # TTL for password reset tokens (expire by expires_at field)
            db.password_resets.create_index("expires_at", expireAfterSeconds=0)
            print("✅ DB indexes ensured")
        else:
            print("⚠️ Cannot create indexes - database not connected")
    except Exception as e:
        print(f"⚠️ Index creation: {e}")

with app.app_context():
    create_indexes()

# ==================== MAIN ====================
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("🚀 NAZMI Boutique API Server Starting...")
    print("📍 http://localhost:5000")
    print(f"🔑 Razorpay: {'✅ Configured' if rzp else '❌ Not Configured'}")
    print(f"🗄️ Database: {'✅ Connected' if check_db_connection() else '❌ Not Connected'}")
    # Respect PORT env var when running directly
    app.run(debug=True, host="0.0.0.0", port=int(os.getenv("PORT", "6000")))
