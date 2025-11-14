# Backend/utils/email.py

from typing import Dict, Any

from flask_mail import Message
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from flask import current_app


class EmailService:
    def __init__(self, mail):
        """
        mail: the Flask-Mail Mail() instance created in app.py
        """
        self.mail = mail

    def _safe_send(self, msg: Message) -> bool:
        """
        Safe send: in dev, if MAIL_USERNAME is not configured, just log
        instead of raising errors (same behaviour as _send_email_safe in app.py).
        """
        try:
            if not current_app.config.get("MAIL_USERNAME"):
                current_app.logger.info(
                    f"[DEV] Email (subj={msg.subject}) to {msg.recipients}: {msg.body or msg.html}"
                )
                return True
            self.mail.send(msg)
            return True
        except Exception as e:
            current_app.logger.warning(f"Email send skipped/logged. Reason: {e}")
            return False

    def generate_invoice_pdf(self, order: Dict[str, Any]) -> bytes:
        """
        Generate a simple invoice PDF from your Mongo order doc.

        Expected order shape (like app.py):
          - order_number: str
          - customer_info: { name, email, phone }
          - status: str
          - grand_total / total: number
          - items: [
                {
                    name/product_name: str,
                    price: number,
                    quantity: int
                }
            ]
        """
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        customer_info = order.get("customer_info", {}) or {}
        customer_name = customer_info.get("name", "")
        status = order.get("status", "")
        total_amount = order.get("grand_total") or order.get("total") or 0

        # Header
        y = height - 50
        p.setFont("Helvetica-Bold", 18)
        p.drawString(50, y, "NAZMI Boutique - Order Invoice")

        # Basic order details
        y -= 30
        p.setFont("Helvetica", 12)
        p.drawString(50, y, f"Order Number: {order.get('order_number', '')}")
        y -= 20
        p.drawString(50, y, f"Customer Name: {customer_name}")
        y -= 20
        p.drawString(50, y, f"Status: {status}")
        y -= 20
        p.drawString(50, y, f"Total Amount: ₹{total_amount}")
        y -= 40

        # Items
        p.drawString(50, y, "Items:")
        y -= 20

        for item in order.get("items", []):
            name = item.get("name") or item.get("product_name") or "Item"
            price = item.get("price", 0)
            qty = item.get("quantity", 1)

            line = f"- {name} (₹{price} x {qty})"
            p.drawString(70, y, line)
            y -= 20

            # New page if overflow
            if y < 80:
                p.showPage()
                p.setFont("Helvetica", 12)
                y = height - 50

        # Footer
        y -= 20
        if y < 80:
            p.showPage()
            p.setFont("Helvetica", 12)
            y = height - 50

        p.drawString(50, y, "Thank you for shopping with us!")
        p.showPage()
        p.save()

        buffer.seek(0)
        return buffer.getvalue()

    def send_order_confirmation(self, order: Dict[str, Any]) -> bool:
        """
        Send confirmation email with attached invoice PDF to customer.
        Should be called AFTER shop confirms the order
        (for example from /api/orders/<id>/confirm in app.py).
        """
        customer_info = order.get("customer_info", {}) or {}
        to_email = customer_info.get("email")
        customer_name = customer_info.get("name", "")

        if not to_email:
            current_app.logger.warning(
                "No customer email on order, skipping confirmation email."
            )
            return False

        total_amount = order.get("grand_total") or order.get("total") or 0

        # Use MAIL_DEFAULT_SENDER if configured, otherwise fallback
        sender_email = current_app.config.get(
            "MAIL_DEFAULT_SENDER", "nazmiboutique1@gmail.com"
        )

        msg = Message(
            subject=f"Order Confirmation - {order.get('order_number', '')}",
            recipients=[to_email],
            sender=sender_email,
        )

        items_html = "".join(
            f"<li>{(item.get('name') or item.get('product_name') or 'Item')} "
            f"- ₹{item.get('price', 0)} x {item.get('quantity', 1)}</li>"
            for item in order.get("items", [])
        )

        msg.html = f"""
        <div style="font-family: Arial; padding: 16px; background-color:#fafafa;">
            <h2 style="color:#b36b00;">Thank you for your order, {customer_name}!</h2>
            <p>Your order <b>#{order.get('order_number', '')}</b> has been confirmed.</p>
            <hr>
            <h3>Order Details</h3>
            <ul>
                {items_html}
            </ul>
            <p><b>Total:</b> ₹{total_amount}</p>
            <p><b>Status:</b> {order.get('status', '')}</p>
            <hr>
            <p>📎 Your detailed invoice is attached as a PDF.</p>
            <p>We’ll notify you once your order is shipped. 💌</p>
            <p>— NAZMI Boutique</p>
        </div>
        """

        # Generate PDF and attach
        pdf_data = self.generate_invoice_pdf(order)
        msg.attach(
            filename=f"Invoice_{order.get('order_number', '')}.pdf",
            content_type="application/pdf",
            data=pdf_data,
        )

        return self._safe_send(msg)
