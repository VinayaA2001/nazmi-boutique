/* ========= Types ========= */
export type Variant = {
  _id: string;
  size?: string;
  colour?: string;
  stock?: number;
  price?: number;          // undefined when not present/parsable
  images?: string[];
};

export type NormalizedProduct = {
  _id: string;
  slug: string;
  product_code?: string;
  product_name?: string;
  name?: string;
  description?: string;
  category?: string;
  material?: string;
  images: string[];
  image?: string;
  variants?: Variant[];
  availableSizes?: string[];
  availableColors?: string[];
  totalStock?: number;
  minPrice?: number;       // undefined when unknown
  maxPrice?: number;       // undefined when unknown
  price?: number;          // undefined when unknown
  colorImages?: Record<string, string[]>;
  tags?: string[];
  isSale?: boolean;
};

/* ========= Image & money helpers ========= */
const PLACEHOLDER = "/images/placeholder.png";
const CLOUDINARY_BASE = "https://res.cloudinary.com/dq5xhg9uo/image/upload/";

const toFullUrl = (img?: string) =>
  !img ? PLACEHOLDER : img.startsWith("http") ? img : CLOUDINARY_BASE + img.replace(/^\//, "");

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

const toInt = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

// Robust money parser (e.g., 1050, "₹1,050", "¥1,500", "1050/-", "₹2,699")
const toMoney = (v: unknown): number | undefined => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return v > 0 ? v : undefined;
  const str = String(v).trim();
  const cleaned = str.replace(/[₹¥$,]/g, "").replace(/[^\d.]/g, "");
  if (!cleaned) return undefined;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/* ========= Builders / normalizers ========= */
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
    minPrice,                 // may stay undefined
    maxPrice: maxPrice ?? minPrice,
  };
}

function normalizeImages(p: any) {
  const rootImgs = Array.isArray(p?.images) ? p.images : [];
  let imgs = rootImgs.map(toFullUrl);
  if (imgs.length === 0 && Array.isArray(p?.variants) && p.variants.length) {
    const vImgs = (p.variants[0]?.images || []).map(toFullUrl);
    if (vImgs.length) imgs = vImgs;
  }
  return { ...p, images: imgs, image: imgs[0] || PLACEHOLDER };
}

/* ========= Shaper ========= */
export function shapeProduct(raw: any): NormalizedProduct {
  const p = normalizeImages(raw);
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  const derived = deriveFromVariants(variants);

  const product_name = p.product_name || p.name || p.title || p.product_code || "Untitled";
  const _id = typeof p._id === "string" ? p._id : String(p._id ?? "");

  // root-level price candidates
  const rootMin =
    toMoney(p.price) ??
    toMoney(p.minPrice) ??
    toMoney(p.mrp) ??
    toMoney(p.listPrice);

  const minPrice = derived.minPrice ?? rootMin;
  const maxPrice = derived.maxPrice ?? toMoney(p.maxPrice) ?? minPrice;

  const normVariants: Variant[] = variants.map((v: any) => ({
    _id: String(v?._id ?? ""),
    size: v?.size ?? "",
    colour: v?.colour ?? v?.color ?? "",
    stock: toInt(v?.stock ?? v?.quantity),
    price: toMoney(v?.price),                    // stays undefined if not valid
    images: Array.isArray(v?.images) ? v.images.map(toFullUrl) : [],
  }));

  return {
    _id,
    slug: p.slug || slugify(`${product_name}-${p.product_code || _id}`),
    product_code: p.product_code || p.code || "",
    product_name,
    name: product_name,
    description: p.description || p.desc || "",
    category: p.category || "",
    material:
      p.material ??
      p?.specs?.material ??
      p?.details?.material ??
      p?.attributes?.material ??
      "",
    images: p.images,
    image: p.image,
    variants: normVariants,
    availableSizes: derived.availableSizes,
    availableColors: derived.availableColors,
    totalStock: derived.totalStock || toInt(p?.quantity_total ?? p?.quantity ?? p?.stock),
    minPrice,                                    // NOTE: never default to 0
    maxPrice,                                    // NOTE: never default to 0
    price: minPrice,                             // NOTE: may be undefined
    colorImages: buildColorImages(p),
    tags: p.tags || [],
    isSale: Boolean(p.isSale),
  };
}

/* ========= Fetcher =========
   Uses your internal Next API route `/api/product/[slug]` and then shapes the result.
*/
export async function fetchProduct(slug: string): Promise<NormalizedProduct | null> {
  try {
    const res = await fetch(`/api/product/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      // @ts-ignore - Next will treat this as an internal fetch on the server
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const raw = await res.json();
    if (!raw) return null;
    return shapeProduct(raw);
  } catch {
    return null;
  }
}

// Helpful exports for other files
export const _helpers = { toFullUrl, toMoney };
