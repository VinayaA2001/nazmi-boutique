// app/search/page.tsx
import ProductCardClient, { type CardProduct } from "@/components/commerce/ProductCardClient";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams?: { q?: string };
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/* ---------- Helpers ---------- */
const imgUrl = (p?: string | null) => {
  if (!p || typeof p !== "string") return "/images/poster1.png";
  let s = String(p).trim();
  if (!s) return "/images/poster1.png";
  if (s.startsWith("//")) s = "https:" + s;
  // Map local backend file URLs to the deployed backend
  if (s.startsWith("http://localhost:5000") || s.startsWith("http://127.0.0.1:5000")) {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    if (base) s = base + s.replace(/^http:\/\/(localhost|127\.0\.0\.1):5000/, "");
  }
  // Force https for render backend host
  const backendHost = "nazmi-boutique-2.onrender.com";
  if (s.startsWith(`http://${backendHost}`)) s = s.replace("http://", "https://");
  if (s.startsWith("http") || s.startsWith("/")) return s;
  return `/images/${s}`;
};

// Extract best images from a raw product record (images > colorImages > variants)
const extractImages = (p: any): string[] => {
  if (Array.isArray(p?.images) && p.images.length) return p.images as string[];
  if (p?.colorImages && typeof p.colorImages === "object") {
    for (const arr of Object.values(p.colorImages as Record<string, any>)) {
      if (Array.isArray(arr) && arr.length) return arr as string[];
    }
  }
  if (Array.isArray(p?.variants)) {
    for (const v of p.variants) {
      if (Array.isArray(v?.images) && v.images.length) return v.images as string[];
    }
  }
  if (p?.image) return [String(p.image)];
  return [];
};

// Compute a price band from various shapes: prefer explicit min/max, else variants, else price
const toNumber = (v: any): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const priceBand = (p: any): { min?: number; max?: number } => {
  const minP = toNumber(p?.minPrice);
  const maxP = toNumber(p?.maxPrice);
  if (minP && maxP) return { min: minP, max: maxP };
  const variantPrices: number[] = Array.isArray(p?.variants)
    ? (p.variants
        .map((v: any) => toNumber(v?.price))
        .filter((n: any) => typeof n === "number") as number[])
    : [];
  if (variantPrices.length) {
    const min = Math.min(...variantPrices);
    const max = Math.max(...variantPrices);
    return { min, max };
  }
  const price = toNumber(p?.price);
  return price ? { min: price, max: price } : {};
};

// normalize for fuzzy comparisons: lowercase, remove non-alphanum
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "");

// tokenization that keeps words (for multi-word queries like "co ord set")
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// quick “is subsequence” check (e.g., "coord" is subseq of "coordinated")
const isSubseq = (needle: string, hay: string) => {
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) if (needle[i] === hay[j]) i++;
  return i === needle.length;
};

// small Levenshtein distance with early exit (limit 2 edits)
const editDistLE2 = (a: string, b: string) => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3; // >2 edits for sure
  const dp = Array.from({ length: a.length + 1 }, (_, i) => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  let bestRowMin = 0;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (dp[i][j] < rowMin) rowMin = dp[i][j];
    }
    bestRowMin = Math.max(bestRowMin, rowMin);
    if (bestRowMin > 2) return 3; // early exit if exceeding threshold
  }
  return dp[a.length][b.length];
};

// common synonyms/variants we’ll auto-check (helps “co ord”, “co-ord”, “coord”)
const expandQueryVariants = (q: string) => {
  const base = q.toLowerCase();
  const variants = new Set<string>([base]);

  // normalize hyphen/space variants for common fashion terms
  variants.add(base.replace(/\s*-\s*/g, "")); // "co-ord" -> "coord"
  variants.add(base.replace(/\s+/g, "")); // "co ord set" -> "coordset"
  variants.add(base.replace(/\s+/g, "-")); // "co ord" -> "co-ord"
  variants.add(base.replace(/-/g, " ")); // "co-ord" -> "co ord"

  // basic plurals/singulars (best-effort)
  variants.add(base.replace(/sets?$/, "set"));
  variants.add(base.replace(/dresses$/, "dress"));
  variants.add(base.replace(/kurtis$/, "kurti"));

  return Array.from(variants);
};

// score how well a product name matches the query (0..1)
const fuzzyScore = (name: string, query: string): number => {
  const nameTokens = words(name);
  const nameNorm = norm(name);
  const variants = expandQueryVariants(query);
  const qTokens = words(query);

  // exact-ish contains across variants
  for (const v of variants) {
    const vNorm = norm(v);
    if (!vNorm) continue;
    if (nameNorm.includes(vNorm)) return 1; // strong contains
    if (isSubseq(vNorm, nameNorm)) return 0.8; // subsequence
    const d = editDistLE2(vNorm, nameNorm);
    if (d <= 1) return 0.85;
    if (d === 2) return 0.7;
  }

  // token-wise average similarity
  if (qTokens.length) {
    let total = 0;
    for (const qt of qTokens) {
      const qtNorm = norm(qt);
      let best = 0;
      for (const nt of nameTokens) {
        const ntNorm = norm(nt);
        if (!qtNorm || !ntNorm) continue;
        if (ntNorm.includes(qtNorm)) best = Math.max(best, 0.9);
        else if (isSubseq(qtNorm, ntNorm)) best = Math.max(best, 0.7);
        else {
          const d = editDistLE2(qtNorm, ntNorm);
          if (d <= 1) best = Math.max(best, 0.75);
          else if (d === 2) best = Math.max(best, 0.6);
        }
      }
      total += best;
    }
    return total / qTokens.length;
  }

  return 0;
};

const byScoreThenName = (a: { _score: number; name: string }, b: { _score: number; name: string }) =>
  b._score - a._score || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

/* ---------- Page ---------- */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = (searchParams?.q || "").trim();
  const url = q
    ? `${API_BASE}/api/products?search=${encodeURIComponent(q)}`
    : `${API_BASE}/api/products`;

  let products: any[] = [];
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    products = Array.isArray(data?.productList)
      ? data.productList
      : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data)
      ? data
      : [];
  } catch {
    products = [];
  }

  // Normalize to CardProduct
  let rows: (CardProduct & { _score?: number })[] = products.map((p: any) => {
    const name = (p.product_name || p.name || "Untitled").toString();
    const imgs = extractImages(p);
    const images = (imgs.length ? imgs : ["/images/poster1.png"]).map(imgUrl);
    const band = priceBand(p);

    return {
      _id: String(p._id ?? p.id ?? name),
      slug: p.slug,
      name,
      category: (p.category || "general").toString(),
      images,
      minPrice: band.min,
      maxPrice: band.max,
    };
  });

  // Fuzzy filter + ranking when query present
  if (q) {
    rows = rows
      .map((r) => ({ ...r, _score: fuzzyScore(r.name, q) }))
      .filter((r) => (r._score ?? 0) >= 0.58) // threshold: tweak if needed
      .sort(byScoreThenName);
  } else {
    // No query: sort alphabetically by name
    rows = rows.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }

  const nothingToShow = rows.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Search</h1>
        {q ? (
          <p className="text-sm text-gray-600 mt-1">
            Results for <span className="font-medium">“{q}”</span>
          </p>
        ) : (
          <p className="text-sm text-gray-600 mt-1">All products (A–Z)</p>
        )}
      </div>

      {/* Unified grid (no Ethnic/Western sections) */}
      {nothingToShow ? (
        <div className="text-gray-600 text-center py-8">
          No matching products found.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {rows.map((p) => (
            <ProductCardClient key={p._id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
