// C:\NAZMI_BOUTIQUE\Frontend\app\api\send-verification-email\route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const isEmail = (s?: string) => !!s && /^\S+@\S+\.\S+$/.test(s);

// minimal HTML escaper for firstName
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m] || m
    );
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim();
    const firstName = String(body?.firstName ?? "there").trim() || "there";
    const token = String(body?.token ?? "").trim();

    if (!isEmail(email) || !token) {
      return NextResponse.json(
        { error: "Missing/invalid email or token" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM; // e.g. "Nazmi Boutique <no-reply@yourdomain.com>"

    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!from) {
      return NextResponse.json(
        { error: "EMAIL_FROM not configured" },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    // Prefer request origin to avoid wrong host in links
    const origin =
      req.nextUrl.origin ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    // 🔴 IMPORTANT:
    // Your frontend verify page is at /verify (app/verify/page.tsx),
    // so we use "/verify" here. Change to "/verify-email" only if your route is different.
    const verify = new URL("/verify", origin);
    verify.searchParams.set("token", token);
    verify.searchParams.set("email", email);
    const verifyUrl = verify.toString();

    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject: "Verify Your Email - Nazmi Boutique",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <h2>Hi ${escapeHtml(firstName)},</h2>
          <p>Click the button below to verify your email.</p>
          <p>
            <a href="${verifyUrl}" style="background:#000;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">
              Verify Email
            </a>
          </p>
          <p style="color:#666;font-size:12px">
            If the button doesn't work, copy & paste this link:<br>
            ${verifyUrl}
          </p>
        </div>
      `,
      text: `Hi ${firstName},\n\nVerify your email:\n${verifyUrl}\n`,
      // You can add reply_to here if needed:
      // reply_to: "support@yourdomain.com",
    });

    if (error) {
      // Resend returns structured errors – surface the message
      return NextResponse.json(
        { error: error.message || "Failed to send" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (err: any) {
    console.error("[send-verification-email] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
