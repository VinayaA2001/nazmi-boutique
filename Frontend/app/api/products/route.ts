// app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";

const norm = (s: any) => String(s ?? "").trim().toLowerCase();
const truthy = (v: any) => ["1", "true", "yes", "on"].includes(norm(v));

function num(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function totalQty(p: any) {
  const fromVariants = Array.isArray(p.variants)
    ? p.variants.reduce((s: number, v: any) => s + num(v.stock ?? v.quantity), 0)
    : 0;
  const rootQty = num(p.quantity_total ?? p.quantity);
  return fromVariants > 0 ? fromVariants : rootQty;
}

function isCategory(p: any, target: "sale" | "ethnic" | "western") {
  const c = norm(p.category).replace(/\s+/g, " ");
  const tags = Array.isArray(p.tags) ? p.tags.map(norm) : [];

  if (target === "sale") {
    return c.includes("sale") || p.isSale === true || tags.includes("sale");
  }
  if (target === "ethnic") return /ethnic/.test(c);
  if (target === "western") return /western/.test(c);
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawCategory = norm(url.searchParams.get("category"));
    const inStockOnly = truthy(url.searchParams.get("inStock"));

    // ✅ Use deployed backend URL if available, otherwise local fallback
    const backendURL =
      process.env.NEXT_PUBLIC_API_URL ||
      "https://nazmi-boutique-2.onrender.com/api/products";

    const res = await fetch(backendURL, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { message: "Failed to fetch from backend" },
        { status: 502 }
      );
    }

    let products: any[] = await res.json();

    // ✅ Filter by category (defensive)
    if (rawCategory) {
      if (rawCategory === "sale") {
        products = products.filter((p) => isCategory(p, "sale"));
      } else if (rawCategory.includes("ethnic")) {
        products = products.filter((p) => isCategory(p, "ethnic"));
      } else if (rawCategory.includes("western")) {
        products = products.filter((p) => isCategory(p, "western"));
      } else {
        products = products.filter((p) =>
          norm(p.category).includes(rawCategory)
        );
      }
    }

    // ✅ Filter in-stock only
    if (inStockOnly) {
      products = products.filter((p) => totalQty(p) > 0);
    }

    return NextResponse.json(products);
  } catch (err) {
    console.error("API /products error:", err);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
