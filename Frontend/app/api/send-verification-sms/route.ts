import { Resend } from "resend";

export async function POST(req) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("Missing RESEND_API_KEY. Skipping email sending.");
      return Response.json({ error: "Email service not configured" }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { email } = await req.json();

    await resend.emails.send({
      from: "no-reply@nazmi-boutique.com",
      to: email,
      subject: "Verification Email",
      html: `<p>Your verification code is: 123456</p>`,
    });

    return Response.json({ message: "Verification email sent" });
  } catch (error) {
    console.error("Email error:", error);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
