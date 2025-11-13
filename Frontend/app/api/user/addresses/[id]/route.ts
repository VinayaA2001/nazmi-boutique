import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildAuth(req: NextRequest) {
  const h = req.headers.get("authorization");
  if (h) return h;
  const t = cookies().get("auth_token")?.value || cookies().get("token")?.value;
  return t ? (t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`) : undefined;
}

async function forward(req: NextRequest, path: string, init: RequestInit = {}) {
  const url = `${API_BASE}${path}`.replace(/\/$/, "");
  const r = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(buildAuth(req) ? { Authorization: buildAuth(req)! } : {}),
      ...(init.headers as any),
    },
    cache: "no-store",
  });
  const text = await r.text();
  const ct = r.headers.get("content-type") || "application/json";
  return new NextResponse(text, { status: r.status, headers: { "content-type": ct } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.text();
  return forward(req, `/api/user/addresses/${params.id}`, { method: "PUT", body });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return forward(req, `/api/user/addresses/${params.id}`, { method: "DELETE" });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // PATCH sets default
  return forward(req, `/api/user/addresses/${params.id}/default`, { method: "PATCH" });
}
