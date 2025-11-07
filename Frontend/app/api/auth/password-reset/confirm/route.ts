import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const MONGO_URI = process.env.MONGO_URI!;
let client: MongoClient;

async function cols() {
  if (!client || !client.topology?.isConnected()) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  const db = client.db();
  return { users: db.collection("users"), tokens: db.collection("password_resets") };
}

export async function POST(req: NextRequest) {
  try {
    const { email, code, newPassword } = await req.json();
    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const { users, tokens } = await cols();

    const t = await tokens.findOne({ email: email.toLowerCase(), code });
    if (!t) return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

    const hash = await bcrypt.hash(newPassword, 10);
    await users.updateOne({ email: email.toLowerCase() }, { $set: { password: hash } });
    await tokens.deleteMany({ email: email.toLowerCase() });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
