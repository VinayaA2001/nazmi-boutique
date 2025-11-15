import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  const idParam = req.nextUrl.searchParams.get("id") || "";
  const base = (process.env.NEXT_PUBLIC_API_URL || API_BASE || "").replace(/\/$/, "");
  try {
    // First: if id is provided, fetch directly
    if (idParam) {
      const r = await fetch(`${base}/api/products/${encodeURIComponent(idParam)}`, { cache: "no-store" });
      if (r.ok) {
        const one = await r.json();
        return NextResponse.json(one, { status: 200 });
      }
    }

    // Else: list and match by slug/name/code heuristics
    const res = await fetch(`${base}/api/products`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "backend fetch failed" }, { status: 502 });
    const data = await res.json().catch(() => [] as any[]);
    const list: any[] = Array.isArray(data) ? data : Array.isArray((data as any)?.products) ? (data as any).products : [];

    const lc = slug.toLowerCase();
    const match = list.find((p: any) => (p?.slug && String(p.slug).toLowerCase() === lc)) ||
      list.find((p: any) => slugify(`${p?.product_name || p?.name || p?.title || ""}-${p?.product_code || p?._id || ""}`) === lc) ||
      list.find((p: any) => slugify(String(p?.product_name || p?.name || p?.title || "")) === lc);

    if (!match) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(match, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}