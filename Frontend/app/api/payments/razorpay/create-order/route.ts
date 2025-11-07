import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // ensure no static caching

const API_BASE =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log("[proxy] ->", `${API_BASE}/api/payments/razorpay/create-order`, body);

    const res = await fetch(`${API_BASE}/api/payments/razorpay/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), // forward exactly
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("❌ Backend create-order failed", res.status, res.statusText, data);
      return NextResponse.json(
        { error: data?.error || data?.message || "Create order failed" },
        { status: res.status }
      );
    }

    // pass through the backend’s shape (id/razorpay_order_id/amount/etc.)
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("❌ Proxy error (create-order):", err?.message || err);
    return NextResponse.json(
      { error: "Proxy error contacting payment backend" },
      { status: 502 }
    );
  }
}
