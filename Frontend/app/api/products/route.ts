// app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";

/* ========= Utils ========= */
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const truthy = (v: unknown) => ["1", "true", "yes", "on"].includes(norm(v));
const toInt = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

/** Robust money parser (positive only) */
const toMoney = (v: unknown): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const cleaned = String(v).replace(/[^\d.]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/* ========= Image normalization ========= */
const CLOUDINARY_BASE = "https://res.cloudinary.com/dq5xhg9uo/image/upload/";
const PLACEHOLDER = "/images/placeholder.png";

const toFullUrl = (img?: string) =>
  !img
    ? PLACEHOLDER
    : img.startsWith("http")
    ? img
    : img.startsWith("/")
    ? img
    : CLOUDINARY_BASE + img.replace(/^\//, "");

function normalizeImages(p: any) {
  const rootImgs = Array.isArray(p?.images) ? p.images : [];
  let imgs = rootImgs.map(toFullUrl);

  // fallback to variant images if none at root
  if (imgs.length === 0 && Array.isArray(p?.variants) && p.variants.length) {
    const vImgs = (p.variants[0]?.images || []).map(toFullUrl);
    if (vImgs.length) imgs = vImgs;
  }
  return { ...p, images: imgs, image: imgs[0] || PLACEHOLDER };
}

/* ========= Derived fields from variants ========= */
function deriveFromVariants(variants: any[] = []) {
  const sizes = new Set<string>();
  const colors = new Set<string>();
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  let totalStock = 0;

  for (const v of variants) {
    const price = toMoney(v?.price);
    const stock = toInt(v?.stock ?? v?.quantity);
    const size = String(v?.size ?? "").trim();
    const colour = String(v?.colour ?? v?.color ?? "").trim();

    if (size) sizes.add(size);
    if (colour) colors.add(colour);

    totalStock += stock;

    if (price !== undefined) {
      minPrice = minPrice === undefined ? price : Math.min(minPrice, price);
      maxPrice = maxPrice === undefined ? price : Math.max(maxPrice, price);
    }
  }

  return {
    availableSizes: Array.from(sizes),
    availableColors: Array.from(colors),
    totalStock,
    minPrice,                 // may be undefined if none present
    maxPrice: maxPrice ?? minPrice,
    hasMultipleOptions: variants.length > 1,
  };
}

function buildColorImages(p: any) {
  const map: Record<string, string[]> = {};
  if (Array.isArray(p?.variants)) {
    for (const v of p.variants) {
      const color = String(v?.colour ?? v?.color ?? "").trim();
      if (!color) continue;
      const imgs = Array.isArray(v?.images) ? v.images.map(toFullUrl) : [];
      if (!map[color]) map[color] = [];
      for (const i of imgs) if (!map[color].includes(i)) map[color].push(i);
    }
  }
  return map;
}

function totalQty(p: any) {
  const fromVariants = Array.isArray(p?.variants)
    ? p.variants.reduce((sum: number, v: any) => sum + toInt(v?.stock ?? v?.quantity), 0)
    : 0;
  const rootQty = toInt(p?.quantity_total ?? p?.quantity ?? p?.stock);
  return fromVariants > 0 ? fromVariants : rootQty;
}

/* ========= Category matching ========= */
function isCategorySingle(p: any, targetRaw: string) {
  const target = norm(targetRaw);
  if (!target) return true;

  const cat = norm(p?.category).replace(/\s+/g, "-");
  const tags = (Array.isArray(p?.tags) ? p.tags : []).map(norm);

  if (cat === target || cat.includes(target)) return true;
  if (tags.includes(target)) return true;

  if (target.includes("sale")) return cat.includes("sale") || p?.isSale === true || tags.includes("sale");
  if (target.includes("ethnic")) return cat.includes("ethnic");
  if (target.includes("western")) return cat.includes("western");

  return false;
}

/** NEW: Multi-token category parsing & matching
 * Splits by comma, pipe, plus, or whitespace: "western,sale", "western sale", "western+sale"
 * matchMode: "all" (AND) or "any" (OR); default "all"
 */
function parseCategoryList(raw: string): string[] {
  const s = norm(raw);
  if (!s) return [];
  // split on , | + or whitespace (one or more)
  return s.split(/[,\|\+\s]+/g).map((t) => t.trim()).filter(Boolean);
}

function matchCategoryMulti(p: any, raw: string, mode: "all" | "any" = "all") {
  const tokens = parseCategoryList(raw);
  if (tokens.length === 0) return true;
  const results = tokens.map((tok) => isCategorySingle(p, tok));
  return mode === "any" ? results.some(Boolean) : results.every(Boolean);
}

/* ========= Normalize one product ========= */
function shapeProduct(raw: any) {
  const p = normalizeImages(raw);
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  const derived = deriveFromVariants(variants);

  const product_name = p.product_name || p.name || p.title || p.product_code || "Untitled";

  const material =
    p.material ?? p?.specs?.material ?? p?.details?.material ?? p?.attributes?.material ?? "";

  const _id = typeof p._id === "string" ? p._id : String(p._id ?? "");

  const rootPriceCandidate =
    toMoney(p.price) ?? toMoney(p.minPrice) ?? toMoney(p.mrp) ?? toMoney(p.listPrice) ?? undefined;

  const minPrice = derived.minPrice ?? rootPriceCandidate;
  const maxPrice = derived.maxPrice ?? toMoney(p.maxPrice) ?? minPrice;

  const normVariants = variants.map((v: any) => ({
    _id: String(v?._id ?? ""),
    size: v?.size ?? "",
    colour: v?.colour ?? v?.color ?? "",
    stock: toInt(v?.stock ?? v?.quantity),
    price: toMoney(v?.price),
    images: Array.isArray(v?.images) ? v.images.map(toFullUrl) : [],
  }));

  const hasPrice = typeof minPrice === "number";

  return {
    _id,
    slug: p.slug || slugify(`${product_name}-${p.product_code || _id}`),
    product_code: p.product_code || p.code || "",
    product_name,
    name: product_name,
    description: p.description || p.desc || "",
    category: p.category || "",
    material,
    images: p.images,
    image: p.image,
    variants: normVariants,

    availableSizes: derived.availableSizes,
    availableColors: derived.availableColors,
    totalStock: derived.totalStock || totalQty(p),

    // keep undefined when unavailable
    minPrice,
    maxPrice,
    price: minPrice,
    hasPrice,

    hasMultipleOptions: derived.hasMultipleOptions,
    colorImages: buildColorImages(p),

    tags: p.tags || [],
    isSale: Boolean(p.isSale),
  };
}

/* ========= Handler ========= */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawCategory = String(url.searchParams.get("category") ?? "");
    const matchModeParam = norm(url.searchParams.get("match") ?? "all");
    const matchMode: "all" | "any" = matchModeParam === "any" ? "any" : "all";
    const inStockOnly = truthy(url.searchParams.get("inStock"));
    const limit = Number(url.searchParams.get("limit") ?? 0);

    const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://nazmi-boutique-2.onrender.com").replace(/\/$/, "");
    const backendURL = `${API_BASE}/api/products`;

    const res = await fetch(backendURL, { method: "GET", cache: "no-store" });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Backend fetch failed:", res.status, body);
      return NextResponse.json([], { status: 200 });
    }

    const raw = await res.json().catch(() => []);
    const arr = Array.isArray(raw)
      ? raw
      : raw && Array.isArray(raw.products)
      ? raw.products
      : typeof raw === "object"
      ? [raw]
      : [];

    let products = arr.map(shapeProduct);

    // NEW: multi-category matching
    if (rawCategory) {
      products = products.filter((p) => matchCategoryMulti(p, rawCategory, matchMode));
    }

    if (inStockOnly) products = products.filter((p) => (p.totalStock ?? 0) > 0);
    if (limit > 0) products = products.slice(0, limit);

    return NextResponse.json(products, { status: 200 });
  } catch (err) {
    console.error("API /products error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
