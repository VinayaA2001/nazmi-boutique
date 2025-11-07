// app/api/user/address/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE =
  process.env.SERVER_API_BASE || // prefer server-only var in prod
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:5000/api";

// Helper: build Authorization, preferring header, else cookie "token"
function buildAuthHeader(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (header) return header;

  const jar = cookies();
  const raw = jar.get("token")?.value;
  if (!raw) return undefined;

  // Accept either already "Bearer ..." or a bare token
  return raw.toLowerCase().startsWith("bearer ") ? raw : `Bearer ${raw}`;
}

// Helper: fetch with timeout + consistent error handling
async function forward(
  req: NextRequest,
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 10_000);

  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const auth = buildAuthHeader(req);
  if (auth) headers.Authorization = auth;

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
      // never cache these proxy calls
      cache: "no-store",
    });

    // Try to parse JSON, but gracefully handle non-JSON responses
    let payload: any = null;
    const text = await res.text();
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text || null;
    }

    if (!res.ok) {
      // return backend message when available
      const message =
        (payload && (payload.error || payload.message)) ||
        `Upstream error ${res.status}`;
      return NextResponse.json(
        { error: "Failed to process address", message },
        { status: res.status }
      );
    }

    // 204 no content
    if (!text) {
      return NextResponse.json(null, { status: res.status });
    }

    return NextResponse.json(payload, { status: res.status });
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return NextResponse.json(
      {
        error: aborted ? "Upstream timeout" : "Network error while contacting backend",
        details: aborted ? "Timed out after 10s" : err?.message || String(err),
      },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  return forward(req, "/user/address", { method: "GET" });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forward(req, "/user/address", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
