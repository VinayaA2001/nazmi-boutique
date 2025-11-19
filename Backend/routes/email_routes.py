import logging
from typing import Dict, Any, Optional, List
from flask import Blueprint, request, jsonify, current_app
from flask_mail import Message
from datetime import datetime
# Configure logger
logger = logging.getLogger(__name__)

# Blueprint
email_bp = Blueprint("email", __name__, url_prefix="/api/email")


class EmailService:
    """Service class for email business logic"""
    
    @staticmethod
    def get_mail():
        """Get mail instance from app extensions"""
        return current_app.extensions.get("mail")
    
    @staticmethod
    def validate_email_data(data: Dict[str, Any]) -> tuple[bool, Optional[str], Optional[Dict]]:
        """Validate email request data"""
        if not data:
            return False, "No JSON data provided", None
        
        to = data.get("to", "").strip()
        subject = data.get("subject", "").strip()
        text = data.get("text", "").strip()
        html = data.get("html", "").strip()
        
        # Validate required fields
        if not to:
            return False, "Recipient email (to) is required", None
        
        # Validate email format
        if not EmailService.is_valid_email(to):
            return False, "Invalid recipient email format", None
        
        # Validate subject
        if not subject:
            return False, "Email subject is required", None
        
        # Validate content
        if not text and not html:
            return False, "Email content (text or html) is required", None
        
        # Prepare validated data
        validated_data = {
            "to": to,
            "subject": subject,
            "text": text,
            "html": html
        }
        
        return True, None, validated_data
    
    @staticmethod
    def is_valid_email(email: str) -> bool:
        """Basic email validation"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    @staticmethod
    def send_email(to: str, subject: str, text: str = "", html: str = "") -> tuple[bool, Optional[str]]:
        """Send email with proper error handling"""
        try:
            mail = EmailService.get_mail()
            if not mail:
                return False, "Email service not configured"
            
            msg = Message(
                subject=subject,
                recipients=[to],
                body=text,
                html=html
            )
            
            mail.send(msg)
            logger.info(f"Email sent successfully to {to}")
            return True, None
            
        except Exception as e:
            error_msg = f"Failed to send email to {to}: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    @staticmethod
    def send_template_email(
        to: str, 
        template_type: str, 
        template_data: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """Send templated emails for common use cases"""
        templates = {
            "welcome": {
                "subject": "Welcome to NAZMI Boutique!",
                "text": f"""
                Welcome {template_data.get('name', 'there')}!
                
                Thank you for joining NAZMI Boutique. We're excited to have you as part of our community.
                
                Start exploring our exclusive collection of fashion items.
                
                Best regards,
                The NAZMI Boutique Team
                """,
                "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2 style="color: #333;">Welcome to NAZMI Boutique!</h2>
                    <p>Hello <strong>{template_data.get('name', 'there')}</strong>,</p>
                    <p>Thank you for joining NAZMI Boutique. We're excited to have you as part of our community.</p>
                    <p>Start exploring our exclusive collection of fashion items.</p>
                    <div style="margin: 20px 0;">
                        <a href="{current_app.config.get('FRONTEND_URL', '')}/shop" 
                           style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 4px; display: inline-block;">
                            Start Shopping
                        </a>
                    </div>
                    <p>Best regards,<br>The NAZMI Boutique Team</p>
                </div>
                """
            },
            "order_confirmation": {
                "subject": f"Order Confirmation - #{template_data.get('order_number', '')}",
                "text": f"""
                Order Confirmation
                
                Hello {template_data.get('customer_name', 'Customer')},
                
                Thank you for your order! Here are your order details:
                
                Order Number: {template_data.get('order_number', '')}
                Order Date: {template_data.get('order_date', '')}
                Total Amount: {template_data.get('total_amount', '')}
                
                Items:
                {template_data.get('items_text', '')}
                
                We'll notify you when your order ships.
                
                Thank you for shopping with NAZMI Boutique!
                """,
                "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2 style="color: #333;">Order Confirmation</h2>
                    <p>Hello <strong>{template_data.get('customer_name', 'Customer')}</strong>,</p>
                    <p>Thank you for your order! Here are your order details:</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
                        <p><strong>Order Number:</strong> {template_data.get('order_number', '')}</p>
                        <p><strong>Order Date:</strong> {template_data.get('order_date', '')}</p>
                        <p><strong>Total Amount:</strong> {template_data.get('total_amount', '')}</p>
                    </div>
                    
                    <h3>Order Items:</h3>
                    {template_data.get('items_html', '')}
                    
                    <p>We'll notify you when your order ships.</p>
                    <p>Thank you for shopping with <strong>NAZMI Boutique</strong>!</p>
                </div>
                """
            },
            "password_reset": {
                "subject": "Password Reset Request - NAZMI Boutique",
                "text": f"""
                Password Reset Request
                
                You requested to reset your password. Click the link below to proceed:
                
                {template_data.get('reset_url', '')}
                
                This link will expire in 1 hour.
                
                If you didn't request this, please ignore this email.
                
                NAZMI Boutique Team
                """,
                "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p>You requested to reset your password. Click the button below to proceed:</p>
                    
                    <div style="margin: 20px 0;">
                        <a href="{template_data.get('reset_url', '')}" 
                           style="background-color: #007bff; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 4px; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        This link will expire in 1 hour.<br>
                        If you didn't request this, please ignore this email.
                    </p>
                    
                    <p>NAZMI Boutique Team</p>
                </div>
                """
            }
        }
        
        template = templates.get(template_type)
        if not template:
            return False, f"Unknown template type: {template_type}"
        
        return EmailService.send_email(
            to=to,
            subject=template["subject"],
            text=template["text"],
            html=template["html"]
        )


@email_bp.route("/send", methods=["POST"])
def send_email():
    """
    Send email endpoint
    Body: {
        "to": "user@example.com",
        "subject": "Hello",
        "text": "Hi there", 
        "html": "<b>Hi</b>"
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        
        # Validate request data
        is_valid, error_msg, validated_data = EmailService.validate_email_data(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        # Send email
        success, error = EmailService.send_email(**validated_data)
        
        if success:
            return jsonify({
                "success": True,
                "message": "Email sent successfully",
                "sent_to": validated_data["to"]
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": error or "Failed to send email"
            }), 500
            
    except Exception as e:
        logger.error(f"Email send endpoint error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500


@email_bp.route("/send-template", methods=["POST"])
def send_template_email():
    """
    Send templated email endpoint
    Body: {
        "to": "user@example.com",
        "template_type": "welcome|order_confirmation|password_reset",
        "template_data": {
            "name": "John Doe",
            "order_number": "ORD123",
            ...
        }
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        
        # Validate required fields
        to = data.get("to", "").strip()
        template_type = data.get("template_type", "").strip()
        template_data = data.get("template_data", {})
        
        if not to:
            return jsonify({"error": "Recipient email (to) is required"}), 400
        
        if not template_type:
            return jsonify({"error": "Template type is required"}), 400
        
        if not EmailService.is_valid_email(to):
            return jsonify({"error": "Invalid recipient email format"}), 400
        
        # Send templated email
        success, error = EmailService.send_template_email(to, template_type, template_data)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"{template_type.replace('_', ' ').title()} email sent successfully",
                "sent_to": to,
                "template_type": template_type
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": error or f"Failed to send {template_type} email"
            }), 500
            
    except Exception as e:
        logger.error(f"Template email send error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500


@email_bp.route("/bulk-send", methods=["POST"])
def send_bulk_emails():
    """
    Send bulk emails endpoint
    Body: {
        "recipients": ["user1@example.com", "user2@example.com"],
        "subject": "Newsletter",
        "text": "Content",
        "html": "<b>Content</b>"
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        
        recipients = data.get("recipients", [])
        subject = data.get("subject", "").strip()
        text = data.get("text", "").strip()
        html = data.get("html", "").strip()
        
        # Validate input
        if not recipients:
            return jsonify({"error": "Recipients list is required"}), 400
        
        if not isinstance(recipients, list):
            return jsonify({"error": "Recipients must be a list"}), 400
        
        if not subject:
            return jsonify({"error": "Email subject is required"}), 400
        
        if not text and not html:
            return jsonify({"error": "Email content (text or html) is required"}), 400
        
        # Validate each email
        invalid_emails = [email for email in recipients if not EmailService.is_valid_email(email)]
        if invalid_emails:
            return jsonify({
                "error": f"Invalid email addresses: {', '.join(invalid_emails[:3])}" + 
                        ("..." if len(invalid_emails) > 3 else "")
            }), 400
        
        # Limit bulk send to prevent abuse
        max_recipients = current_app.config.get("EMAIL_BULK_MAX_RECIPIENTS", 50)
        if len(recipients) > max_recipients:
            return jsonify({
                "error": f"Too many recipients. Maximum allowed: {max_recipients}"
            }), 400
        
        # Send emails
        results = {
            "successful": [],
            "failed": []
        }
        
        for recipient in recipients:
            success, error = EmailService.send_email(recipient, subject, text, html)
            if success:
                results["successful"].append(recipient)
            else:
                results["failed"].append({
                    "email": recipient,
                    "error": error
                })
        
        return jsonify({
            "success": True,
            "message": f"Bulk email send completed",
            "results": results,
            "summary": {
                "total": len(recipients),
                "successful": len(results["successful"]),
                "failed": len(results["failed"])
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Bulk email send error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500


@email_bp.route("/test", methods=["GET"])
def test_email():
    """Test endpoint to verify email service is working"""
    try:
        # Check if mail service is configured
        mail = EmailService.get_mail()
        if not mail:
            return jsonify({
                "status": "error",
                "message": "Email service not configured"
            }), 503
        
        # Return service status
        config = current_app.config
        email_config = {
            "mail_server": config.get("MAIL_SERVER"),
            "mail_port": config.get("MAIL_PORT"),
            "mail_use_tls": config.get("MAIL_USE_TLS"),
            "mail_username": config.get("MAIL_USERNAME"),
            "default_sender": config.get("MAIL_DEFAULT_SENDER")
        }
        
        return jsonify({
            "status": "operational",
            "service": "Email Service",
            "endpoints": {
                "send_email": "POST /api/email/send",
                "send_template": "POST /api/email/send-template", 
                "bulk_send": "POST /api/email/bulk-send"
            },
            "configuration": email_config
        }), 200
        
    except Exception as e:
        logger.error(f"Email test endpoint error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@email_bp.route("/health", methods=["GET"])
def email_health():
    """Health check for email service"""
    try:
        mail = EmailService.get_mail()
        
        if not mail:
            return jsonify({
                "status": "unhealthy",
                "service": "email",
                "message": "Email service not configured"
            }), 503
        
        # Simple health check - try to create a message
        test_msg = Message(
            subject="Health Check",
            recipients=["test@example.com"],
            body="Health check message"
        )
        
        return jsonify({
            "status": "healthy", 
            "service": "email",
            "timestamp": datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Email health check error: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "service": "email",
            "error": str(e)
        }), 503


