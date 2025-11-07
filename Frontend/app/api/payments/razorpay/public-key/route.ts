import { NextResponse } from "next/server";

export async function GET() {
  // Prefer NEXT_PUBLIC_ (safe to expose), else fall back to server-only var if you use it
  const key =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID ||
    "rzp_test_RZFeCq3NZLg9Rz";
  return NextResponse.json({ key });
}
