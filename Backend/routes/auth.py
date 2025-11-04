from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
import secrets
import re
from models.User import User, db, bcrypt
from models.PasswordReset import PasswordReset

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({
                'success': False,
                'message': 'Email is required'
            }), 400
        
        # Validate email format
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
            return jsonify({
                'success': False,
                'message': 'Invalid email format'
            }), 400
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        # For security, always return success even if email doesn't exist
        if not user:
            return jsonify({
                'success': True,
                'message': 'If an account with that email exists, a reset link has been sent'
            }), 200
        
        # Generate secure token
        token = secrets.token_urlsafe(32)
        
        # Create password reset entry
        reset_entry = PasswordReset(user_id=user.id, token=token)
        db.session.add(reset_entry)
        db.session.commit()
        
        # In production, you would send an email here
        reset_link = f"{current_app.config.get('FRONTEND_URL', 'http://localhost:3000')}/auth/resetpassword?token={token}"
        
        print(f"Password reset link for {email}: {reset_link}")  # For development
        
        return jsonify({
            'success': True,
            'message': 'If an account with that email exists, a reset link has been sent',
            'reset_link': reset_link if current_app.config.get('DEBUG') else None
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Forgot password error: {str(e)}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@auth_bp.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        token = data.get('token', '').strip()
        new_password = data.get('newPassword', '').strip()
        
        # Validate input
        if not token or not new_password:
            return jsonify({
                'success': False,
                'message': 'Token and new password are required'
            }), 400
        
        # Clean up expired tokens first
        PasswordReset.cleanup_expired_tokens()
        
        # Find valid reset token
        reset_entry = PasswordReset.query.filter_by(token=token).first()
        
        if not reset_entry:
            return jsonify({
                'success': False,
                'message': 'Invalid or expired reset token'
            }), 400
        
        if reset_entry.is_expired():
            # Delete expired token
            db.session.delete(reset_entry)
            db.session.commit()
            return jsonify({
                'success': False,
                'message': 'Reset token has expired'
            }), 400
        
        # Find user
        user = User.query.get(reset_entry.user_id)
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 400
        
        # Validate password strength
        if len(new_password) < 8:
            return jsonify({
                'success': False,
                'message': 'Password must be at least 8 characters long'
            }), 400
        
        if not re.search(r'[A-Z]', new_password) or not re.search(r'[a-z]', new_password) or not re.search(r'\d', new_password):
            return jsonify({
                'success': False,
                'message': 'Password must include uppercase letters, lowercase letters, and numbers'
            }), 400
        
        # Update user password
        user.password = new_password
        user.last_password_change = datetime.utcnow()
        
        # Delete the used reset token
        db.session.delete(reset_entry)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Password reset successfully'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Reset password error: {str(e)}')
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500

@auth_bp.route('/api/auth/validate-reset-token', methods=['POST'])
def validate_reset_token():
    """Endpoint to validate if a reset token is still valid"""
    try:
        data = request.get_json()
        token = data.get('token', '').strip()
        
        if not token:
            return jsonify({
                'success': False,
                'message': 'Token is required'
            }), 400
        
        # Clean up expired tokens first
        PasswordReset.cleanup_expired_tokens()
        
        # Find valid reset token
        reset_entry = PasswordReset.query.filter_by(token=token).first()
        
        if not reset_entry or reset_entry.is_expired():
            return jsonify({
                'success': False,
                'message': 'Invalid or expired reset token'
            }), 400
        
        return jsonify({
            'success': True,
            'message': 'Token is valid'
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Validate token error: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'Internal server error'
        }), 500