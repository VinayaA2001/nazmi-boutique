# Backend/utils/email.py

from io import BytesIO
from typing import Any, Dict, List

from flask_mail import Message
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def _fmt_money(n: Any) -> str:
    """Format amount as ₹1,234.00 safely."""
    try:
        return f"₹{float(n):,.2f}"
    except Exception:
        return f"₹{n}"


class EmailService:
    """
    Wrapper around Flask-Mail for NAZMI Boutique emails.

    Usage (in app.py):
        from utils.email import EmailService

        email_service = EmailService(mail)

        # later, when order confirmed:
        email_service.send_order_confirmation(order_doc, customer_email)
    """

    def __init__(self, mail, default_sender: str | None = None):
        self.mail = mail
        self.default_sender = default_sender or "nazmiboutique1@gmail.com"

    # ---------- PDF INVOICE GENERATION ----------

    def generate_invoice_pdf(self, order: Dict[str, Any]) -> bytes:
        """
        Generate a simple invoice PDF and return it as bytes.

        Expected order structure (flexible):
        - order["order_number"]
        - order["status"]
        - customer name in:
            order["customer_name"] OR
            order["customer_info"]["name"]
        - total amount in:
            order["grand_total"] OR
            order["total"] OR
            order["total_amount"]
        - items: list of dicts with:
            name / product_name, price, quantity / qty
        """
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # ---- header ----
        y = height - 50
        p.setFont("Helvetica-Bold", 18)
        p.drawString(50, y, "NAZMI Boutique - Order Invoice")

        # ---- order meta ----
        order_number = order.get("order_number", "")
        status = order.get("status", "")
        customer_name = (
            order.get("customer_name")
            or (order.get("customer_info") or {}).get("name")
            or ""
        )
        total_amount = (
            order.get("grand_total")
            or order.get("total")
            or order.get("total_amount")
            or 0
        )

        y -= 30
        p.setFont("Helvetica", 12)
        p.drawString(50, y, f"Order Number: {order_number}")
        y -= 20
        p.drawString(50, y, f"Customer Name: {customer_name}")
        y -= 20
        p.drawString(50, y, f"Status: {status}")
        y -= 20
        p.drawString(50, y, f"Total Amount: {_fmt_money(total_amount)}")

        # ---- items ----
        y -= 40
        p.setFont("Helvetica-Bold", 13)
        p.drawString(50, y, "Items:")
        y -= 25
        p.setFont("Helvetica", 11)

        items: List[Dict[str, Any]] = order.get("items") or []
        for item in items:
            # Handle multiple key options
            name = item.get("name") or item.get("product_name") or "Item"
            price = item.get("price", 0)
            qty = item.get("quantity", item.get("qty", 1))

            line = f"- {name} ({_fmt_money(price)} x {qty})"
            p.drawString(70, y, line)
            y -= 18

            # simple page-break if needed
            if y < 80:
                p.showPage()
                p.setFont("Helvetica", 11)
                y = height - 80

        # ---- footer ----
        y -= 30
        if y < 80:
            p.showPage()
            y = height - 80
        p.setFont("Helvetica", 11)
        p.drawString(50, y, "Thank you for shopping with us!")

        p.showPage()
        p.save()

        buffer.seek(0)
        return buffer.getvalue()

    # ---------- EMAIL: ORDER CONFIRMATION + INVOICE ----------

    def send_order_confirmation(self, order: Dict[str, Any], to_email: str):
        """
        Send confirmation email with attached invoice PDF.

        order: Mongo order doc or a compatible dict.
        to_email: customer email.
        """
        if not to_email:
            # nothing to send to
            return

        order_number = order.get("order_number", "")
        status = order.get("status", "")
        customer_name = (
            order.get("customer_name")
            or (order.get("customer_info") or {}).get("name")
            or ""
        )
        total_amount = (
            order.get("grand_total")
            or order.get("total")
            or order.get("total_amount")
            or 0
        )

        items: List[Dict[str, Any]] = order.get("items") or []

        # Build items HTML
        items_html = "".join(
            f"<li>{(it.get('name') or it.get('product_name') or 'Item')} "
            f"- {_fmt_money(it.get('price', 0))} x {it.get('quantity', it.get('qty', 1))}</li>"
            for it in items
        )

        msg = Message(
            subject=f"Order Confirmation - {order_number}",
            recipients=[to_email],
            sender=self.default_sender,
        )

        msg.body = (
            f"Dear {customer_name},\n\n"
            f"Your order {order_number} has been confirmed.\n"
            f"Total: {_fmt_money(total_amount)}\n"
            f"Status: {status}\n\n"
            "Your invoice is attached as a PDF.\n\n"
            "— NAZMI Boutique"
        )

        msg.html = f"""
        <div style="font-family: Arial; padding: 16px; background-color:#fafafa;">
            <h2 style="color:#b36b00;">Thank you for your order, {customer_name}!</h2>
            <p>Your order <b>#{order_number}</b> has been confirmed.</p>
            <hr>
            <h3>Order Details</h3>
            <ul>
                {items_html}
            </ul>
            <p><b>Total:</b> {_fmt_money(total_amount)}</p>
            <p><b>Status:</b> {status}</p>
            <hr>
            <p>📎 Your detailed invoice is attached as a PDF.</p>
            <p>We’ll notify you once your order is shipped. 💌</p>
            <p>— NAZMI Boutique</p>
        </div>
        """

        # Generate PDF and attach
        pdf_data = self.generate_invoice_pdf(order)
        msg.attach(
            filename=f"Invoice_{order_number}.pdf",
            content_type="application/pdf",
            data=pdf_data,
        )

        self.mail.send(msg)
