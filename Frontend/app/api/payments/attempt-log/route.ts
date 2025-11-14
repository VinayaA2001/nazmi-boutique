import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await fetch(`${API_BASE}/api/payments/attempt-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  const contentType = res.headers.get("content-type") || "application/json";
  return new NextResponse(text || "{}", {
    status: res.status,
    headers: { "content-type": contentType },
  });
}

