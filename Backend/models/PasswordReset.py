# C:\NAZMI_BOUTIQUE\Backend\models\PasswordReset.py

from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class PasswordReset(db.Model):
    __tablename__ = "password_resets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token = db.Column(db.String(255), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship → belongs to User
    user = db.relationship(
        "User",
        backref=db.backref("password_resets", lazy=True, cascade="all, delete-orphan")
    )

    def __init__(self, user_id, token, expires_in_hours=1):
        self.user_id = user_id
        self.token = token
        self.expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

    # --- Utility Methods --------------------------------------------------

    def is_expired(self):
        """Check if this reset request has expired."""
        return datetime.utcnow() > self.expires_at

    def to_dict(self):
        """Return a clean dictionary for API responses."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "token": self.token,
            "expires_at": self.expires_at.isoformat(),
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def cleanup_expired_tokens(cls):
        """
        Delete all expired tokens from DB.
        Returns number of deleted rows.
        """
        now = datetime.utcnow()
        expired = cls.query.filter(cls.expires_at < now).all()

        for entry in expired:
            db.session.delete(entry)

        db.session.commit()
        return len(expired)
