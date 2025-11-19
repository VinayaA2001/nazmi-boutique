from pathlib import Path

p = Path('Backend/app.py')
text = p.read_text(encoding='utf-8')
marker = '# ==================== AUTHENTICATION ====================\n'
start = text.index(marker)
sub = text[start:]
end_marker = '\n@app.route("/api/auth/forgot-password"'
end_rel = sub.index(end_marker)
end = start + end_rel

new_block = '''# ==================== AUTHENTICATION ====================
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

        verify_url = f"{app.config["FRONTEND_URL"]}/verify-email?token={verify_token}"
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
            "expires_at": {"": datetime.utcnow()},
        })

        if not verification:
            return jsonify({
                "error": "Invalid or expired verification token",
                "code": "INVALID_TOKEN",
            }), 400

        user_id = verification["user_id"]

        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"": {"is_verified": True, "updated_at": datetime.utcnow()}},
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

        verify_url = f"{app.config["FRONTEND_URL"]}/verify-email?token={verify_token}"
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
'''

text = text[:start] + new_block + text[end:]
p.write_text(text, encoding='utf-8')
