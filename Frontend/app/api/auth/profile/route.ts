import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildAuth(req: NextRequest) {
  const hdr = req.headers.get("authorization");
  if (hdr) return hdr;
  const t = cookies().get("auth_token")?.value;
  return t ? `Bearer ${t}` : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const auth = buildAuth(req);
    const r = await fetch(`${API_BASE}/api/auth/profile`, {
      headers: {
        ...(auth ? { Authorization: auth } : {}),
      },
      cache: "no-store",
    });
    const text = await r.text();
    const ct = r.headers.get("content-type") || "application/json";
    return new NextResponse(text, { status: r.status, headers: { "content-type": ct } });
  } catch (e: any) {
    return NextResponse.json({ error: "Profile proxy failed", message: e?.message }, { status: 502 });
  }
}

