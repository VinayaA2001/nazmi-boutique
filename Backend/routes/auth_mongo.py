from __future__ import annotations
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
import jwt, secrets, re

auth_bp = Blueprint("auth_mongo", __name__, url_prefix="/api/auth")

def _db():
    # use the PyMongo instance attached in app.py
    return current_app.mongo.db

def _jwt_secret() -> str:
    return current_app.config.get("JWT_SECRET") or current_app.config["SECRET_KEY"]

def _make_jwt(payload: dict, days: int = 7) -> str:
    p = payload.copy()
    p["exp"] = datetime.utcnow() + timedelta(days=days)
    return jwt.encode(p, _jwt_secret(), algorithm="HS256")

def _decode_jwt(token: str) -> dict:
    return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])

def _looks_pbkdf2(v: str) -> bool:
    return isinstance(v, str) and v.startswith("pbkdf2:")

def _looks_scrypt(v: str) -> bool:
    return isinstance(v, str) and v.startswith("scrypt:")

def _verify_any(stored: str, provided: str) -> bool:
    if not isinstance(stored, str):
        return False
    if _looks_pbkdf2(stored) or _looks_scrypt(stored):
        return check_password_hash(stored, provided)
    return stored == provided

def _check_and_migrate_password(user: dict, provided: str) -> bool:
    uid = user["_id"]
    cur = user.get("password") if isinstance(user.get("password"), str) else user.get("password_hash")
    src = "password" if isinstance(user.get("password"), str) else ("password_hash" if isinstance(user.get("password_hash"), str) else None)
    if not cur:
        return False
    ok = _verify_any(cur, provided)
    if not ok:
        return False
    if not (_looks_pbkdf2(user.get("password", "")) or _looks_scrypt(user.get("password", ""))):
        new_hash = generate_password_hash(provided)
        upd = {"$set": {"password": new_hash}}
        if src == "password_hash":
            upd["$unset"] = {"password_hash": ""}
        _db().users.update_one({"_id": uid}, upd)
    return True

@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    if not username or not email or not password:
        return jsonify({"error": "username, email, password are required"}), 400
    if _db().users.find_one({"email": email}):
        return jsonify({"error": "User already exists with this email"}), 400

    doc = {
        "username": username,
        "email": email,
        "password": generate_password_hash(password),
        "created_at": datetime.utcnow(),
        "is_active": True,
        "is_admin": False,
        "profile": {"phone": "", "address": ""},
    }
    res = _db().users.insert_one(doc)
    token = _make_jwt({"user_id": str(res.inserted_id)})
    return jsonify({"message": "User registered successfully",
                    "token": token,
                    "user": {"id": str(res.inserted_id), "username": username, "email": email}}), 200

@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    idf = (data.get("email") or data.get("phone") or "").strip().lower()
    pwd = data.get("password")
    if not idf or not pwd:
        return jsonify({"error": "Email/phone and password are required"}), 400

    user = _db().users.find_one({"$or": [{"email": idf}, {"profile.phone": idf}]})
    if not user or not _check_and_migrate_password(user, pwd):
        return jsonify({"error": "Invalid email or password"}), 401

    token = _make_jwt({"user_id": str(user["_id"])})
    return jsonify({"message": "Login successful",
                    "token": token,
                    "user": {"id": str(user["_id"]),
                             "username": user.get("username", ""),
                             "email": user.get("email", "")}})

@auth_bp.get("/profile")
def profile():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify({"error": "Token is missing"}), 401
    try:
        payload = _decode_jwt(auth.replace("Bearer ", ""))
        u = _db().users.find_one({"_id": ObjectId(payload["user_id"])})
        if not u:
            return jsonify({"error": "User not found"}), 401
        return jsonify({"user": {"id": str(u["_id"]),
                                 "username": u.get("username", ""),
                                 "email": u.get("email", ""),
                                 "profile": u.get("profile", {})}})
    except Exception as e:
        return jsonify({"error": "Token invalid", "details": str(e)}), 401
