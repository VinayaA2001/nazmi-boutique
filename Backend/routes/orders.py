import logging
import hmac
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
import razorpay

# Configure logger
logger = logging.getLogger(__name__)

# Blueprint
payment_bp = Blueprint('payments', __name__, url_prefix='/api/payments')


class PaymentService:
    """Service class for payment processing business logic"""
    
    @staticmethod
    def get_razorpay_client() -> razorpay.Client:
        """Get Razorpay client instance"""
        try:
            return razorpay.Client(auth=(
                current_app.config['RAZORPAY_KEY_ID'],
                current_app.config['RAZORPAY_KEY_SECRET']
            ))
        except Exception as e:
            logger.error(f"Razorpay client initialization failed: {str(e)}")
            raise
    
    @staticmethod
    def get_db():
        """Get database instance"""
        return current_app.mongo.db
    
    @staticmethod
    def validate_order_creation_data(data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """Validate order creation request data"""
        if not data:
            return False, "No JSON data provided", None
        
        amount = data.get('amount')
        order_id = data.get('order_id')
        
        # Validate required fields
        if not amount:
            return False, "Amount is required", None
        
        if not order_id:
            return False, "Order ID is required", None
        
        # Validate amount
        try:
            amount = int(amount)
            if amount < 100:  # Minimum 1 INR in paise
                return False, "Amount must be at least 100 paise (1 INR)", None
        except (ValueError, TypeError):
            return False, "Invalid amount format", None
        
        # Validate order exists
        db = PaymentService.get_db()
        order = db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            return False, "Order not found", None
        
        if order.get('payment_status') == 'paid':
            return False, "Order already paid", None
        
        validated_data = {
            'amount': amount,
            'order_id': order_id,
            'order_data': order
        }
        
        return True, None, validated_data
    
    @staticmethod
    def validate_payment_verification_data(data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """Validate payment verification request data"""
        if not data:
            return False, "No JSON data provided", None
        
        required_fields = [
            'razorpay_payment_id',
            'razorpay_order_id', 
            'razorpay_signature',
            'order_id'
        ]
        
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return False, f"Missing required fields: {', '.join(missing_fields)}", None
        
        validated_data = {
            'razorpay_payment_id': data['razorpay_payment_id'],
            'razorpay_order_id': data['razorpay_order_id'],
            'razorpay_signature': data['razorpay_signature'],
            'order_id': data['order_id']
        }
        
        return True, None, validated_data
    
    @staticmethod
    def verify_payment_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
        """Verify Razorpay payment signature"""
        try:
            key_secret = current_app.config['RAZORPAY_KEY_SECRET']
            
            # Create the expected signature
            message = f"{razorpay_order_id}|{razorpay_payment_id}"
            generated_signature = hmac.new(
                key_secret.encode(),
                message.encode(),
                hashlib.sha256
            ).hexdigest()
            
            # Compare signatures
            is_valid = hmac.compare_digest(generated_signature, razorpay_signature)
            
            if not is_valid:
                logger.warning(f"Invalid signature for order {razorpay_order_id}")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Signature verification failed: {str(e)}")
            return False
    
    @staticmethod
    def fetch_payment_details(payment_id: str) -> Optional[Dict[str, Any]]:
        """Fetch payment details from Razorpay"""
        try:
            client = PaymentService.get_razorpay_client()
            payment = client.payment.fetch(payment_id)
            return payment
        except Exception as e:
            logger.error(f"Failed to fetch payment details for {payment_id}: {str(e)}")
            return None
    
    @staticmethod
    def update_order_payment_success(order_id: str, payment_data: Dict[str, Any]) -> bool:
        """Update order with successful payment details"""
        try:
            db = PaymentService.get_db()
            
            update_data = {
                "$set": {
                    "payment_status": "paid",
                    "status": "confirmed",
                    "razorpay_payment_id": payment_data.get('razorpay_payment_id'),
                    "razorpay_order_id": payment_data.get('razorpay_order_id'),
                    "paid_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "payment_method": payment_data.get('payment_method', 'razorpay'),
                    "payment_details": {
                        "method": payment_data.get('method'),
                        "bank": payment_data.get('bank'),
                        "wallet": payment_data.get('wallet'),
                        "card_id": payment_data.get('card_id'),
                        "card_network": payment_data.get('card', {}).get('network'),
                        "card_type": payment_data.get('card', {}).get('type'),
                        "card_last4": payment_data.get('card', {}).get('last4')
                    }
                }
            }
            
            result = db.orders.update_one(
                {"_id": ObjectId(order_id)},
                update_data
            )
            
            if result.modified_count == 0:
                logger.error(f"Failed to update order {order_id} payment status")
                return False
            
            logger.info(f"Order {order_id} payment status updated to paid")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update order payment status for {order_id}: {str(e)}")
            return False
    
    @staticmethod
    def update_order_payment_failure(order_id: str, error_reason: str) -> bool:
        """Update order with payment failure details"""
        try:
            db = PaymentService.get_db()
            
            result = db.orders.update_one(
                {"_id": ObjectId(order_id)},
                {
                    "$set": {
                        "payment_status": "failed",
                        "status": "payment_failed",
                        "payment_error": error_reason,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Failed to update order payment failure for {order_id}: {str(e)}")
            return False
    
    @staticmethod
    def send_payment_confirmation_email(order_data: Dict[str, Any]) -> bool:
        """Send payment confirmation email"""
        try:
            from flask_mail import Message
            
            customer_email = order_data.get('customer_info', {}).get('email')
            if not customer_email:
                logger.warning("No customer email found for payment confirmation")
                return False
            
            mail = current_app.extensions.get("mail")
            if not mail:
                logger.warning("Email service not available")
                return False
            
            msg = Message(
                subject=f"Payment Confirmed - Order #{order_data.get('order_number')}",
                recipients=[customer_email],
                html=f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2 style="color: #4CAF50;">Payment Confirmed!</h2>
                    <p>Dear {order_data.get('customer_info', {}).get('name', 'Customer')},</p>
                    
                    <p>Your payment for order <strong>#{order_data.get('order_number')}</strong> has been successfully processed.</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3>Order Summary</h3>
                        <p><strong>Order Total:</strong> ₹{order_data.get('totals', {}).get('grand_total', 0):.2f}</p>
                        <p><strong>Payment Method:</strong> {order_data.get('payment_method', 'Online Payment')}</p>
                        <p><strong>Payment Date:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}</p>
                    </div>
                    
                    <p>We are now processing your order and will notify you when it ships.</p>
                    
                    <p>Thank you for shopping with <strong>NAZMI Boutique</strong>!</p>
                </div>
                """
            )
            
            mail.send(msg)
            logger.info(f"Payment confirmation email sent to {customer_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send payment confirmation email: {str(e)}")
            return False


@payment_bp.route('/create-order', methods=['POST'])
def create_razorpay_order():
    """Create Razorpay order for payment"""
    try:
        data = request.get_json(silent=True) or {}
        
        # Validate request data
        is_valid, error_msg, validated_data = PaymentService.validate_order_creation_data(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        amount = validated_data['amount']
        order_id = validated_data['order_id']
        order_data = validated_data['order_data']
        
        # Create Razorpay order
        client = PaymentService.get_razorpay_client()
        
        razorpay_order = client.order.create({
            "amount": amount,
            "currency": "INR",
            "receipt": order_data.get('order_number', f"order_{order_id}"),
            "payment_capture": 1,  # Auto capture payment
            "notes": {
                "order_id": order_id,
                "order_number": order_data.get('order_number'),
                "customer_email": order_data.get('customer_info', {}).get('email')
            }
        })
        
        # Update order with Razorpay order ID
        db = PaymentService.get_db()
        db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {
                "$set": {
                    "razorpay_order_id": razorpay_order['id'],
                    "payment_status": "pending",
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"Razorpay order created: {razorpay_order['id']} for order {order_id}")
        
        return jsonify({
            "success": True,
            "razorpay_order_id": razorpay_order['id'],
            "amount": razorpay_order['amount'],
            "currency": razorpay_order['currency'],
            "key": current_app.config['RAZORPAY_KEY_ID'],
            "order_id": order_id
        }), 200
        
    except razorpay.errors.BadRequestError as e:
        logger.error(f"Razorpay bad request: {str(e)}")
        return jsonify({"error": "Invalid payment request"}), 400
    except Exception as e:
        logger.error(f"Create Razorpay order error: {str(e)}")
        return jsonify({"error": "Failed to create payment order"}), 500


@payment_bp.route('/verify', methods=['POST'])
def verify_payment():
    """Verify Razorpay payment signature and update order"""
    try:
        data = request.get_json(silent=True) or {}
        
        # Validate request data
        is_valid, error_msg, validated_data = PaymentService.validate_payment_verification_data(data)
        if not is_valid:
            return jsonify({"error": error_msg}), 400
        
        razorpay_payment_id = validated_data['razorpay_payment_id']
        razorpay_order_id = validated_data['razorpay_order_id']
        razorpay_signature = validated_data['razorpay_signature']
        order_id = validated_data['order_id']
        
        # Verify payment signature
        is_signature_valid = PaymentService.verify_payment_signature(
            razorpay_order_id, razorpay_payment_id, razorpay_signature
        )
        
        if not is_signature_valid:
            PaymentService.update_order_payment_failure(order_id, "Invalid payment signature")
            return jsonify({"error": "Payment verification failed: Invalid signature"}), 400
        
        # Fetch payment details from Razorpay
        payment_details = PaymentService.fetch_payment_details(razorpay_payment_id)
        if not payment_details:
            PaymentService.update_order_payment_failure(order_id, "Could not fetch payment details")
            return jsonify({"error": "Could not verify payment status"}), 400
        
        # Check if payment was successful
        if payment_details.get('status') != 'captured':
            error_reason = payment_details.get('error_description', 'Payment not captured')
            PaymentService.update_order_payment_failure(order_id, error_reason)
            return jsonify({"error": f"Payment failed: {error_reason}"}), 400
        
        # Update order with successful payment
        payment_data = {
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_order_id': razorpay_order_id,
            'payment_method': payment_details.get('method'),
            'method': payment_details.get('method'),
            'bank': payment_details.get('bank'),
            'wallet': payment_details.get('wallet'),
            'card': payment_details.get('card')
        }
        
        success = PaymentService.update_order_payment_success(order_id, payment_data)
        if not success:
            return jsonify({"error": "Failed to update order status"}), 500
        
        # Get updated order data
        db = PaymentService.get_db()
        updated_order = db.orders.find_one({"_id": ObjectId(order_id)})
        
        # Send confirmation email
        PaymentService.send_payment_confirmation_email(updated_order)
        
        logger.info(f"Payment verified successfully for order {order_id}")
        
        return jsonify({
            "success": True,
            "message": "Payment verified successfully",
            "order_id": order_id,
            "order_number": updated_order.get('order_number'),
            "payment_id": razorpay_payment_id,
            "amount": payment_details.get('amount') / 100  # Convert paise to rupees
        }), 200
        
    except Exception as e:
        logger.error(f"Payment verification error: {str(e)}")
        return jsonify({"error": "Payment verification failed"}), 500


@payment_bp.route('/payment-methods', methods=['GET'])
def get_payment_methods():
    """Get available payment methods"""
    try:
        # In a real implementation, you might fetch this from Razorpay API
        # or based on your business rules
        
        payment_methods = [
            {
                "id": "card",
                "name": "Credit/Debit Card",
                "description": "Pay with Visa, MasterCard, RuPay, etc.",
                "enabled": True
            },
            {
                "id": "netbanking",
                "name": "Net Banking", 
                "description": "Pay using your bank account",
                "enabled": True
            },
            {
                "id": "upi",
                "name": "UPI",
                "description": "Pay using UPI ID",
                "enabled": True
            },
            {
                "id": "wallet",
                "name": "Digital Wallet",
                "description": "Pay using Paytm, PhonePe, etc.",
                "enabled": True
            }
        ]
        
        return jsonify({
            "success": True,
            "payment_methods": payment_methods
        }), 200
        
    except Exception as e:
        logger.error(f"Get payment methods error: {str(e)}")
        return jsonify({"error": "Failed to fetch payment methods"}), 500


@payment_bp.route('/order/<order_id>/payment-status', methods=['GET'])
def get_payment_status(order_id):
    """Get payment status for an order"""
    try:
        db = PaymentService.get_db()
        
        order = db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            return jsonify({"error": "Order not found"}), 404
        
        payment_status = {
            "order_id": order_id,
            "order_number": order.get('order_number'),
            "payment_status": order.get('payment_status', 'pending'),
            "status": order.get('status', 'pending'),
            "amount": order.get('totals', {}).get('grand_total', 0),
            "razorpay_order_id": order.get('razorpay_order_id'),
            "paid_at": order.get('paid_at')
        }
        
        # If payment is pending and Razorpay order exists, check with Razorpay
        if (order.get('payment_status') == 'pending' and 
            order.get('razorpay_order_id') and
            order.get('razorpay_payment_id')):
            
            try:
                payment_details = PaymentService.fetch_payment_details(order['razorpay_payment_id'])
                if payment_details:
                    payment_status['razorpay_status'] = payment_details.get('status')
                    payment_status['payment_method'] = payment_details.get('method')
            except Exception as e:
                logger.warning(f"Could not fetch Razorpay status for {order_id}: {str(e)}")
        
        return jsonify({
            "success": True,
            "payment_status": payment_status
        }), 200
        
    except Exception as e:
        logger.error(f"Get payment status error for {order_id}: {str(e)}")
        return jsonify({"error": "Failed to fetch payment status"}), 500


@payment_bp.route('/webhook', methods=['POST'])
def razorpay_webhook():
    """Handle Razorpay webhook events"""
    try:
        webhook_secret = current_app.config.get('RAZORPAY_WEBHOOK_SECRET')
        if not webhook_secret:
            logger.error("Razorpay webhook secret not configured")
            return jsonify({"error": "Webhook not configured"}), 500
        
        # Verify webhook signature
        signature = request.headers.get('X-Razorpay-Signature')
        body = request.get_data(as_text=True)
        
        expected_signature = hmac.new(
            webhook_secret.encode(),
            body.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning("Invalid webhook signature")
            return jsonify({"error": "Invalid signature"}), 400
        
        # Process webhook event
        event = request.get_json(silent=True) or {}
        event_type = event.get('event')
        payload = event.get('payload', {}).get('payment', {}).get('entity', {})
        
        logger.info(f"Razorpay webhook received: {event_type}")
        
        # Handle different event types
        if event_type == 'payment.captured':
            payment_id = payload.get('id')
            order_id = payload.get('notes', {}).get('order_id')
            
            if order_id and payment_id:
                payment_data = {
                    'razorpay_payment_id': payment_id,
                    'razorpay_order_id': payload.get('order_id'),
                    'payment_method': payload.get('method')
                }
                
                PaymentService.update_order_payment_success(order_id, payment_data)
                
                # Get order and send confirmation
                db = PaymentService.get_db()
                order = db.orders.find_one({"_id": ObjectId(order_id)})
                if order:
                    PaymentService.send_payment_confirmation_email(order)
        
        elif event_type == 'payment.failed':
            payment_id = payload.get('id')
            order_id = payload.get('notes', {}).get('order_id')
            error_reason = payload.get('error_description', 'Payment failed')
            
            if order_id:
                PaymentService.update_order_payment_failure(order_id, error_reason)
        
        return jsonify({"success": True}), 200
        
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        return jsonify({"error": "Webhook processing failed"}), 500


@payment_bp.route('/health', methods=['GET'])
def payment_health():
    """Health check for payment service"""
    try:
        client = PaymentService.get_razorpay_client()
        
        # Test API connectivity
        client.order.all(count=1)
        
        return jsonify({
            "status": "healthy",
            "service": "payment",
            "gateway": "razorpay",
            "timestamp": datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Payment health check failed: {str(e)}")
        return jsonify({
            "status": "unhealthy", 
            "service": "payment",
            "error": str(e)
        }), 503