import os
import re
import hmac
import json
import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from functools import wraps
from typing import Dict, List, Optional, Any

from flask import Flask, request, jsonify, current_app
from flask_pymongo import PyMongo
from flask_cors import CORS
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from bson import ObjectId
import razorpay
import jwt

# ==================== CONFIGURATION ====================
load_dotenv()

app = Flask(__name__)
app.url_map.strict_slashes = False
CORS(app, origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","), 
     supports_credentials=True)

# Core Configuration
app.config.update(
    SECRET_KEY=os.getenv("SECRET_KEY", "nazmi-boutique-secret-key-2025"),
    JWT_SECRET=os.getenv("JWT_SECRET", os.getenv("SECRET_KEY")),
    FRONTEND_URL=os.getenv("FRONTEND_URL", "http://localhost:3000"),
    
    # MongoDB
    MONGO_URI=os.getenv("MONGO_URI"),
    
    # Email
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_USE_TLS=True,
    MAIL_USE_SSL=False,
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER=os.getenv("MAIL_DEFAULT_SENDER", os.getenv("MAIL_USERNAME")),
    
    # Razorpay
    RAZORPAY_KEY_ID=os.getenv("RAZORPAY_KEY_ID"),
    RAZORPAY_KEY_SECRET=os.getenv("RAZORPAY_KEY_SECRET"),
    RAZORPAY_WEBHOOK_SECRET=os.getenv("RAZORPAY_WEBHOOK_SECRET"),
)

# ==================== EXTENSIONS ====================
mongo = PyMongo(app)
db = mongo.db
mail = Mail(app)

# Initialize Razorpay client
rzp_client = None
if app.config["RAZORPAY_KEY_ID"] and app.config["RAZORPAY_KEY_SECRET"]:
    rzp_client = razorpay.Client(auth=(app.config["RAZORPAY_KEY_ID"], app.config["RAZORPAY_KEY_SECRET"]))

# ==================== LOGGING ====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# ==================== DECORATORS & MIDDLEWARE ====================
def make_jwt(payload: dict, expires_days: int = 7) -> str:
    """Create JWT token"""
    payload = payload.copy()
    payload.update({
        "exp": datetime.utcnow() + timedelta(days=expires_days),
        "iat": datetime.utcnow()
    })
    return jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")

def decode_jwt(token: str) -> dict:
    """Decode JWT token"""
    return jwt.decode(token, app.config["JWT_SECRET"], algorithms=["HS256"])

def token_required(f):
    """Require valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Bearer token required"}), 401
        
        token = auth_header.replace("Bearer ", "").strip()
        try:
            data = decode_jwt(token)
            user_id = data.get("user_id")
            if not user_id:
                return jsonify({"error": "Invalid token payload"}), 401
            
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                return jsonify({"error": "User not found"}), 401
            
            if not user.get("is_active", True):
                return jsonify({"error": "Account deactivated"}), 403
                
            return f(user, *args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return jsonify({"error": "Token validation failed"}), 401
    return decorated

def admin_required(f):
    """Require admin privileges"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Bearer token required"}), 401
        
        token = auth_header.replace("Bearer ", "").strip()
        try:
            data = decode_jwt(token)
            user_id = data.get("user_id")
            if not user_id:
                return jsonify({"error": "Invalid token payload"}), 401
            
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if not user or not user.get("is_active", True):
                return jsonify({"error": "User not found or inactive"}), 401
            
            if not user.get("is_admin"):
                return jsonify({"error": "Admin privileges required"}), 403
                
            return f(user, *args, **kwargs)
        except Exception as e:
            logger.error(f"Admin validation error: {str(e)}")
            return jsonify({"error": "Authorization failed"}), 401
    return decorated

def get_current_user_optional():
    """Get current user if token exists, else None"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.replace("Bearer ", "").strip()
    try:
        data = decode_jwt(token)
        user_id = data.get("user_id")
        if user_id:
            return db.users.find_one({"_id": ObjectId(user_id), "is_active": True})
    except Exception:
        return None
    return None

# ==================== UTILITY FUNCTIONS ====================
def check_db_connection() -> bool:
    """Check MongoDB connection"""
    try:
        db.command("ping")
        return True
    except Exception:
        return False

def send_email(to: str, subject: str, body: str, html: str = None) -> bool:
    """Send email with fallback to logging"""
    try:
        if not app.config.get("MAIL_USERNAME"):
            # In development, log email instead of sending
            logger.info(f"[EMAIL] To: {to}, Subject: {subject}\nBody: {body}")
            return True
            
        msg = Message(
            subject=subject,
            recipients=[to],
            body=body,
            html=html
        )
        mail.send(msg)
        logger.info(f"Email sent to {to}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {str(e)}")
        return False

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_phone(phone: str) -> bool:
    """Validate phone number"""
    pattern = r'^\+?[1-9]\d{1,14}$'  # E.164 format
    return bool(re.match(pattern, phone))

def format_currency(amount: float) -> str:
    """Format currency for display"""
    return f"₹{amount:,.2f}"

# ==================== MIDDLEWARE ====================
@app.before_request
def before_request():
    """Global request handling"""
    if request.method == "OPTIONS":
        return
    
    # Log incoming requests (excluding health checks)
    if request.path not in ["/", "/api/health"]:
        logger.info(f"{request.method} {request.path} - {request.remote_addr}")

@app.after_request
def after_request(response):
    """Add CORS headers"""
    response.headers.add('Access-Control-Allow-Origin', 
                        os.getenv("ALLOWED_ORIGINS", "http://localhost:3000"))
    response.headers.add('Access-Control-Allow-Headers', 
                        'Content-Type, Authorization, X-Requested-With')
    response.headers.add('Access-Control-Allow-Methods', 
                        'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route("/api/<path:path>", methods=["OPTIONS"])
def handle_options(path):
    """Handle preflight requests"""
    return "", 204

# ==================== HEALTH & ROOT ====================
@app.route("/")
def root():
    return jsonify({
        "message": "🚀 NAZMI Boutique API",
        "version": "1.0.0",
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/api/health")
def health_check():
    """Comprehensive health check"""
    db_status = "connected" if check_db_connection() else "disconnected"
    services = {
        "database": db_status,
        "razorpay": "configured" if rzp_client else "not_configured",
        "email": "configured" if app.config.get("MAIL_USERNAME") else "not_configured"
    }
    
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": services
    })

# ==================== AUTHENTICATION ====================
@app.route("/api/auth/register", methods=["POST"])
def register():
    """User registration with email verification"""
    try:
        data = request.get_json() or {}

        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()
        username = data.get("username", "").strip()

        if not all([email, password, username]):
            return jsonify({
                "error": "Email, password, and username are required",
                "code": "VALIDATION_ERROR",
                "field": "email",
            }), 400

        if not validate_email(email):
            return jsonify({
                "error": "Invalid email format",
                "code": "INVALID_EMAIL",
                "field": "email",
            }), 400

        if len(password) < 8:
            return jsonify({
                "error": "Password must be at least 8 characters",
                "code": "WEAK_PASSWORD",
                "field": "password",
            }), 400

        if len(username) < 3:
            return jsonify({
                "error": "Username must be at least 3 characters",
                "code": "INVALID_USERNAME",
                "field": "username",
            }), 400

        if db.users.find_one({"email": email}):
            return jsonify({
                "error": "An account with this email already exists",
                "code": "EMAIL_IN_USE",
                "field": "email",
            }), 409

        if db.users.find_one({"username": username}):
            return jsonify({
                "error": "Username already taken",
                "code": "USERNAME_IN_USE",
                "field": "username",
            }), 409

        user_data = {
            "username": username,
            "email": email,
            "password": generate_password_hash(password),
            "is_active": True,
            "is_admin": False,
            "is_verified": False,
            "profile": {"phone": "", "address": {}},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        result = db.users.insert_one(user_data)
        user_id = str(result.inserted_id)

        verify_token = secrets.token_urlsafe(32)
        db.email_verification_tokens.insert_one({
            "user_id": user_id,
            "token": verify_token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=24),
        })

        verify_url = f"{app.config['FRONTEND_URL']}/verify-email?token={verify_token}"
        email_sent = send_email(
            to=email,
            subject="Verify Your Email - NAZMI Boutique",
            body=f"Please verify your email by clicking: {verify_url}",
            html=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                <h2>Welcome to NAZMI Boutique!</h2>
                <p>Please verify your email address by clicking the button below:</p>
                <a href="{verify_url}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Verify Email
                </a>
                <p>This link will expire in 24 hours.</p>
                <p>If you did not create an account, please ignore this email.</p>
            </div>
            """,
        )

        return jsonify({
            "message": "Account created. Please check your email to verify your account before signing in.",
            "requiresVerification": True,
            "email_sent": email_sent,
        }), 201

    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({"error": "Registration failed"}), 500


@app.route("/api/auth/verify-email", methods=["POST"])
def verify_email():
    """Verify email address"""
    try:
        data = request.get_json() or {}
        token = data.get("token", "").strip()

        if not token:
            return jsonify({
                "error": "Verification token required",
                "code": "TOKEN_REQUIRED",
            }), 400

        verification = db.email_verification_tokens.find_one({
            "token": token,
            "expires_at": {"$gt": datetime.utcnow()},
        })

        if not verification:
            return jsonify({
                "error": "Invalid or expired verification token",
                "code": "INVALID_TOKEN",
            }), 400

        user_id = verification["user_id"]

        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"is_verified": True, "updated_at": datetime.utcnow()}},
        )

        db.email_verification_tokens.delete_one({"token": token})

        user = db.users.find_one({"_id": ObjectId(user_id)})
        token_jwt = make_jwt({"user_id": user_id})

        return jsonify({
            "message": "Email verified successfully",
            "token": token_jwt,
            "user": {
                "id": str(user["_id"]),
                "username": user.get("username"),
                "email": user.get("email"),
                "is_verified": user.get("is_verified", True),
                "is_admin": user.get("is_admin", False),
            },
        }), 200

    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        return jsonify({"error": "Email verification failed"}), 500


@app.route("/api/auth/resend-verification", methods=["POST"])
def resend_verification():
    """Resend email verification link"""
    try:
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()

        if not email:
            return jsonify({
                "error": "Email is required",
                "code": "EMAIL_REQUIRED",
                "field": "email",
            }), 400

        user = db.users.find_one({"email": email, "is_active": True})
        if not user:
            return jsonify({
                "message": "If an account with that email exists, a verification email has been sent.",
            }), 200

        if user.get("is_verified"):
            return jsonify({"message": "This account is already verified."}), 200

        user_id = str(user["_id"])

        db.email_verification_tokens.delete_many({"user_id": user_id})

        verify_token = secrets.token_urlsafe(32)
        db.email_verification_tokens.insert_one({
            "user_id": user_id,
            "token": verify_token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=24),
        })

        verify_url = f"{app.config['FRONTEND_URL']}/verify-email?token={verify_token}"
        send_email(
            to=email,
            subject="Verify Your Email - NAZMI Boutique",
            body=f"Please verify your email by clicking: {verify_url}",
            html=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                <h2>Verify your email</h2>
                <p>Click the button below to verify your email address and access your account:</p>
                <a href="{verify_url}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Verify Email
                </a>
                <p>This link will expire in 24 hours.</p>
                <p>If you did not request this, please ignore this email.</p>
            </div>
            """,
        )

        return jsonify({
            "message": "If an account with that email exists, a verification email has been sent.",
        }), 200

    except Exception as e:
        logger.error(f"Resend verification error: {str(e)}")
        return jsonify({"error": "Failed to resend verification email"}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    """User login"""
    try:
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            return jsonify({
                "error": "Email and password are required",
                "code": "VALIDATION_ERROR",
            }), 400

        user = db.users.find_one({"email": email, "is_active": True})
        if not user or not check_password_hash(user.get("password", ""), password):
            return jsonify({
                "error": "Invalid email or password",
                "code": "INVALID_CREDENTIALS",
            }), 401

        if not user.get("is_verified", False):
            return jsonify({
                "error": "Please verify your email to sign in.",
                "code": "EMAIL_NOT_VERIFIED",
                "field": "email",
            }), 403

        token = make_jwt({"user_id": str(user["_id"])})

        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": {
                "id": str(user["_id"]),
                "username": user.get("username"),
                "email": user.get("email"),
                "is_verified": user.get("is_verified", False),
                "is_admin": user.get("is_admin", False),
            },
        }), 200

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Login failed"}), 500

@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    """Initiate password reset"""
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        
        if not email:
            return jsonify({"error": "Email is required"}), 400
            
        # Find user
        user = db.users.find_one({"email": email, "is_active": True})
        if not user:
            # Don't reveal whether email exists
            return jsonify({
                "message": "If an account with that email exists, a reset link has been sent"
            }), 200
        
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        db.password_resets.insert_one({
            "user_id": str(user["_id"]),
            "token": reset_token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=1),
            "used": False
        })
        
        # Send reset email
        reset_url = f"{app.config['FRONTEND_URL']}/reset-password?token={reset_token}"
        email_sent = send_email(
            to=email,
            subject="Reset Your Password - NAZMI Boutique",
            body=f"Reset your password: {reset_url}",
            html=f"""
            <div style="font-family: Arial, sans-serif;">
                <h2>Password Reset Request</h2>
                <p>Click the button below to reset your password:</p>
                <a href="{reset_url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                    Reset Password
                </a>
                <p>This link expires in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
            """
        )
        
        return jsonify({
            "message": "If an account with that email exists, a reset link has been sent",
            "email_sent": email_sent
        }), 200
        
    except Exception as e:
        logger.error(f"Forgot password error: {str(e)}")
        return jsonify({"error": "Password reset request failed"}), 500

@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    """Reset password with token"""
    try:
        data = request.get_json()
        token = data.get("token", "").strip()
        new_password = data.get("new_password", "").strip()
        
        if not token or not new_password:
            return jsonify({"error": "Token and new password are required"}), 400
            
        if len(new_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        
        # Find valid reset token
        reset_record = db.password_resets.find_one({
            "token": token,
            "used": False,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not reset_record:
            return jsonify({"error": "Invalid or expired reset token"}), 400
            
        user_id = reset_record["user_id"]
        
        # Update password
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "password": generate_password_hash(new_password),
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Mark token as used
        db.password_resets.update_one(
            {"token": token},
            {"$set": {"used": True}}
        )
        
        # Invalidate all sessions (optional)
        # You could implement a blacklist here
        
        return jsonify({
            "message": "Password reset successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        return jsonify({"error": "Password reset failed"}), 500

@app.route("/api/auth/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    """Get user profile"""
    return jsonify({
        "user": {
            "id": str(current_user["_id"]),
            "username": current_user.get("username"),
            "email": current_user.get("email"),
            "is_verified": current_user.get("is_verified", False),
            "profile": current_user.get("profile", {})
        }
    }), 200

@app.route("/api/auth/profile", methods=["PUT"])
@token_required
def update_profile(current_user):
    """Update user profile"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON body required"}), 400
            
        update_data = {}
        profile_update = current_user.get("profile", {}).copy()
        
        # Update basic fields
        if "username" in data:
            username = data["username"].strip()
            if len(username) < 3:
                return jsonify({"error": "Username must be at least 3 characters"}), 400
                
            # Check if username is taken
            existing = db.users.find_one({
                "username": username,
                "_id": {"$ne": current_user["_id"]}
            })
            if existing:
                return jsonify({"error": "Username already taken"}), 409
                
            update_data["username"] = username
        
        # Update profile fields
        profile_fields = ["phone", "full_name", "date_of_birth"]
        for field in profile_fields:
            if field in data:
                profile_update[field] = data[field]
        
        if profile_update != current_user.get("profile", {}):
            update_data["profile"] = profile_update
            
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            db.users.update_one(
                {"_id": current_user["_id"]},
                {"$set": update_data}
            )
        
        # Return updated user
        updated_user = db.users.find_one({"_id": current_user["_id"]})
        return jsonify({
            "message": "Profile updated successfully",
            "user": {
                "id": str(updated_user["_id"]),
                "username": updated_user.get("username"),
                "email": updated_user.get("email"),
                "profile": updated_user.get("profile", {})
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Profile update error: {str(e)}")
        return jsonify({"error": "Profile update failed"}), 500

# ==================== PRODUCTS ====================
@app.route("/api/products", methods=["GET"])
def get_products():
    """Get products with filtering and pagination"""
    try:
        # Query parameters
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))
        category = request.args.get("category", "")
        search = request.args.get("search", "")
        min_price = request.args.get("min_price")
        max_price = request.args.get("max_price")
        sort_by = request.args.get("sort_by", "created_at")
        sort_order = int(request.args.get("sort_order", -1))
        
        # Build query
        query = {"is_active": True}
        
        if category:
            query["category"] = category
            
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]
            
        if min_price or max_price:
            query["price"] = {}
            if min_price:
                query["price"]["$gte"] = float(min_price)
            if max_price:
                query["price"]["$lte"] = float(max_price)
        
        # Get total count for pagination
        total = db.products.count_documents(query)
        
        # Get products
        products = list(db.products.find(query)
            .sort(sort_by, sort_order)
            .skip((page - 1) * limit)
            .limit(limit))
        
        # Convert ObjectId to string
        for product in products:
            product["_id"] = str(product["_id"])
            
        return jsonify({
            "products": products,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get products error: {str(e)}")
        return jsonify({"error": "Failed to fetch products"}), 500

@app.route("/api/products/<product_id>", methods=["GET"])
def get_product(product_id):
    """Get single product details"""
    try:
        product = db.products.find_one({
            "_id": ObjectId(product_id),
            "is_active": True
        })
        
        if not product:
            return jsonify({"error": "Product not found"}), 404
            
        product["_id"] = str(product["_id"])
        return jsonify({"product": product}), 200
        
    except Exception as e:
        logger.error(f"Get product error: {str(e)}")
        return jsonify({"error": "Failed to fetch product"}), 500

@app.route("/api/categories", methods=["GET"])
def get_categories():
    """Get product categories"""
    try:
        categories = db.products.distinct("category", {"is_active": True})
        return jsonify({"categories": categories}), 200
    except Exception as e:
        logger.error(f"Get categories error: {str(e)}")
        return jsonify({"error": "Failed to fetch categories"}), 500

# ==================== CART ====================
@app.route("/api/cart", methods=["GET"])
@token_required
def get_cart(current_user):
    """Get user's cart"""
    try:
        cart_items = list(db.cart.find({"user_id": str(current_user["_id"])}))
        
        # Convert ObjectId and enrich with product details
        for item in cart_items:
            item["_id"] = str(item["_id"])
            
            # Get current product info
            product = db.products.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                item["product_details"] = {
                    "name": product.get("name"),
                    "price": product.get("price"),
                    "image": product.get("image"),
                    "stock": product.get("stock", 0)
                }
        
        return jsonify({"cart": cart_items}), 200
        
    except Exception as e:
        logger.error(f"Get cart error: {str(e)}")
        return jsonify({"error": "Failed to fetch cart"}), 500

@app.route("/api/cart", methods=["POST"])
@token_required
def add_to_cart(current_user):
    """Add item to cart"""
    try:
        data = request.get_json()
        product_id = data.get("product_id")
        quantity = int(data.get("quantity", 1))
        
        if not product_id:
            return jsonify({"error": "Product ID is required"}), 400
            
        # Verify product exists and is active
        product = db.products.find_one({
            "_id": ObjectId(product_id),
            "is_active": True
        })
        
        if not product:
            return jsonify({"error": "Product not found"}), 404
            
        # Check stock
        if product.get("stock", 0) < quantity:
            return jsonify({"error": "Insufficient stock"}), 400
        
        # Add to cart (upsert)
        cart_item = {
            "user_id": str(current_user["_id"]),
            "product_id": product_id,
            "quantity": quantity,
            "size": data.get("size"),
            "color": data.get("color"),
            "added_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        db.cart.update_one(
            {
                "user_id": str(current_user["_id"]),
                "product_id": product_id
            },
            {"$set": cart_item},
            upsert=True
        )
        
        return jsonify({"message": "Item added to cart"}), 200
        
    except Exception as e:
        logger.error(f"Add to cart error: {str(e)}")
        return jsonify({"error": "Failed to add item to cart"}), 500

@app.route("/api/cart/<product_id>", methods=["DELETE"])
@token_required
def remove_from_cart(current_user, product_id):
    """Remove item from cart"""
    try:
        result = db.cart.delete_one({
            "user_id": str(current_user["_id"]),
            "product_id": product_id
        })
        
        if result.deleted_count == 0:
            return jsonify({"error": "Item not found in cart"}), 404
            
        return jsonify({"message": "Item removed from cart"}), 200
        
    except Exception as e:
        logger.error(f"Remove from cart error: {str(e)}")
        return jsonify({"error": "Failed to remove item from cart"}), 500

@app.route("/api/cart/clear", methods=["DELETE"])
@token_required
def clear_cart(current_user):
    """Clear user's cart"""
    try:
        db.cart.delete_many({"user_id": str(current_user["_id"])})
        return jsonify({"message": "Cart cleared"}), 200
    except Exception as e:
        logger.error(f"Clear cart error: {str(e)}")
        return jsonify({"error": "Failed to clear cart"}), 500

# ==================== ORDERS ====================
@app.route("/api/orders", methods=["POST"])
@token_required
def create_order(current_user):
    """Create a new order"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON body required"}), 400
            
        # Get cart items
        cart_items = list(db.cart.find({"user_id": str(current_user["_id"])}))
        if not cart_items:
            return jsonify({"error": "Cart is empty"}), 400
        
        # Calculate totals and validate stock
        subtotal = 0
        order_items = []
        
        for item in cart_items:
            product = db.products.find_one({"_id": ObjectId(item["product_id"])})
            if not product or not product.get("is_active", True):
                return jsonify({"error": f"Product {item.get('product_id')} not available"}), 400
                
            if product.get("stock", 0) < item["quantity"]:
                return jsonify({"error": f"Insufficient stock for {product.get('name')}"}), 400
            
            item_total = product["price"] * item["quantity"]
            subtotal += item_total
            
            order_items.append({
                "product_id": item["product_id"],
                "name": product["name"],
                "price": product["price"],
                "quantity": item["quantity"],
                "size": item.get("size"),
                "color": item.get("color"),
                "image": product.get("image"),
                "item_total": item_total
            })
        
        # Calculate shipping and tax
        shipping_fee = 0  # Free shipping for demo
        tax_rate = 0.18   # 18% GST
        tax_amount = subtotal * tax_rate
        grand_total = subtotal + shipping_fee + tax_amount
        
        # Create order
        order_data = {
            "order_number": f"ORD{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            "user_id": str(current_user["_id"]),
            "customer_info": {
                "name": current_user.get("profile", {}).get("full_name", current_user["username"]),
                "email": current_user["email"],
                "phone": current_user.get("profile", {}).get("phone", "")
            },
            "shipping_address": data.get("shipping_address", {}),
            "items": order_items,
            "totals": {
                "subtotal": subtotal,
                "shipping_fee": shipping_fee,
                "tax_amount": tax_amount,
                "grand_total": grand_total
            },
            "status": "pending",
            "payment_status": "pending",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = db.orders.insert_one(order_data)
        order_id = str(result.inserted_id)
        
        # Clear cart
        db.cart.delete_many({"user_id": str(current_user["_id"])})
        
        return jsonify({
            "message": "Order created successfully",
            "order_id": order_id,
            "order_number": order_data["order_number"],
            "grand_total": grand_total
        }), 201
        
    except Exception as e:
        logger.error(f"Create order error: {str(e)}")
        return jsonify({"error": "Failed to create order"}), 500

@app.route("/api/orders", methods=["GET"])
@token_required
def get_orders(current_user):
    """Get user's orders"""
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
        
        # Build query
        query = {"user_id": str(current_user["_id"])}
        
        # Filter by status if provided
        status = request.args.get("status")
        if status:
            query["status"] = status
        
        # Get total count
        total = db.orders.count_documents(query)
        
        # Get orders
        orders = list(db.orders.find(query)
            .sort("created_at", -1)
            .skip((page - 1) * limit)
            .limit(limit))
        
        # Convert ObjectId
        for order in orders:
            order["_id"] = str(order["_id"])
        
        return jsonify({
            "orders": orders,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get orders error: {str(e)}")
        return jsonify({"error": "Failed to fetch orders"}), 500

@app.route("/api/orders/<order_id>", methods=["GET"])
@token_required
def get_order(current_user, order_id):
    """Get specific order details"""
    try:
        order = db.orders.find_one({
            "_id": ObjectId(order_id),
            "user_id": str(current_user["_id"])
        })
        
        if not order:
            return jsonify({"error": "Order not found"}), 404
            
        order["_id"] = str(order["_id"])
        return jsonify({"order": order}), 200
        
    except Exception as e:
        logger.error(f"Get order error: {str(e)}")
        return jsonify({"error": "Failed to fetch order"}), 500

# ==================== PAYMENTS ====================
@app.route("/api/payments/create-order", methods=["POST"])
@token_required
def create_razorpay_order(current_user):
    """Create Razorpay order"""
    try:
        if not rzp_client:
            return jsonify({"error": "Payment service not configured"}), 500
            
        data = request.get_json()
        order_id = data.get("order_id")
        
        if not order_id:
            return jsonify({"error": "Order ID is required"}), 400
            
        # Get order
        order = db.orders.find_one({
            "_id": ObjectId(order_id),
            "user_id": str(current_user["_id"])
        })
        
        if not order:
            return jsonify({"error": "Order not found"}), 404
            
        if order.get("payment_status") == "paid":
            return jsonify({"error": "Order already paid"}), 400
        
        # Create Razorpay order
        amount_paise = int(order["totals"]["grand_total"] * 100)
        
        rzp_order = rzp_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": order["order_number"],
            "notes": {
                "order_id": str(order["_id"]),
                "user_id": str(current_user["_id"])
            },
            "payment_capture": 1
        })
        
        # Update order with Razorpay details
        db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {
                "razorpay_order_id": rzp_order["id"],
                "updated_at": datetime.utcnow()
            }}
        )
        
        return jsonify({
            "razorpay_order_id": rzp_order["id"],
            "amount": rzp_order["amount"],
            "currency": rzp_order["currency"],
            "key": app.config["RAZORPAY_KEY_ID"]
        }), 200
        
    except Exception as e:
        logger.error(f"Create Razorpay order error: {str(e)}")
        return jsonify({"error": "Failed to create payment order"}), 500

@app.route("/api/payments/verify", methods=["POST"])
@token_required
def verify_payment(current_user):
    """Verify Razorpay payment"""
    try:
        if not rzp_client:
            return jsonify({"error": "Payment service not configured"}), 500
            
        data = request.get_json()
        razorpay_payment_id = data.get("razorpay_payment_id")
        razorpay_order_id = data.get("razorpay_order_id")
        razorpay_signature = data.get("razorpay_signature")
        
        if not all([razorpay_payment_id, razorpay_order_id, razorpay_signature]):
            return jsonify({"error": "Payment verification data incomplete"}), 400
        
        # Verify signature
        params_dict = {
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature
        }
        
        rzp_client.utility.verify_payment_signature(params_dict)
        
        # Get payment details
        payment = rzp_client.payment.fetch(razorpay_payment_id)
        
        if payment.get("status") != "captured":
            return jsonify({"error": "Payment not captured"}), 400
        
        # Find and update order
        order = db.orders.find_one({"razorpay_order_id": razorpay_order_id})
        if not order:
            return jsonify({"error": "Order not found"}), 404
            
        # Update order status
        db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "razorpay_payment_id": razorpay_payment_id,
                "paid_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Update product stock
        for item in order["items"]:
            db.products.update_one(
                {"_id": ObjectId(item["product_id"])},
                {"$inc": {"stock": -item["quantity"]}}
            )
        
        # Send confirmation emails
        send_order_confirmation_emails(order)
        
        return jsonify({
            "message": "Payment verified successfully",
            "order_id": str(order["_id"]),
            "order_number": order["order_number"]
        }), 200
        
    except razorpay.errors.SignatureVerificationError:
        return jsonify({"error": "Invalid payment signature"}), 400
    except Exception as e:
        logger.error(f"Payment verification error: {str(e)}")
        return jsonify({"error": "Payment verification failed"}), 500

def send_order_confirmation_emails(order):
    """Send order confirmation emails to customer and admin"""
    try:
        # Customer email
        customer_email = order["customer_info"]["email"]
        send_email(
            to=customer_email,
            subject=f"Order Confirmed - {order['order_number']}",
            body=f"Your order {order['order_number']} has been confirmed.",
            html=generate_order_confirmation_html(order)
        )
        
        # Admin email
        admin_email = "admin@nazmiboutique.com"  # Configure this
        send_email(
            to=admin_email,
            subject=f"New Order - {order['order_number']}",
            body=f"New order received: {order['order_number']}",
            html=generate_admin_order_html(order)
        )
        
    except Exception as e:
        logger.error(f"Order confirmation email error: {str(e)}")

def generate_order_confirmation_html(order):
    """Generate order confirmation email HTML"""
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Order Confirmed!</h2>
        <p>Thank you for your order. Here are your order details:</p>
        
        <h3>Order #{order['order_number']}</h3>
        <p><strong>Status:</strong> {order['status'].title()}</p>
        <p><strong>Order Date:</strong> {order['created_at'].strftime('%Y-%m-%d %H:%M')}</p>
        
        <h4>Items:</h4>
        {"".join([f"<p>{item['name']} - {item['quantity']} x ₹{item['price']}</p>" for item in order['items']])}
        
        <h4>Total: ₹{order['totals']['grand_total']}</h4>
        
        <p>We'll notify you when your order ships.</p>
    </div>
    """

def generate_admin_order_html(order):
    """Generate admin order notification HTML"""
    return f"""
    <div style="font-family: Arial, sans-serif;">
        <h2>New Order Received</h2>
        <p><strong>Order #:</strong> {order['order_number']}</p>
        <p><strong>Customer:</strong> {order['customer_info']['name']}</p>
        <p><strong>Amount:</strong> ₹{order['totals']['grand_total']}</p>
        <p><strong>Date:</strong> {order['created_at'].strftime('%Y-%m-%d %H:%M')}</p>
    </div>
    """

# ==================== ADMIN ENDPOINTS ====================
@app.route("/api/admin/orders", methods=["GET"])
@admin_required
def admin_get_orders(current_user):
    """Admin: Get all orders"""
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))
        status = request.args.get("status")
        
        query = {}
        if status:
            query["status"] = status
            
        total = db.orders.count_documents(query)
        orders = list(db.orders.find(query)
            .sort("created_at", -1)
            .skip((page - 1) * limit)
            .limit(limit))
            
        for order in orders:
            order["_id"] = str(order["_id"])
            
        return jsonify({
            "orders": orders,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Admin get orders error: {str(e)}")
        return jsonify({"error": "Failed to fetch orders"}), 500

@app.route("/api/admin/orders/<order_id>", methods=["PATCH"])
@admin_required
def admin_update_order(current_user, order_id):
    """Admin: Update order status"""
    try:
        data = request.get_json()
        status = data.get("status")
        
        if not status:
            return jsonify({"error": "Status is required"}), 400
            
        valid_statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]
        if status not in valid_statuses:
            return jsonify({"error": "Invalid status"}), 400
            
        order = db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            return jsonify({"error": "Order not found"}), 404
            
        db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {
                "status": status,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Send status update email to customer
        if status in ["shipped", "delivered"]:
            send_order_status_update_email(order, status)
        
        return jsonify({"message": "Order updated successfully"}), 200
        
    except Exception as e:
        logger.error(f"Admin update order error: {str(e)}")
        return jsonify({"error": "Failed to update order"}), 500

def send_order_status_update_email(order, new_status):
    """Send order status update email"""
    try:
        status_messages = {
            "shipped": "has been shipped",
            "delivered": "has been delivered"
        }
        
        message = status_messages.get(new_status, "status has been updated")
        
        send_email(
            to=order["customer_info"]["email"],
            subject=f"Order Update - {order['order_number']}",
            body=f"Your order {order['order_number']} {message}.",
            html=f"""
            <div style="font-family: Arial, sans-serif;">
                <h2>Order Update</h2>
                <p>Your order <strong>#{order['order_number']}</strong> {message}.</p>
                <p>Current status: <strong>{new_status.title()}</strong></p>
            </div>
            """
        )
    except Exception as e:
        logger.error(f"Status update email error: {str(e)}")

# ==================== ERROR HANDLERS ====================
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "Method not allowed"}), 405

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500

# ==================== INITIALIZATION ====================
def create_indexes():
    """Create database indexes"""
    try:
        if check_db_connection():
            # Users
            db.users.create_index("email", unique=True)
            db.users.create_index("username", unique=True)
            db.users.create_index("created_at")
            
            # Products
            db.products.create_index("category")
            db.products.create_index("price")
            db.products.create_index("created_at")
            db.products.create_index([("name", "text"), ("description", "text")])
            
            # Orders
            db.orders.create_index("user_id")
            db.orders.create_index("order_number", unique=True)
            db.orders.create_index("status")
            db.orders.create_index("created_at")
            
            # Cart
            db.cart.create_index([("user_id", 1), ("product_id", 1)], unique=True)
            
            # Auth tokens
            db.password_resets.create_index("token", unique=True)
            db.password_resets.create_index("expires_at", expireAfterSeconds=0)
            db.email_verification_tokens.create_index("token", unique=True)
            db.email_verification_tokens.create_index("expires_at", expireAfterSeconds=0)
            
            logger.info("Database indexes created successfully")
        else:
            logger.warning("Cannot create indexes - database not connected")
    except Exception as e:
        logger.error(f"Index creation error: {str(e)}")

# Initialize indexes when app starts
with app.app_context():
    create_indexes()

if __name__ == "__main__":
    logger.info("🚀 NAZMI Boutique API Server Starting...")
    logger.info(f"📍 http://localhost:{os.getenv('PORT', 5000)}")
    logger.info(f"🔑 Razorpay: {'✅ Configured' if rzp_client else '❌ Not Configured'}")
    logger.info(f"🗄️ Database: {'✅ Connected' if check_db_connection() else '❌ Not Connected'}")
    
    app.run(
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000"))
    )