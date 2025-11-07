import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

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

let client: MongoClient;
async function getCols() {
  const uri = process.env.MONGO_URI || process.env.DATABASE_URL || "";
  if (!uri) throw new Error("DB not configured (MONGO_URI/DATABASE_URL missing)");
  if (!client || !(client as any).topology?.isConnected?.()) {
    client = new MongoClient(uri);
    await client.connect();
  }
  const db = client.db();
  // Prisma default collection names are model names
  const users = db.collection("User");
  const tokens = db.collection("VerificationToken");
  return { users, tokens };
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

    const { users, tokens } = await getCols();
    // 1) Look up token in Mongo
    const vt = await tokens.findOne({ token });
    const vtEmail = (String(vt?.identifier || "")).toLowerCase();
    if (!vt || vtEmail !== email) {
      return withCors(
        NextResponse.json({ code: "INVALID_TOKEN", message: "Invalid or already used token" }, { status: 400 })
      );
    }

    // 2) Check expiry
    if (vt.expires && new Date(vt.expires) < new Date()) {
      await tokens.deleteOne({ token }).catch(() => {});
      return withCors(NextResponse.json({ code: "TOKEN_EXPIRED", message: "Token expired" }, { status: 400 }));
    }

    // 3) Verify user + consume token atomically
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await users.updateMany({ email }, { $set: { emailVerified: new Date() } }, { session });
        await tokens.deleteOne({ token }, { session });
      });
    } finally {
      await session.endSession();
    }

    return withCors(NextResponse.json({ message: "Email verified successfully" }, { status: 200 }));
  } catch (e) {
    console.error("[verify-email] error:", e);
    return withCors(NextResponse.json({ code: "INTERNAL", message: "Internal server error" }, { status: 500 }));
  }
}
