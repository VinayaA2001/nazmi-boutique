# C:\NAZMI_BOUTIQUE\Backend\app.py
import os
import json
import logging
from datetime import datetime, timedelta
from functools import wraps
from decimal import Decimal, ROUND_HALF_UP

from flask import Flask, request, jsonify, current_app, Blueprint
from flask_cors import CORS
from flask_pymongo import PyMongo
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from bson import ObjectId
import razorpay
import jwt
import hmac
import hashlib

# ------------------- LOAD .env -------------------
load_dotenv()

# ------------------- APP -------------------
app = Flask(__name__)

# CORS (allow Next.js dev host)
CLIENT_ORIGIN = os.getenv("CLIENT_ORIGIN", "")
CORS(
    app,
    supports_credentials=True,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                # ⬇️ ADD your production frontend origin EXACTLY (Vercel/other)
                "https://your-frontend-domain.vercel.app",
            ]
        }
    },
)


# ------------------- CONFIG -------------------
def _env_bool(name: str, default: bool = False) -> bool:
    return str(os.getenv(name, str(default))).strip().lower() in ("1", "true", "yes", "on")

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "nazmi-boutique-secret-key-2025")
JWT_SECRET = os.getenv("JWT_SECRET", app.config["SECRET_KEY"])  # prefer JWT_SECRET if provided

# DB
app.config["MONGO_URI"] = os.getenv("MONGO_URI")

# Mail
app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"] = _env_bool("MAIL_USE_TLS", True)
app.config["MAIL_USE_SSL"] = _env_bool("MAIL_USE_SSL", False)
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_DEFAULT_SENDER", app.config["MAIL_USERNAME"])

# Behaviour
JWT_EXPIRES_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", 7))
ALLOW_GUEST_CHECKOUT = _env_bool("ALLOW_GUEST_CHECKOUT", True)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "nazmiboutique1@gmail.com")

# Razorpay
RZP_KEY = os.getenv("RAZORPAY_KEY_ID")
RZP_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RZP_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")  # optional but recommended

# ------------------- EXTENSIONS -------------------
mongo = PyMongo(app)
db = mongo.db
mail = Mail(app)

# Lazy client helper (safe if keys missing)
def get_razorpay_client():
    if not (RZP_KEY and RZP_SECRET):
        return None
    try:
        return razorpay.Client(auth=(RZP_KEY, RZP_SECRET))
    except Exception as e:
        app.logger.error(f"Razorpay init failed: {e}")
        return None

# ------------------- HELPERS -------------------
def _money(val) -> Decimal:
    """Convert to Decimal(2dp) safely."""
    if isinstance(val, Decimal):
        d = val
    else:
        d = Decimal(str(val or 0))
    return d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def make_jwt(payload: dict, expires_days: int = JWT_EXPIRES_DAYS) -> str:
    p = payload.copy()
    p["exp"] = datetime.utcnow() + timedelta(days=expires_days)
    token = jwt.encode(p, JWT_SECRET, algorithm="HS256")
    return token.decode("utf-8") if isinstance(token, bytes) else token

def decode_jwt(token: str) -> dict:
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

def send_simple_email(subject, recipients, body_text, body_html=None):
    try:
        msg = Message(subject=subject, recipients=recipients)
        msg.body = body_text
        if body_html:
            msg.html = body_html
        mail.send(msg)
        return True, None
    except Exception as e:
        current_app.logger.error(f"Email send error: {e}")
        return False, str(e)

def send_admin_plain(subject: str, text: str):
    try:
        msg = Message(subject=subject, recipients=[ADMIN_EMAIL])
        msg.body = text
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Admin email send error: {e}")
        return False

def oid(x):
    try:
        return ObjectId(x)
    except Exception:
        return None

# ---------- Referral helpers ----------
def _sanitize_percent(v):
    """Clamp discount percent between 5 and 10."""
    try:
        v = float(v)
    except Exception:
        v = 5.0
    return max(5.0, min(10.0, v))

def _load_referral(code: str):
    if not code:
        return None
    return db.referral_codes.find_one({"code": code.upper().strip()})

def _referral_is_valid(ref):
    if not ref:
        return False, "not_found"
    # expired?
    expires_at = ref.get("expires_at")
    if expires_at:
        try:
            if datetime.utcnow() > datetime.fromisoformat(expires_at.replace("Z", "+00:00")):
                return False, "expired"
        except Exception:
            pass
    # usage exhausted?
    if ref.get("max_uses", 0) > 0 and ref.get("uses", 0) >= ref["max_uses"]:
        return False, "exhausted"
    return True, None

def _apply_referral(subtotal: Decimal, code: str):
    """Return (discount_percent, discount_amount, grand_total, reason_if_invalid)"""
    ref = _load_referral(code)
    ok, reason = _referral_is_valid(ref)
    if not ok:
        return Decimal("0"), Decimal("0.00"), _money(subtotal), reason
    percent = Decimal(str(_sanitize_percent(ref.get("percent", 5))))
    discount_amount = (subtotal * (percent / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    grand_total = _money(subtotal - discount_amount)
    return percent, discount_amount, grand_total, None

# ------------------- ROUTES (General) -------------------
@app.get("/")
def home():
    return jsonify({"message": "Welcome to NAZMI Boutique API", "status": "running"})

@app.get("/api/health")
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()})

# ---------- PRODUCTS ----------
@app.get("/api/products")
def get_products():
    """
    Fetch products grouped by product_code, merging variant shapes into a unified structure:
    - variants: [{size, colour, stock, price, images}]
    - availableSizes / availableColors (deduped)
    - minPrice / maxPrice
    """
    try:
        category = request.args.get("category")
        product_code_query = request.args.get("product_code")
        query = {}
        if category:
            query["category"] = category
        if product_code_query:
            query["product_code"] = product_code_query

        products_cursor = db.products.find(query)
        products_list = list(products_cursor)
        if not products_list:
            return jsonify([])

        product_map = {}

        for product in products_list:
            code = product.get("product_code")
            if not code:
                continue

            if code not in product_map:
                product_map[code] = {
                    "_id": str(product["_id"]),
                    "product_code": code,
                    "product_name": product.get("product_name", ""),
                    "material": product.get("material", ""),
                    "category": product.get("category", ""),
                    "description": f"{product.get('material', '')} {product.get('category', '')}".strip(),
                    "variants": [],
                    "availableSizes": set(),
                    "availableColors": set(),
                    "totalStock": 0,
                    "minPrice": float("inf"),
                    "maxPrice": 0,
                    "images": []
                }

            base = product_map[code]

            variants = []
            if isinstance(product.get("variants"), list) and product.get("variants"):
                variants = product["variants"]
            else:
                variants = [{
                    "size": product.get("size", "One Size"),
                    "colour": product.get("colour", "Standard"),
                    "stock": product.get("stock") or product.get("quantity") or 0,
                    "price": product.get("price", 0),
                    "images": product.get("images", []),
                }]

            for var in variants:
                size = str(var.get("size", product.get("size", "One Size")))
                colour = str(var.get("colour", var.get("color", product.get("colour", "Standard"))))
                try:
                    stock = int(var.get("stock", var.get("quantity", product.get("quantity", 0))) or 0)
                except Exception:
                    stock = 0
                try:
                    price = float(var.get("price", product.get("price", 0)) or 0)
                except Exception:
                    price = 0.0
                images = var.get("images", product.get("images", [])) or []

                base["variants"].append({
                    "size": size,
                    "colour": colour,
                    "stock": stock,
                    "price": price,
                    "images": images
                })
                base["availableSizes"].add(size)
                base["availableColors"].add(colour)
                base["totalStock"] += stock
                if price > 0:
                    base["minPrice"] = min(base["minPrice"], price)
                    base["maxPrice"] = max(base["maxPrice"], price)
                if images:
                    base["images"].extend(images)

        out = []
        for prod in product_map.values():
            prod["availableSizes"] = sorted(list(prod["availableSizes"]))
            prod["availableColors"] = sorted(list(prod["availableColors"]))
            seen = set()
            deduped_imgs = []
            for im in prod.get("images", []):
                if im not in seen:
                    seen.add(im)
                    deduped_imgs.append(im)
            prod["images"] = deduped_imgs

            if prod["minPrice"] == float("inf"):
                prod["minPrice"] = 0
            if prod["maxPrice"] == 0:
                prod["maxPrice"] = prod["minPrice"]

            if prod["variants"]:
                first = prod["variants"][0]
                prod["colour"] = first.get("colour", "")
                if not prod.get("images"):
                    prod["images"] = first.get("images", [])

            out.append(prod)

        return jsonify(out)
    except Exception as e:
        current_app.logger.error(f"Error in get_products: {e}")
        return jsonify({"error": f"Failed to fetch products: {str(e)}"}), 500

@app.get("/api/products/<product_id>")
def get_product(product_id):
    _id = oid(product_id)
    if not _id:
        return jsonify({"error": "Invalid product id"}), 400
    product = db.products.find_one({"_id": _id})
    if not product:
        return jsonify({"error": "Product not found"}), 404
    return jsonify({
        "id": str(product["_id"]),
        "product_code": product.get("product_code", ""),
        "product_name": product.get("product_name", ""),
        "material": product.get("material", ""),
        "category": product.get("category", ""),
        "size": product.get("size", ""),
        "colour": product.get("colour", ""),
        "price": product.get("price", 0),
        "images": product.get("images", []),
        "stock": product.get("stock", None)
    })

@app.get("/api/products/categories")
def get_categories():
    try:
        categories = db.products.distinct("category")
        return jsonify(categories)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------- DEBUG ----------
@app.get("/api/debug/products")
def debug_products():
    try:
        products = list(db.products.find().limit(10))
        for p in products:
            p["_id"] = str(p["_id"])
        return jsonify({"count": len(products), "products": products})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.get("/api/debug/stock")
def debug_stock():
    try:
        products = list(db.products.find().limit(10))
        stock_info = []
        for product in products:
            variants_type = "None"
            if "variants" in product and product.get("variants") is not None:
                variants_type = type(product.get("variants")).__name__
            stock_info.append({
                "product_id": str(product["_id"]),
                "product_code": product.get("product_code"),
                "product_name": product.get("product_name"),
                "main_stock": product.get("stock"),
                "quantity": product.get("quantity"),
                "size": product.get("size"),
                "colour": product.get("colour"),
                "price": product.get("price"),
                "variants_raw": product.get("variants"),
                "variants_type": variants_type,
                "all_fields": {k: v for k, v in product.items() if k != "_id"}
            })
        return jsonify({"count": len(stock_info), "stock_data": stock_info})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.get("/api/debug/db")
def debug_db():
    try:
        collections = db.list_collection_names()
        products_count = db.products.count_documents({})
        users_count = db.users.count_documents({})
        return jsonify({
            "collections": collections,
            "products_count": products_count,
            "users_count": users_count,
            "status": "connected"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------- ADMIN CREATE PRODUCT ----------
@app.post("/api/admin/products")
def create_product():
    data = request.get_json(silent=True) or {}
    required = ["product_code", "price", "material", "category"]
    for r in required:
        if not data.get(r):
            return jsonify({"error": f"{r} is required"}), 400
    try:
        doc = {
            "product_code": str(data.get("product_code")),
            "product_name": data.get("product_name", ""),
            "material": data.get("material"),
            "category": data.get("category"),
            "size": data.get("size", "One Size"),
            "colour": data.get("colour", "Standard"),
            "price": float(data.get("price", 0)),
            "images": data.get("images", ["/images/placeholder.jpg"]),
            "stock": int(data.get("stock", 10)),
            "created_at":datetime.now(datetime.UTC)

        }
        res = db.products.insert_one(doc)
        return jsonify({
            "message": "Product created",
            "id": str(res.inserted_id),
            "product_code": doc["product_code"]
        }), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create product: {str(e)}"}), 500

# ---------- REFERRAL CODES ----------
@app.post("/api/admin/referral")
@token_required
def create_referral(current_user):
    """Create a referral code. (You can later restrict to admin users)"""
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip().upper()
    percent = _sanitize_percent(data.get("percent", 5))
    max_uses = int(data.get("max_uses", 0))  # 0 = unlimited
    expires_at = data.get("expires_at")      # ISO string or None

    if not code:
        return jsonify({"error": "code is required"}), 400

    doc = {
        "code": code,
        "percent": percent,
        "max_uses": max_uses,
        "uses": 0,
        "created_by": str(current_user["_id"]),
        "created_at": datetime.utcnow(),
        "expires_at": expires_at
    }

    try:
        db.referral_codes.insert_one(doc)
        return jsonify({"message": "Referral code created", "code": code, "percent": percent}), 201
    except Exception as e:
        return jsonify({"error": f"Cannot create referral: {str(e)}"}), 400

@app.get("/api/referral/validate")
def validate_referral():
    """?code=ABCD → returns {valid, code, percent, reason, uses, max_uses}"""
    code = (request.args.get("code") or "").strip().upper()
    if not code:
        return jsonify({"valid": False, "reason": "code required"}), 400

    ref = _load_referral(code)
    ok, reason = _referral_is_valid(ref)
    if not ok:
        return jsonify({"valid": False, "reason": reason})

    return jsonify({
        "valid": True,
        "code": ref["code"],
        "percent": _sanitize_percent(ref.get("percent", 5)),
        "uses": int(ref.get("uses", 0)),
        "max_uses": int(ref.get("max_uses", 0))
    })

# ---------- USERS ----------
@app.post("/api/register")
def register():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    if db.users.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 400

    user = {
        "username": data.get("username", email.split("@")[0]),
        "email": email,
        "password": generate_password_hash(password),
        "created_at": datetime.utcnow(),
        "is_admin": False,
        "is_verified": False
    }
    result = db.users.insert_one(user)
    token = make_jwt({"user_id": str(result.inserted_id)})

    # Send verification mail (best-effort)
    try:
        verify_token = make_jwt({"user_id": str(result.inserted_id)}, expires_days=1)
        verify_url = f"{request.host_url.rstrip('/')}/api/verify-email?token={verify_token}"
        subject = "Verify your NAZMI Boutique account"
        body = f"Hi {user['username']},\n\nPlease verify your email by visiting: {verify_url}\n\nThanks!"
        send_simple_email(subject, [user["email"]], body)
    except Exception as e:
        app.logger.error(f"Verification email failed: {e}")

    return jsonify({"message": "User registered", "token": token}), 201

@app.get("/api/verify-email")
def verify_email():
    token = request.args.get("token")
    if not token:
        return jsonify({"error": "Token required"}), 400
    try:
        data = decode_jwt(token)
        user_id = data.get("user_id")
        if not user_id:
            return jsonify({"error": "Invalid token payload"}), 400
        db.users.update_one({"_id": oid(user_id)}, {"$set": {"is_verified": True}})
        return jsonify({"message": "Email verified successfully"})
    except Exception as e:
        return jsonify({"error": "Invalid or expired token", "details": str(e)}), 400

@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    user = db.users.find_one({"email": email})
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid email or password"}), 401
    token = make_jwt({"user_id": str(user["_id"])})
    return jsonify({"message": "Login successful", "token": token})

@app.get("/api/user/profile")
@token_required
def profile(current_user):
    return jsonify({
        "id": str(current_user["_id"]),
        "username": current_user.get("username"),
        "email": current_user.get("email"),
        "is_admin": current_user.get("is_admin", False),
        "is_verified": current_user.get("is_verified", False),
        "created_at": current_user.get("created_at")
    })

# ---------- ORDERS (GUEST CHECKOUT ENABLED) ----------
@app.post("/api/orders")
def create_order():
    """
    Create an order. Supports optional `referral_code`.
    Body:
    {
      items: [{product_id, quantity, price, size?, color?/colour?, variant_id?, product_code?}],
      customer_name?, customer_email?, customer_phone?, shipping_address?, referral_code?
    }
    """
    if not ALLOW_GUEST_CHECKOUT and not request.headers.get("Authorization"):
        return jsonify({"error": "Unauthorized"}), 401

    current_user = get_current_user_optional()
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    if not items:
        return jsonify({"error": "Order items required"}), 400

    # Subtotal (server-side)
    try:
        subtotal = sum([
            _money(i.get("price", 0)) * int(i.get("quantity", 0))
            for i in items
        ], start=Decimal("0.00"))
    except Exception:
        return jsonify({"error": "Invalid items format"}), 400

    # Referral apply
    referral_code = (data.get("referral_code") or "").strip().upper() or None
    discount_percent, discount_amount, grand_total, reason = _apply_referral(subtotal, referral_code) if referral_code else (Decimal("0"), Decimal("0.00"), _money(subtotal), None)
    if referral_code and reason:
        # If invalid, ignore discount but echo reason
        referral_note = {"code": referral_code, "valid": False, "reason": reason}
        referral_code = None
        discount_percent = Decimal("0")
        discount_amount = Decimal("0.00")
        grand_total = _money(subtotal)
    else:
        referral_note = {"code": referral_code, "valid": bool(referral_code), "percent": float(discount_percent)}

    order = {
        "user_id": current_user and current_user.get("_id"),
        "order_number": f"ORD{int(datetime.utcnow().timestamp())}",
        "customer_name": data.get("customer_name", (current_user.get("username") if current_user else "Guest")),
        "customer_email": data.get("customer_email", (current_user.get("email") if current_user else None)),
        "customer_phone": data.get("customer_phone"),
        "shipping_address": data.get("shipping_address"),
        "status": "pending",
        "tracking_number": None,
        "subtotal": float(_money(subtotal)),
        "discount_percent": float(discount_percent),
        "discount_amount": float(_money(discount_amount)),
        "grand_total": float(_money(grand_total)),
        "referral_code": referral_code,
        "payment_status": "pending",
        "created_at": datetime.utcnow()
    }
    res = db.orders.insert_one(order)
    order_id = res.inserted_id

    # Items
    for it in items:
        pid = oid(it.get("product_id"))
        vid = oid(it.get("variant_id")) if it.get("variant_id") else None
        if not pid:
            current_app.logger.warning(f"Skipping order item with invalid product_id: {it.get('product_id')}")
            continue
        db.order_items.insert_one({
            "order_id": order_id,
            "product_id": pid,
            "quantity": int(it.get("quantity", 0)),
            "size": it.get("size"),
            "colour": it.get("color") or it.get("colour"),
            "price": float(_money(it.get("price", 0))),
            "variant_id": vid,
            "product_code": it.get("product_code")
        })

    # Reduce stock
    for it in items:
        pid = oid(it.get("product_id"))
        if not pid:
            continue
        try:
            product = db.products.find_one({"_id": pid})
            qty = int(it.get("quantity", 0))
            if qty <= 0:
                continue
            if product and product.get("variants"):
                db.products.update_one(
                    {"_id": pid, "variants.size": it.get("size"), "variants.colour": (it.get("color") or it.get("colour"))},
                    {"$inc": {"variants.$.stock": -qty}}
                )
            else:
                db.products.update_one({"_id": pid}, {"$inc": {"stock": -qty}})
        except Exception as e:
            current_app.logger.error(f"Stock update failed for product {pid}: {e}")

    # Emails (best-effort)
    try:
        if order.get("customer_email"):
            subject = f"Order Confirmation - {order['order_number']}"
            body_lines = [
                f"Dear {order['customer_name']},",
                "",
                f"Your order {order['order_number']} has been placed.",
                f"Subtotal: ₹{order['subtotal']}",
            ]
            if order["discount_percent"] > 0:
                body_lines.append(f"Referral Discount ({order['discount_percent']}%): -₹{order['discount_amount']}")
            body_lines.append(f"Grand Total: ₹{order['grand_total']}")
            body_lines.append("")
            body_lines.append("Thanks for shopping.")
            send_simple_email(subject, [order["customer_email"]], "\n".join(body_lines))

        admin_subject = f"New Order: {order['order_number']}"
        admin_text = (
            f"Order Number: {order['order_number']}\n"
            f"Customer: {order['customer_name']}\n"
            f"Phone: {order.get('customer_phone')}\n"
            f"Email: {order.get('customer_email')}\n"
            f"Address: {order.get('shipping_address')}\n"
            f"Subtotal: ₹{order['subtotal']}\n"
            f"Discount: {order['discount_percent']}% (₹{order['discount_amount']})\n"
            f"Grand Total: ₹{order['grand_total']}\n"
            f"Referral: {referral_note}\n"
            f"Status: {order['status']}\n"
        )
        send_admin_plain(admin_subject, admin_text)
    except Exception as e:
        current_app.logger.error(f"Order email error: {e}")

    return jsonify({
        "message": "Order created",
        "order_number": order["order_number"],
        "order_id": str(order_id),
        "subtotal": order["subtotal"],
        "discount_percent": order["discount_percent"],
        "discount_amount": order["discount_amount"],
        "grand_total": order["grand_total"]
    }), 201

@app.get("/api/orders/<order_number>")
def track_order(order_number):
    order = db.orders.find_one({"order_number": order_number})
    if not order:
        return jsonify({"error": "Order not found"}), 404
    return jsonify({
        "order_number": order["order_number"],
        "status": order["status"],
        "tracking_number": order.get("tracking_number"),
        "customer_name": order.get("customer_name"),
        "subtotal": order.get("subtotal"),
        "discount_percent": order.get("discount_percent"),
        "discount_amount": order.get("discount_amount"),
        "grand_total": order.get("grand_total"),
        "created_at": order.get("created_at")
    })

@app.get("/api/user/orders")
@token_required
def get_user_orders(current_user):
    orders = list(db.orders.find({"user_id": current_user["_id"]}).sort("created_at", -1))
    output = []
    for o in orders:
        output.append({
            "order_number": o["order_number"],
            "status": o["status"],
            "subtotal": o.get("subtotal"),
            "discount_percent": o.get("discount_percent"),
            "discount_amount": o.get("discount_amount"),
            "grand_total": o.get("grand_total"),
            "payment_status": o["payment_status"],
            "created_at": o["created_at"],
            "tracking_number": o.get("tracking_number")
        })
    return jsonify(output)

# ------------------- PAYMENTS BLUEPRINT (/api/payments) -------------------
payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")

def _persist_payment_stub(kind: str, base_name: str, payload: dict):
    try:
        payments_dir = os.path.join("instance", "payments")
        os.makedirs(payments_dir, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        fname = f"{kind}_{base_name}_{ts}.json"
        with open(os.path.join(payments_dir, fname), "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, default=str)
    except Exception as e:
        current_app.logger.warning(f"Saving {kind} stub failed: {e}")

@payments_bp.post("/create-order")
def payments_create_order():
    """
    Create Razorpay order using server-side totals.
    Body:
      { order_number?: "ORD...", amount?: number, purpose?: string }
    If order_number is provided, amount = order.grand_total (server truth).
    Otherwise (fallback), amount must be provided by client (paise will be handled server-side).
    Returns: { success, order_id, amount, currency, key }
    """
    client = get_razorpay_client()
    if not client:
        return jsonify({"error": "Razorpay not configured on server"}), 500

    if not ALLOW_GUEST_CHECKOUT and not request.headers.get("Authorization"):
        return jsonify({"error": "Unauthorized"}), 401

    current_user = get_current_user_optional()
    data = request.get_json(silent=True) or {}
    order_number = data.get("order_number")

    if order_number:
        order = db.orders.find_one({"order_number": order_number})
        if not order:
            return jsonify({"error": "Order not found"}), 404
        amount_rs = _money(order.get("grand_total", 0))
    else:
        if "amount" not in data:
            return jsonify({"error": "Amount or order_number required"}), 400
        # amount may be in paise from FE helper or in rupees; normalize
        amt = Decimal(str(data["amount"]))
        # treat values >= 1000 as paise; else as rupees
        amount_rs = _money(amt / 100 if amt >= 1000 else amt)

    try:
        payment = client.order.create({
            "amount": int(amount_rs * 100),  # paise
            "currency": "INR",
            "payment_capture": 1,
            "notes": {
                "order_number": order_number or "",
                "purpose": data.get("purpose", "Product Purchase"),
                "user_id": str(current_user["_id"]) if current_user else "",
                "user_email": current_user.get("email") if current_user else ""
            }
        })

        _persist_payment_stub("order", payment["id"], {
            "razorpay_order_id": payment["id"],
            "amount": float(amount_rs),
            "currency": "INR",
            "user_id": str(current_user["_id"]) if current_user else None,
            "user_email": current_user.get("email") if current_user else None,
            "order_number": order_number,
            "created_at": datetime.utcnow().isoformat(),
            "status": "created"
        })

        return jsonify({
            "success": True,
            "order_id": payment["id"],
            "amount": int(amount_rs * 100),
            "currency": payment["currency"],
            "key": RZP_KEY
        })
    except Exception as e:
        current_app.logger.error(f"Razorpay order creation error: {e}")
        return jsonify({"error": "Payment creation failed", "details": str(e)}), 500

@payments_bp.post("/verify")
def payments_verify_success():
    """
    Verify signature after checkout.
    Body:
      {
        razorpay_payment_id, razorpay_order_id, razorpay_signature,
        order_number?, amount?
        customer_email?
      }
    Marks order paid, bumps referral uses, stores a receipt stub, emails customer/admin.
    """
    client = get_razorpay_client()
    if not client:
        return jsonify({"error": "Payment service not configured"}), 500

    if not ALLOW_GUEST_CHECKOUT and not request.headers.get("Authorization"):
        return jsonify({"error": "Unauthorized"}), 401

    current_user = get_current_user_optional()
    data = request.get_json(silent=True) or {}

    payment_id = data.get("razorpay_payment_id")
    order_id = data.get("razorpay_order_id")
    signature = data.get("razorpay_signature")
    order_number = data.get("order_number")

    if not all([payment_id, order_id, signature]):
        return jsonify({"error": "Missing payment details"}), 400

    # Verify signature
    try:
        client.utility.verify_payment_signature({
            "razorpay_payment_id": payment_id,
            "razorpay_order_id": order_id,
            "razorpay_signature": signature
        })
    except Exception:
        return jsonify({"error": "Payment verification failed"}), 400

    # Fetch payment details (best-effort)
    try:
        payment_details = client.payment.fetch(payment_id)
    except Exception:
        payment_details = None

    amount_paid = (payment_details["amount"] / 100) if payment_details else float(data.get("amount", 0))
    currency = (payment_details.get("currency") if payment_details else "INR")
    method = (payment_details.get("method") if payment_details else "unknown")

    # Mark order paid + bump referral uses if any
    if order_number:
        ord_doc = db.orders.find_one({"order_number": order_number})
        if ord_doc:
            db.orders.update_one(
                {"_id": ord_doc["_id"]},
                {"$set": {"payment_status": "paid", "status": "confirmed", "paid_at": datetime.utcnow()}}
            )
            if ord_doc.get("referral_code"):
                db.referral_codes.update_one({"code": ord_doc["referral_code"]}, {"$inc": {"uses": 1}})
    # Save payment id for refunds/history
    db.orders.update_one(
        {"_id": ord_doc["_id"]},
        {"$set": {"last_payment_id": payment_id}}
    )
@app.get("/api/orders/by-id/<order_id>")
def get_order_by_id(order_id):
    _id = oid(order_id)
    if not _id:
        return jsonify({"error": "Invalid id"}), 400
    o = db.orders.find_one({"_id": _id})
    if not o:
        return jsonify({"error": "Not found"}), 404
    o["_id"] = str(o["_id"])
    return jsonify(o)

    _persist_payment_stub("payment", payment_id, {
        "razorpay_payment_id": payment_id,
        "razorpay_order_id": order_id,
        "amount": amount_paid,
        "currency": currency,
        "user_id": str(current_user["_id"]) if current_user else None,
        "user_email": current_user.get("email") if current_user else None,
        "order_number": order_number,
        "payment_date": datetime.utcnow().isoformat(),
        "status": "captured",
        "payment_method": method
    })

    # Emails (best-effort)
    try:
        customer_email = (current_user.get("email") if current_user else None) or data.get("customer_email")
        if customer_email:
            subject = f"Payment Receipt - {payment_id}"
            body = (
                f"Dear Customer,\n\nYour payment of ₹{amount_paid} was successful.\n"
                f"Payment ID: {payment_id}\n\nThank you for your purchase!"
            )
            send_simple_email(subject, [customer_email], body)

        send_admin_plain(
            f"Payment Captured: {order_number or order_id}",
            f"Order: {order_number}\nPayment ID: {payment_id}\nAmount: ₹{amount_paid}\nMethod: {method}"
        )
    except Exception as e:
        current_app.logger.error(f"Payment receipt email error: {e}")

    return jsonify({
        "success": True,
        "message": "Payment verified successfully",
        "payment_id": payment_id,
        "order_id": order_id
    })

@payments_bp.post("/refund")
def payments_refund():
    """
    Create a refund.
    Body: { payment_id: string, amount?: number (rupees or paise) }
    """
    client = get_razorpay_client()
    if not client:
        return jsonify({"error": "Payment service not configured"}), 500

    data = request.get_json(silent=True) or {}
    payment_id = data.get("payment_id")
    if not payment_id:
        return jsonify({"error": "payment_id required"}), 400

    amount = data.get("amount")  # optional
    amount_paise = None
    if amount is not None:
        amt = Decimal(str(amount))
        amount_paise = int((_money(amt / 100 if amt >= 1000 else amt)) * 100)

    try:
        refund = client.payment.refund(payment_id, {"amount": amount_paise} if amount_paise else {})
        _persist_payment_stub("refund", refund["id"], refund)
        return jsonify({"success": True, "refund": refund})
    except Exception as e:
        current_app.logger.error(f"Refund error: {e}")
        return jsonify({"error": "Refund failed", "details": str(e)}), 500

@payments_bp.get("/order/<order_id>")
def payments_fetch_order(order_id):
    client = get_razorpay_client()
    if not client:
        return jsonify({"error": "Payment service not configured"}), 500
    try:
        o = client.order.fetch(order_id)
        return jsonify(o)
    except Exception as e:
        return jsonify({"error": "Fetch order failed", "details": str(e)}), 500

@payments_bp.get("/payment/<payment_id>")
def payments_fetch_payment(payment_id):
    client = get_razorpay_client()
    if not client:
        return jsonify({"error": "Payment service not configured"}), 500
    try:
        p = client.payment.fetch(payment_id)
        return jsonify(p)
    except Exception as e:
        return jsonify({"error": "Fetch payment failed", "details": str(e)}), 500

@payments_bp.get("/list")
def payments_list():
    """
    List Razorpay payments quickly. Query: from?, to?, count?, skip?
    """
    client = get_razorpay_client()
    if not client:
        return jsonify({"error": "Payment service not configured"}), 500

    params = {}
    for key in ("from", "to", "count", "skip"):
        if request.args.get(key):
            try:
                params[key] = int(request.args.get(key))
            except Exception:
                pass
    try:
        res = client.payment.all(params)
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": "List payments failed", "details": str(e)}), 500

@payments_bp.post("/webhook")
def payments_webhook():
    """
    Razorpay webhook (optional).
    Set RAZORPAY_WEBHOOK_SECRET in .env for signature verification.
    """
    payload = request.data
    received_sig = request.headers.get("X-Razorpay-Signature")
    if not RZP_WEBHOOK_SECRET:
        # Accept but warn if not configured
        current_app.logger.warning("Webhook received but RAZORPAY_WEBHOOK_SECRET not set.")
        _persist_payment_stub("webhook", "no-secret", {"headers": dict(request.headers), "body": request.json})
        return jsonify({"status": "ok", "warning": "no webhook secret configured"}), 200

    if not received_sig:
        return jsonify({"error": "Missing X-Razorpay-Signature"}), 400

    try:
        expected_sig = hmac.new(
            bytes(RZP_WEBHOOK_SECRET, "utf-8"),
            payload,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, received_sig):
            return jsonify({"error": "Invalid webhook signature"}), 400

        event = request.get_json(silent=True) or {}
        _persist_payment_stub("webhook", event.get("event", "unknown"), event)

        # Optionally: Update order status based on event (payment.captured, refund.processed, etc.)
        return jsonify({"status": "ok"})
    except Exception as e:
        current_app.logger.error(f"Webhook error: {e}")
        return jsonify({"error": "Webhook processing failed"}), 500

# Register blueprint
app.register_blueprint(payments_bp)

# ---------- Backward compatibility shims ----------
# Keep old routes working by delegating to the new logic.

@app.post("/api/create-payment")
def legacy_create_payment():
    # Delegate to /api/payments/create-order
    with app.test_request_context():
        return payments_create_order()

@app.post("/api/payment-success")
def legacy_payment_success():
    # Delegate to /api/payments/verify
    with app.test_request_context():
        return payments_verify_success()

# ---------- SUBSCRIPTION ----------
@app.post("/api/subscribe")
def subscribe():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email required"}), 400

    db.newsletter.update_one(
        {"email": email},
        {"$set": {"email": email, "subscribed_at": datetime.utcnow()}},
        upsert=True
    )
    send_simple_email("Subscribed to NAZMI Newsletter", [email],
                      "Thanks for subscribing to our newsletter!")
    return jsonify({"message": "Subscribed"})

# ---------- TEST EMAIL ----------
@app.get("/api/send-test-email")
def send_test_email():
    try:
        msg = Message(
            subject="Nazmi Boutique Email Test",
            recipients=[ADMIN_EMAIL],
            body="✅ Test email from Flask app — your Gmail SMTP settings work!"
        )
        mail.send(msg)
        return jsonify({"message": "Test email sent successfully!"}), 200
    except Exception as e:
        current_app.logger.error(f"Email send error: {e}")
        return jsonify({"error": str(e)}), 500

# ------------------- RUN -------------------
if __name__ == "__main__":
    print("🚀 Starting NAZMI Boutique Backend...")
    print(f"📍 Listening on http://127.0.0.1:5000  (CORS origin: {CLIENT_ORIGIN})")
    print("🔑 Razorpay key configured:", bool(RZP_KEY and RZP_SECRET))
    print("🔍 Debug endpoints:")
    print("   - /api/debug/db")
    print("   - /api/debug/products")
    print("   - /api/debug/stock")
    print("   - /api/send-test-email")
    print("💳 Payments endpoints:")
    print("   - POST /api/payments/create-order")
    print("   - POST /api/payments/verify")
    print("   - POST /api/payments/refund")
    print("   - GET  /api/payments/order/<order_id>")
    print("   - GET  /api/payments/payment/<payment_id>")
    print("   - GET  /api/payments/list")
    print("   - POST /api/payments/webhook")
    app.run(debug=True, port=5000, host="0.0.0.0")
