import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { Resend } from "resend";

const MONGO_URI = process.env.MONGO_URI!;
const resend = new Resend(process.env.RESEND_API_KEY!);
const EMAIL_FROM = process.env.EMAIL_FROM || "Nazmi Boutique <no-reply@nazmi.com>";

let client: MongoClient;
async function cols() {
  if (!client || !client.topology?.isConnected()) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  const db = client.db();
  return { users: db.collection("users"), tokens: db.collection("password_resets") };
}
const genCode = () => Math.floor(100000 + Math.random() * 900000).toString();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const { users, tokens } = await cols();

    const user = await users.findOne({ email: (email || "").trim().toLowerCase() });
    if (!user) return NextResponse.json({ ok: true }); // don't leak existence

    const code = genCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await tokens.insertOne({ email: user.email, code, expiresAt });

    await resend.emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject: "Reset your Nazmi Boutique password",
      html: `<p>Use this code to reset your password:</p><h2>${code}</h2><p>Valid for 10 minutes.</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: true }); // silent
  }
}
