import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });

    // If upstream doesn't have the endpoint yet, don't break UX.
    if (r.status === 404) {
      return NextResponse.json(
        { success: true, message: "If an account exists, a reset link has been sent" },
        { status: 200 }
      );
    }

    const text = await r.text();
    const ct = r.headers.get("content-type") || "application/json";
    return new NextResponse(text, { status: r.status, headers: { "content-type": ct } });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || "Failed to forward request" }, { status: 502 });
  }
}
