// app/api/send-verification-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Force Node runtime; avoid static opt
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { email, firstName = "there", token } =
      (await req.json().catch(() => ({}))) as {
        email?: string;
        firstName?: string;
        token?: string;
      };

    if (!email || !token) {
      return NextResponse.json(
        { error: "Missing email or token" },
        { status: 400 }
      );
    }

    // Make sure key exists in server env
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Create client inside handler (prevents build-time issues)
    const resend = new Resend(apiKey);

    // Derive a safe base URL (prefers request origin)
    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.NEXTAUTH_URL?.startsWith("http")
        ? process.env.NEXTAUTH_URL
        : undefined) ||
      "http://localhost:3000";

    const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(
      token
    )}&email=${encodeURIComponent(email)}`;

    await resend.emails.send({
      // IMPORTANT: Resend requires a verified domain sender.
      // Replace with something like "no-reply@yourdomain.com" that you've verified in Resend.
      from: process.env.EMAIL_FROM || "Nazmi Boutique <no-reply@yourdomain.com>",
      to: email,
      subject: "Verify Your Email - Nazmi Boutique",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <h2>Hi ${firstName},</h2>
          <p>Click the button below to verify your email.</p>
          <p>
            <a href="${verifyUrl}" style="background:#000;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">
              Verify Email
            </a>
          </p>
          <p>Or open this link: ${verifyUrl}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[send-verification-email] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
