import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  return withCors(NextResponse.json({}));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!token || !email) {
      return withCors(
        NextResponse.json({ code: "MISSING_FIELDS", message: "Token and email are required" }, { status: 400 })
      );
    }

    // 1) Look up token
    const vt = await prisma.verificationToken.findUnique({ where: { token } });
    const vtEmail = (vt?.identifier ?? "").toLowerCase();
    if (!vt || vtEmail !== email) {
      return withCors(
        NextResponse.json({ code: "INVALID_TOKEN", message: "Invalid or already used token" }, { status: 400 })
      );
    }

    // 2) Check expiry
    if (vt.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
      return withCors(NextResponse.json({ code: "TOKEN_EXPIRED", message: "Token expired" }, { status: 400 }));
    }

    // 3) Verify user + consume token atomically
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { email },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({ where: { token } }),
    ]);

    return withCors(NextResponse.json({ message: "Email verified successfully" }, { status: 200 }));
  } catch (e) {
    console.error("[verify-email] error:", e);
    return withCors(NextResponse.json({ code: "INTERNAL", message: "Internal server error" }, { status: 500 }));
  }
}
