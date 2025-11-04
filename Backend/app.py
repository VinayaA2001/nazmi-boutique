import os
import hmac
import json
import hashlib
import logging
from datetime import datetime, timedelta
from functools import wraps
from decimal import Decimal

from flask import Flask, request, jsonify
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

# Core
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "nazmi-boutique-secret-key-2025")
JWT_SECRET = os.getenv("JWT_SECRET", app.config["SECRET_KEY"])

# Mongo
app.config["MONGO_URI"] = os.getenv("MONGO_URI")

# Mail
app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USE_SSL"] = False
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_DEFAULT_SENDER", app.config["MAIL_USERNAME"])

# Razorpay
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")

# ==================== EXTENSIONS ====================
# More permissive CORS for development
CORS(app, origins=["*"], supports_credentials=True)
mongo = PyMongo(app)
db = mongo.db
mail = Mail(app)
rzp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET else None

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
    """Check if database is connected"""
    try:
        db.command('ping')
        return True
    except Exception:
        return False

@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    return resp

# ==================== ROOT & HEALTH ====================
@app.route("/")
def root():
    return jsonify({
        "message": "🚀 NAZMI Boutique API is running!",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "auth": {"register": "POST /api/auth/register", "login": "POST /api/auth/login", "profile": "GET /api/auth/profile"},
            "products": {"list": "GET /api/products", "single": "GET /api/products/<id>"},
            "orders": {"create": "POST /api/orders", "user_orders": "GET /api/orders/user"},
            "payments": {
                "create_order": "POST /api/payments/create-order", 
                "verify": "POST /api/payments/verify",
                "razorpay_create": "POST /api/payments/razorpay/create-order",
                "razorpay_verify": "POST /api/payments/razorpay/verify"
            },
            "email": {"send": "POST /api/email/send"},
            "utility": {"health": "GET /api/health", "categories": "GET /api/categories", "debug": "GET /api/debug/db", "routes": "GET /api/debug/routes"},
        }
    })

@app.get("/api/health")
def health():
    # Proper way to check database connection
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
    return jsonify(sorted([
        f"{','.join(sorted(r.methods))} {r.rule}"
        for r in app.url_map.iter_rules()
    ]))

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
def register():
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = data.get("email")
        password = data.get("password")
        username = data.get("username")

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
    except Exception as e:
        logging.exception("Registration error")
        return jsonify({"error": "Internal server error"}), 500

from werkzeug.security import generate_password_hash, check_password_hash

def _looks_pbkdf2(value: str) -> bool:
    return isinstance(value, str) and value.startswith("pbkdf2:")

def _verify_any(stored: str, provided: str) -> bool:
    """
    Accepts:
      - pbkdf2 hashes stored in 'password' or 'password_hash'
      - plain text (legacy) in 'password' or 'password_hash'
    """
    if not isinstance(stored, str):
        return False
    if _looks_pbkdf2(stored):
        return check_password_hash(stored, provided)
    # fallback: treat as plain text
    return stored == provided

def _check_and_migrate_password(user, provided_password):
    """
    Check password in 'password' or 'password_hash'.
    If plain text matches, migrate to pbkdf2 into 'password' and remove 'password_hash'.
    """
    uid = user["_id"]

    # Prefer 'password'
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

    # Migrate to pbkdf2 stored under 'password'
    if not _looks_pbkdf2(user.get("password", "")):
        new_hash = generate_password_hash(provided_password)
        update = {"$set": {"password": new_hash}}
        if field == "password_hash":
            update["$unset"] = {"password_hash": ""}
        db.users.update_one({"_id": uid}, update)

    return True
# ====== TEMP: Seed admin user (remove after first use) ======
@app.post("/api/auth/seed-admin")
def seed_admin():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = data.get("email")
        password = data.get("password")
        username = data.get("username", "admin")

        if not email or not password:
            return jsonify({"error": "email and password required"}), 400

        if db.users.find_one({"email": email}):
            return jsonify({"ok": True, "note": "already exists"}), 200

        hashed = generate_password_hash(password)
        user = {
            "username": username,
            "email": email,
            "password": hashed,   # store the hash in 'password'
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
def login():
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = data.get("email")
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
            "user": {"id": str(user["_id"]), "username": user.get("username",""), "email": user["email"]}
        })
    except Exception:
        logging.exception("Login error")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/auth/profile", methods=["GET"])
@token_required
def profile(current_user):
    return jsonify({
        "user": {
            "id": str(current_user["_id"]),
            "username": current_user["username"],
            "email": current_user["email"],
            "profile": current_user.get("profile", {})
        }
    })

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

        # Calculate totals
        subtotal = sum((item.get("price", 0) or 0) * (item.get("quantity", 0) or 0) for item in items)
        shipping_fee = data.get("shipping_fee", 0)
        tax = subtotal * 0.18
        grand_total = subtotal + shipping_fee + tax

        # Prepare customer info
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
    except Exception as e:
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
    """Create Razorpay order for existing order"""
    if not rzp:
        return jsonify({"error": "Razorpay not configured"}), 500

    data = request.get_json() or {}
    order_id = data.get("order_id")

    if not order_id:
        return jsonify({"error": "order_id required"}), 400

    # Fetch order from DB
    order = db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        return jsonify({"error": "Order not found"}), 404

    if order.get("payment_status") == "paid":
        return jsonify({"error": "Order already paid"}), 400

    amount = float(order.get("grand_total", 0)) * 100  # Convert to paise

    try:
        rzp_order = rzp.order.create({
            "amount": int(amount),
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
    """Verify Razorpay payment"""
    if not rzp:
        return jsonify({"error": "Razorpay not configured"}), 500

    data = request.get_json() or {}
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_signature = data.get("razorpay_signature")

    if not razorpay_payment_id or not razorpay_order_id:
        return jsonify({"error": "Payment ID and Order ID required"}), 400

    try:
        # Verify payment signature if provided
        if razorpay_signature:
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            rzp.utility.verify_payment_signature(params_dict)

        # Fetch payment details from Razorpay
        payment = rzp.payment.fetch(razorpay_payment_id)
        
        if payment.get("status") != "captured":
            return jsonify({"error": f"Payment status: {payment.get('status')}"}), 400

        # Update order status
        notes = payment.get("notes", {})
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

            # Get updated order
            updated_order = db.orders.find_one({"_id": ObjectId(order_id)})
            
            return jsonify({
                "success": True,
                "message": "Payment verified successfully",
                "order_id": order_id,
                "order_number": updated_order.get("order_number"),
                "amount": payment.get("amount", 0) / 100
            })
        else:
            return jsonify({"error": "Order ID not found in payment notes"}), 400

    except Exception as e:
        logging.exception("Payment verification failed")
        return jsonify({"error": f"Payment verification failed: {str(e)}"}), 400

# Legacy payment routes (keep for compatibility)
@app.post("/api/payments/create-order")
def payments_create_order():
    """
    Accepts either:
      { "amount": 499 }                     # in rupees (test friendly)
    OR
      { "order_id": "<mongoId>" }           # reads grand_total from DB
    OR
      { "order_number": "ORD2025..." }      # reads grand_total from DB
    Returns: { order_id, key_id, amount, currency }
    """
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
            "amount": int(float(amount_rupees) * 100),  # rupees -> paise
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
            "amount": order["amount"],     # paise
            "currency": order["currency"]
        }), 201
    except Exception as e:
        logging.exception("Razorpay order create error")
        return jsonify({"error": "Failed to create Razorpay order"}), 500

@app.post("/api/payments/verify")
def payments_verify():
    """
    Body: { "razorpay_payment_id": "...", "razorpay_order_id": "..." }
    Fetches payment from Razorpay, checks status == captured,
    then marks local Mongo order as paid (if notes contain it).
    """
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
        return jsonify({"error": f"Payment status is ${payment.get('status')}"}), 400

    # Try to map back to your local order via notes
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
            {"$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "paid_at": datetime.utcnow()
            }}
        )

    # Save payment JSON snapshot (optional)
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

# Optional: webhook (configure in Razorpay Dashboard)
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
            
        data = request.get_json() or {}
        product_id = data.get("product_id")
        quantity = data.get("quantity", 1)
        
        if not product_id:
            return jsonify({"error": "Product ID required"}), 400
            
        # Get product details
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
        
        # Update or insert cart item
        db.cart.update_one(
            {"user_id": str(current_user["_id"]), "product_id": product_id},
            {"$set": cart_item},
            upsert=True
        )
        
        return jsonify({"message": "Item added to cart", "cart_item": cart_item})
        
    except Exception as e:
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
            print("✅ DB indexes ensured")
        else:
            print("⚠️ Cannot create indexes - database not connected")
    except Exception as e:
        print(f"⚠️ Index creation: {e}")

with app.app_context():
    create_indexes()
# ========== TEMP DEBUG: Inspect stored user & password checks ==========
from werkzeug.security import generate_password_hash, check_password_hash

def _looks_pbkdf2(value: str) -> bool:
    return isinstance(value, str) and value.startswith("pbkdf2:")

@app.post("/api/auth/debug/login-eval")
def auth_debug_login_eval():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = (data.get("email") or "").strip()
        provided = data.get("password") or ""

        # Try exact match first
        user = db.users.find_one({"email": email})

        # If not found, try case-insensitive (some records might have different case)
        if not user:
            user = db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})

        if not user:
            return jsonify({"found": False, "reason": "no user with this email"}), 404

        # Figure out what field is used
        pwd = user.get("password")
        pwdh = user.get("password_hash")

        result = {
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
        }

        return jsonify(result)
    except Exception as e:
        logging.exception("login-eval error")
        return jsonify({"error": str(e)}), 500
from werkzeug.security import generate_password_hash

@app.post("/api/auth/reset-password-temp")
def reset_password_temp():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = (data.get("email") or "").strip()
        new_password = data.get("password") or ""
        if not email or not new_password:
            return jsonify({"error": "email and password required"}), 400

        # Try exact, then case-insensitive
        user = db.users.find_one({"email": email}) or db.users.find_one({
            "email": {"$regex": f"^{email}$", "$options": "i"}
        })
        if not user:
            return jsonify({"error": "user not found"}), 404

        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password": generate_password_hash(new_password)},
             "$unset": {"password_hash": ""}}
        )
        return jsonify({"ok": True, "updated_user_id": str(user["_id"])})
    except Exception as e:
        logging.exception("reset password error")
        return jsonify({"error": "reset failed"}), 500

# ==================== MAIN ====================
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("🚀 NAZMI Boutique API Server Starting...")
    print("📍 http://localhost:5000")
    print(f"🔑 Razorpay: {'✅ Configured' if rzp else '❌ Not Configured'}")
    print(f"🗄️ Database: {'✅ Connected' if check_db_connection() else '❌ Not Connected'}")
    app.run(debug=True, host="0.0.0.0", port=5000)