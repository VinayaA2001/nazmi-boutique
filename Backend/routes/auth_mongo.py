from __future__ import annotations
import logging
import secrets
import re
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
import jwt

# Configure logger
logger = logging.getLogger(__name__)

# Constants
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
)

PHONE_REGEX = re.compile(r"^\+?[1-9]\d{1,14}$")  # E.164 format

PASSWORD_MIN_LENGTH = 8

# Blueprint
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


class AuthService:
    """Service class for authentication business logic"""
    
    @staticmethod
    def get_db():
        """Get database instance"""
        return current_app.mongo.db
    
    @staticmethod
    def get_jwt_secret() -> str:
        """Get JWT secret from config"""
        return current_app.config.get("JWT_SECRET") or current_app.config["SECRET_KEY"]
    
    @staticmethod
    def create_token(user_id: str, expires_days: int = 7) -> str:
        """Create JWT token"""
        payload = {
            "user_id": user_id,
            "exp": datetime.utcnow() + timedelta(days=expires_days),
            "iat": datetime.utcnow(),
            "type": "access"
        }
        return jwt.encode(payload, AuthService.get_jwt_secret(), algorithm="HS256")
    
    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """Decode and validate JWT token"""
        try:
            return jwt.decode(token, AuthService.get_jwt_secret(), algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise ValueError("Token has expired")
        except jwt.InvalidTokenError:
            raise ValueError("Invalid token")
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        return bool(EMAIL_REGEX.match(email))
    
    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate phone number format"""
        return bool(PHONE_REGEX.match(phone))
    
    @staticmethod
    def validate_password(password: str) -> Tuple[bool, Optional[str]]:
        """Validate password strength"""
        if len(password) < PASSWORD_MIN_LENGTH:
            return False, f"Password must be at least {PASSWORD_MIN_LENGTH} characters"
        
        if not any(c.isupper() for c in password):
            return False, "Password must contain at least one uppercase letter"
        
        if not any(c.islower() for c in password):
            return False, "Password must contain at least one lowercase letter"
        
        if not any(c.isdigit() for c in password):
            return False, "Password must contain at least one number"
        
        return True, None
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Generate secure password hash"""
        return generate_password_hash(password)
    
    @staticmethod
    def verify_password(stored_hash: str, provided_password: str) -> bool:
        """Verify password against stored hash"""
        if not stored_hash or not provided_password:
            return False
        
        # Handle both werkzeug hashes and legacy plain text (for migration)
        if stored_hash.startswith(('pbkdf2:', 'scrypt:', 'bcrypt:')):
            return check_password_hash(stored_hash, provided_password)
        
        # Legacy plain text - will be migrated on next login
        return stored_hash == provided_password
    
    @staticmethod
    def migrate_password(user_id: ObjectId, plain_password: str) -> None:
        """Migrate plain password to hashed version"""
        hashed_password = AuthService.hash_password(plain_password)
        AuthService.get_db().users.update_one(
            {"_id": user_id},
            {
                "$set": {"password": hashed_password},
                "$unset": {"password_hash": ""}
            }
        )
        logger.info(f"Password migrated for user {user_id}")
    
    @staticmethod
    def create_email_verification_token(user_id: str) -> str:
        """Create email verification token"""
        token = secrets.token_urlsafe(32)
        
        AuthService.get_db().email_verification_tokens.insert_one({
            "user_id": user_id,
            "token": token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=24)
        })
        
        return token
    
    @staticmethod
    def send_verification_email(email: str, token: str) -> bool:
        """Send verification email"""
        try:
            from flask_mail import Message
            
            verification_url = f"{current_app.config['FRONTEND_URL']}/verify-email?token={token}"
            
            msg = Message(
                subject="Verify Your Email - NAZMI Boutique",
                recipients=[email],
                html=f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2>Welcome to NAZMI Boutique!</h2>
                    <p>Please verify your email address by clicking the button below:</p>
                    <a href="{verification_url}" 
                       style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 4px; display: inline-block;">
                        Verify Email
                    </a>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you didn't create an account, please ignore this email.</p>
                </div>
                """
            )
            
            current_app.mail.send(msg)
            logger.info(f"Verification email sent to {email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send verification email to {email}: {str(e)}")
            return False


def token_required(f):
    """Decorator to require valid JWT token"""
    from functools import wraps
    
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Bearer token required"}), 401
        
        token = auth_header.replace("Bearer ", "").strip()
        
        try:
            payload = AuthService.decode_token(token)
            user_id = payload.get("user_id")
            
            if not user_id:
                return jsonify({"error": "Invalid token payload"}), 401
            
            user = AuthService.get_db().users.find_one({
                "_id": ObjectId(user_id),
                "is_active": True
            })
            
            if not user:
                return jsonify({"error": "User not found or inactive"}), 401
            
            # Add user to kwargs for the route function
            return f(user, *args, **kwargs)
            
        except ValueError as e:
            return jsonify({"error": str(e)}), 401
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return jsonify({"error": "Token validation failed"}), 401
    
    return decorated


@auth_bp.route("/register", methods=["POST"])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json(silent=True) or {}
        
        # Extract and validate input
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "").strip()
        phone = (data.get("phone") or "").strip()
        
        # Validation
        if not all([username, email, password]):
            return jsonify({"error": "Username, email, and password are required"}), 400
        
        if not AuthService.validate_email(email):
            return jsonify({"error": "Please enter a valid email address"}), 400
        
        if phone and not AuthService.validate_phone(phone):
            return jsonify({"error": "Please enter a valid phone number"}), 400
        
        is_valid, password_error = AuthService.validate_password(password)
        if not is_valid:
            return jsonify({"error": password_error}), 400
        
        # Check for existing user
        db = AuthService.get_db()
        
        if db.users.find_one({"email": email}):
            return jsonify({"error": "User already exists with this email"}), 409
        
        if db.users.find_one({"username": username}):
            return jsonify({"error": "Username already taken"}), 409
        
        if phone and db.users.find_one({"profile.phone": phone}):
            return jsonify({"error": "Phone number already registered"}), 409
        
        # Create user document
        user_data = {
            "username": username,
            "email": email,
            "password": AuthService.hash_password(password),
            "is_active": True,
            "is_admin": False,
            "is_verified": False,
            "profile": {
                "phone": phone,
                "full_name": data.get("full_name", ""),
                "address": {}
            },
            "preferences": {
                "email_notifications": True,
                "sms_notifications": False
            },
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Insert user
        result = db.users.insert_one(user_data)
        user_id = str(result.inserted_id)
        
        # Create verification token and send email
        verification_token = AuthService.create_email_verification_token(user_id)
        email_sent = AuthService.send_verification_email(email, verification_token)
        
        # Generate auth token
        auth_token = AuthService.create_token(user_id)
        
        return jsonify({
            "message": "User registered successfully. Please check your email for verification.",
            "token": auth_token,
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "is_verified": False,
                "profile": user_data["profile"]
            },
            "email_sent": email_sent
        }), 201
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({"error": "Registration failed"}), 500


@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    """Verify email address with token"""
    try:
        data = request.get_json(silent=True) or {}
        token = data.get("token", "").strip()
        
        if not token:
            return jsonify({"error": "Verification token is required"}), 400
        
        db = AuthService.get_db()
        
        # Find and validate token
        verification = db.email_verification_tokens.find_one({
            "token": token,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not verification:
            return jsonify({"error": "Invalid or expired verification token"}), 400
        
        user_id = verification["user_id"]
        
        # Update user verification status
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "is_verified": True,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({"error": "User not found"}), 404
        
        # Delete used token
        db.email_verification_tokens.delete_one({"token": token})
        
        # Get updated user
        user = db.users.find_one({"_id": ObjectId(user_id)})
        
        return jsonify({
            "message": "Email verified successfully",
            "user": {
                "id": user_id,
                "username": user.get("username"),
                "email": user.get("email"),
                "is_verified": True
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        return jsonify({"error": "Email verification failed"}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    """User login endpoint"""
    try:
        data = request.get_json(silent=True) or {}
        
        identifier = (data.get("email") or data.get("phone") or "").strip().lower()
        password = data.get("password", "").strip()
        
        if not identifier or not password:
            return jsonify({"error": "Email/phone and password are required"}), 400
        
        db = AuthService.get_db()
        
        # Find user by email or phone
        user = db.users.find_one({
            "$or": [
                {"email": identifier},
                {"profile.phone": identifier}
            ],
            "is_active": True
        })
        
        if not user:
            return jsonify({"error": "Invalid email/phone or password"}), 401
        
        # Verify password
        stored_hash = user.get("password") or user.get("password_hash", "")
        
        if not AuthService.verify_password(stored_hash, password):
            return jsonify({"error": "Invalid email/phone or password"}), 401
        
        # Migrate password if it's stored in plain text
        if not stored_hash.startswith(('pbkdf2:', 'scrypt:', 'bcrypt:')):
            AuthService.migrate_password(user["_id"], password)
        
        # Generate token
        token = AuthService.create_token(str(user["_id"]))
        
        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": {
                "id": str(user["_id"]),
                "username": user.get("username"),
                "email": user.get("email"),
                "is_verified": user.get("is_verified", False),
                "is_admin": user.get("is_admin", False),
                "profile": user.get("profile", {})
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Login failed"}), 500


@auth_bp.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    """Get user profile"""
    try:
        return jsonify({
            "user": {
                "id": str(current_user["_id"]),
                "username": current_user.get("username"),
                "email": current_user.get("email"),
                "is_verified": current_user.get("is_verified", False),
                "is_admin": current_user.get("is_admin", False),
                "profile": current_user.get("profile", {}),
                "preferences": current_user.get("preferences", {}),
                "created_at": current_user.get("created_at").isoformat() if current_user.get("created_at") else None
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get profile error: {str(e)}")
        return jsonify({"error": "Failed to fetch profile"}), 500


@auth_bp.route("/profile", methods=["PUT"])
@token_required
def update_profile(current_user):
    """Update user profile"""
    try:
        data = request.get_json(silent=True) or {}
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        db = AuthService.get_db()
        update_data = {}
        profile_update = current_user.get("profile", {}).copy()
        
        # Update basic fields
        if "username" in data:
            username = data["username"].strip()
            if len(username) < 3:
                return jsonify({"error": "Username must be at least 3 characters"}), 400
            
            # Check if username is available
            existing = db.users.find_one({
                "username": username,
                "_id": {"$ne": current_user["_id"]}
            })
            if existing:
                return jsonify({"error": "Username already taken"}), 409
            
            update_data["username"] = username
        
        # Update profile fields
        profile_fields = ["full_name", "phone", "date_of_birth", "gender"]
        for field in profile_fields:
            if field in data:
                if field == "phone" and data[field]:
                    if not AuthService.validate_phone(data[field]):
                        return jsonify({"error": "Invalid phone number format"}), 400
                    # Check if phone is available
                    existing = db.users.find_one({
                        "profile.phone": data[field],
                        "_id": {"$ne": current_user["_id"]}
                    })
                    if existing:
                        return jsonify({"error": "Phone number already registered"}), 409
                
                profile_update[field] = data[field]
        
        # Update address if provided
        if "address" in data and isinstance(data["address"], dict):
            profile_update["address"] = {
                **profile_update.get("address", {}),
                **data["address"]
            }
        
        if profile_update != current_user.get("profile", {}):
            update_data["profile"] = profile_update
        
        # Update preferences
        if "preferences" in data and isinstance(data["preferences"], dict):
            update_data["preferences"] = {
                **current_user.get("preferences", {}),
                **data["preferences"]
            }
        
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
                "profile": updated_user.get("profile", {}),
                "preferences": updated_user.get("preferences", {})
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Update profile error: {str(e)}")
        return jsonify({"error": "Failed to update profile"}), 500


@auth_bp.route("/change-password", methods=["POST"])
@token_required
def change_password(current_user):
    """Change user password"""
    try:
        data = request.get_json(silent=True) or {}
        
        current_password = data.get("current_password", "").strip()
        new_password = data.get("new_password", "").strip()
        
        if not current_password or not new_password:
            return jsonify({"error": "Current password and new password are required"}), 400
        
        # Verify current password
        stored_hash = current_user.get("password") or current_user.get("password_hash", "")
        if not AuthService.verify_password(stored_hash, current_password):
            return jsonify({"error": "Current password is incorrect"}), 401
        
        # Validate new password
        is_valid, password_error = AuthService.validate_password(new_password)
        if not is_valid:
            return jsonify({"error": password_error}), 400
        
        # Update password
        db = AuthService.get_db()
        db.users.update_one(
            {"_id": current_user["_id"]},
            {
                "$set": {
                    "password": AuthService.hash_password(new_password),
                    "updated_at": datetime.utcnow()
                },
                "$unset": {"password_hash": ""}
            }
        )
        
        return jsonify({
            "message": "Password changed successfully"
        }), 200
        
    except Exception as e:
        logger.error(f"Change password error: {str(e)}")
        return jsonify({"error": "Failed to change password"}), 500


@auth_bp.route("/refresh-token", methods=["POST"])
def refresh_token():
    """Refresh JWT token"""
    try:
        data = request.get_json(silent=True) or {}
        refresh_token = data.get("refresh_token", "").strip()
        
        if not refresh_token:
            return jsonify({"error": "Refresh token is required"}), 400
        
        # In a real implementation, you'd have a separate refresh token system
        # For now, we'll just validate the current token and issue a new one
        payload = AuthService.decode_token(refresh_token)
        user_id = payload.get("user_id")
        
        if not user_id:
            return jsonify({"error": "Invalid refresh token"}), 401
        
        user = AuthService.get_db().users.find_one({
            "_id": ObjectId(user_id),
            "is_active": True
        })
        
        if not user:
            return jsonify({"error": "User not found"}), 401
        
        # Issue new token
        new_token = AuthService.create_token(user_id)
        
        return jsonify({
            "token": new_token,
            "user": {
                "id": user_id,
                "username": user.get("username"),
                "email": user.get("email")
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Refresh token error: {str(e)}")
        return jsonify({"error": "Token refresh failed"}), 401