// app/Ethnic-Wears/[slug]/page.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  ShoppingCart,
  Minus,
  Plus,
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from "lucide-react";

import ProductCardClient, { type CardProduct } from "@/components/commerce/ProductCardClient";

/* ========= Config ========= */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Shipping rules (for info text only; payment handled in /checkout)
const SHIPPING_THRESHOLD = 2000;
const SHIPPING_FEE = 60;

/* ========= Types ========= */
type Variant = {
  _id: string;
  size: string;
  colour: string;
  stock: number;
  price: number;
  images?: string[];
};

type Product = {
  _id: string;
  slug?: string;
  product_code: string;
  product_name?: string;
  material: string;
  category: string;
  images: string[];
  colorImages?: Record<string, string[]>;
  description: string;
  variants: Variant[];
  availableSizes: string[];
  availableColors: string[];
  totalStock: number;
  minPrice: number;
  maxPrice: number;
};

/* ========= Utils ========= */
const imgUrl = (p?: string | null) => {
  if (!p || typeof p !== "string") return "/images/poster1.png";
  let s = String(p).trim();
  if (!s) return "/images/poster1.png";
  if (s.startsWith("//")) s = "https:" + s;
  const backendHost = "nazmi-boutique-2.onrender.com";
  if (s.startsWith(`http://${backendHost}`)) s = s.replace("http://", "https://");
  if (s.startsWith("http://localhost:5000") || s.startsWith("http://127.0.0.1:5000")) {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    if (base) s = base + s.replace(/^http:\/\/(localhost|127\.0\.0\.1):5000/, "");
  }
  if (s.startsWith("http") || s.startsWith("/")) return s;
  return `/images/${s}`;
};

const makeSlug = (p: Product) => {
  const base = p.slug || p.product_name || `${p.material || ""}-${p.category || ""}`.trim();
  const code = p.product_code ? `-${p.product_code}` : "";
  return (base + code).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
};

const displayName = (p: Product) => p.product_name || `${p.material} ${p.category}`;
const inr = (n: number | string) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const norm = (s?: string) => (s ?? "").trim().toLowerCase();
const same = (a?: string, b?: string) => norm(a) === norm(b);

// Dedupe helpers
const firstImage = (p: Product) =>
  Array.isArray(p.images) && p.images.length ? p.images[0] : "";

// Prefer product.images, then any colorImages, then variant images
const extractImages = (p: Product): string[] => {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (p.colorImages && typeof p.colorImages === "object") {
    for (const arr of Object.values(p.colorImages)) {
      if (Array.isArray(arr) && arr.length) return arr as string[];
    }
  }
  if (Array.isArray(p.variants)) {
    for (const v of p.variants) {
      if (Array.isArray(v.images) && v.images.length) return v.images;
    }
  }
  return [];
};

// Guard against western items leaking into ethnic contexts
const ETHNIC_WORDS = [
  "ethnic",
  "traditional",
  "saree",
  "salwar",
  "kurta",
  "lehenga",
  "anarkali",
  "churidar",
  "dupatta",
  "mundu",
  "set",
];
const WESTERN_WORDS = [
  "western",
  "jeans",
  "denim",
  "top",
  "tops",
  "dress",
  "skirt",
  "shirt",
  "t-shirt",
  "trouser",
  "jacket",
  "officewear",
];
const isEthnicOnly = (p: Product): boolean => {
  const hay = `${p.category} ${p.material} ${p.product_name} ${p.description}`.toLowerCase();
  const hasEthnic = ETHNIC_WORDS.some((k) => hay.includes(k));
  const hasWestern = WESTERN_WORDS.some((k) => hay.includes(k));
  return hasEthnic || (!hasWestern && (p.category || "").toLowerCase().includes("ethnic"));
};

// Price band helpers
const num = (v: any): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const bandFrom = (p: any): { min?: number; max?: number } => {
  const minP = num(p?.minPrice);
  const maxP = num(p?.maxPrice);
  if (minP && maxP) return { min: minP, max: maxP };
  const prices: number[] = Array.isArray(p?.variants)
    ? (p.variants
        .map((v: any) => num(v?.price))
        .filter((n: any) => typeof n === "number") as number[])
    : [];
  if (prices.length) return { min: Math.min(...prices), max: Math.max(...prices) };
  const single = num(p?.price);
  return single ? { min: single, max: single } : {};
};

const cloudinaryPublicId = (url: string) => {
  try {
    const path = new URL(url).pathname;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last.replace(/\.[a-z0-9]+$/i, "");
  } catch {
    const last = url.split("/").filter(Boolean).pop() || "";
    return last.replace(/\.[a-z0-9]+$/i, "");
  }
};

const canonicalKey = (p: Product) => {
  const name = norm(p.product_name);
  const mat = norm(p.material);
  const imgK = cloudinaryPublicId(firstImage(p));
  return `${name}__${mat}__${imgK}`;
};

function shuffleInPlace<T>(arr: T[]): T[] {
  const a = [...arr];
  const rand =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
      : Math.random;
  for (let m = a.length - 1; m > 0; m--) {
    const i = Math.floor(rand() * (m + 1));
    [a[m], a[i]] = [a[i], a[m]];
  }
  return a;
}

/* ========= Related Products ========= */
function RelatedProductsClient({
  currentId,
  currentSlug,
  category,
  limit = 10,
  title = "Related Products",
}: {
  currentId: string;
  currentSlug?: string;
  category: string;
  limit?: number;
  title?: string;
}) {
  const [rows, setRows] = useState<CardProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const base = API_BASE || "";
        const url = `${base}/api/products?limit=${limit + 32}`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error("failed");
        const data = await r.json();
        const list: Product[] = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data)
          ? data
          : [];

        const sameCategory = list.filter(
          (p) => p && p.category && p._id && same(p.category, category) && isEthnicOnly(p)
        );

        const notCurrent = sameCategory.filter(
          (p) => String(p._id) !== String(currentId) && !same(p.slug, currentSlug)
        );

        const seen = new Set<string>();
        const unique: Product[] = [];
        for (const p of notCurrent) {
          const k = canonicalKey(p);
          if (seen.has(k)) continue;
          seen.add(k);
          unique.push(p);
        }

        const shuffled = shuffleInPlace(unique);
        const mapped: CardProduct[] = shuffled.slice(0, limit).map((p) => {
          const imgs = extractImages(p);
          const band = bandFrom(p);
          return {
            _id: String(p._id),
            slug: p.slug || makeSlug(p),
            name: p.product_name || "Untitled",
            category: p.category,
            images: (imgs.length ? imgs : ["/images/poster1.png"]).map(imgUrl),
            minPrice: band.min,
            maxPrice: band.max,
          };
        });

        if (alive) setRows(mapped);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [category, currentId, currentSlug, limit]);

  if (loading || rows.length === 0) return null;

  return (
    <section className="py-10 sm:py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">Similar items in {category}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {rows.map((p) => (
            <ProductCardClient key={p._id} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========= Page Component ========= */
export default function ProductDetailPage() {
  const params = useParams();
  const slugParamRaw = ((): string => {
    const v: unknown = (params as any)?.slug;
    if (Array.isArray(v)) return v[0] ?? "";
    if (typeof v === "string") return v;
    return "";
  })();

  const search = useSearchParams();
  const router = useRouter();

  /* Data */
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);

  /* Variant/UI state */
  const [color, setColor] = useState<string>(search.get("color") || "");
  const [size, setSize] = useState<string>(search.get("size") || "");
  const [imgIndex, setImgIndex] = useState(0);
  const [qty, setQty] = useState(1);

  /* Wishlist/Cart state */
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [showCartToast, setShowCartToast] = useState(false);
  const [addedName, setAddedName] = useState("");

  /* ========= Fetch Product ========= */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setProduct(null);
      try {
        const slugParam = decodeURIComponent(String(slugParamRaw || "")).toLowerCase();

        const one = await fetch(`/api/products/${slugParam}`, { cache: "no-store" });
        if (one.ok) {
          const p: Product = await one.json();
          p.images = (p.images?.length ? p.images : ["/images/poster1.png"]).map(imgUrl);
          if (p.colorImages)
            Object.keys(p.colorImages).forEach((c) => {
              p.colorImages![c] = (p.colorImages![c] || []).map(imgUrl);
            });
          setProduct(p);
          return;
        }

        const res = await fetch("/api/products", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load products");
        const list: Product[] = await res.json();

        list.forEach((p: any) => {
          p.images = (
            Array.isArray(p.images) && p.images.length ? p.images : ["/images/poster1.png"]
          ).map(imgUrl);
          if (p.colorImages) {
            Object.keys(p.colorImages).forEach((c) => {
              p.colorImages[c] = (p.colorImages[c] || []).map(imgUrl);
            });
          }
        });

        const found =
          list.find((p) => (p.slug || "").toLowerCase() === slugParam) ||
          list.find((p) => makeSlug(p) === slugParam) ||
          list.find((p) => (p._id as any)?.toLowerCase?.() === slugParam) ||
          list.find((p) => (p.product_code || "").toLowerCase() === slugParam) ||
          null;

        setProduct(found);
      } catch (e) {
        console.error("[Detail] fetch error:", e);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slugParamRaw]);

  /* ========= Full options ========= */
  const fullColors = useMemo(() => {
    if (!product) return [] as string[];
    const fromBackend = (product.availableColors || []).filter(Boolean);
    const fromVariants = Array.from(
      new Set(product.variants.map((v) => v.colour).filter(Boolean))
    );
    const base = fromBackend.length ? fromBackend : fromVariants;
    const seen = new Set<string>(),
      out: string[] = [];
    for (const c of base) {
      const k = norm(c);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(c);
      }
    }
    return out;
  }, [product]);

  const fullSizes = useMemo(() => {
    if (!product) return [] as string[];
    const fromBackend = (product.availableSizes || []).filter(Boolean);
    const fromVariants = Array.from(new Set(product.variants.map((v) => v.size).filter(Boolean)));
    const base = fromBackend.length ? fromBackend : fromVariants;
    const seen = new Set<string>(),
      out: string[] = [];
    for (const s of base) {
      const k = norm(s);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(s);
      }
    }
    return out;
  }, [product]);

  /* ========= Init defaults & sync URL ========= */
  useEffect(() => {
    if (!product) return;
    const colors = fullColors;
    const sizes = fullSizes;
    const firstInStock = product.variants.find((v) => v.stock > 0) || product.variants[0];
    const c = color || firstInStock?.colour || colors[0] || "";
    const s = size || firstInStock?.size || sizes[0] || "";

    if (c && !same(c, color)) setColor(c);
    if (s && !same(s, size)) setSize(s);

    const q = new URLSearchParams(search.toString());
    let changed = false;
    if (c && q.get("color") !== c) {
      q.set("color", c);
      changed = true;
    }
    if (s && q.get("size") !== s) {
      q.set("size", s);
      changed = true;
    }
    if (changed) {
      router.replace(`/Ethnic-Wears/${slugParamRaw}?${q.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, fullColors.length, fullSizes.length]);

  /* ========= Variant helpers ========= */
  const variant = useMemo(() => {
    if (!product) return null;
    return (
      product.variants.find(
        (v) => (!color || same(v.colour, color)) && (!size || same(v.size, size))
      ) || null
    );
  }, [product, color, size]);

  const gallery = useMemo(() => {
    if (!product) return ["/images/poster1.png"];
    if (variant?.images?.length) return variant.images.map(imgUrl);
    if (product.colorImages?.[color]?.length) return product.colorImages[color]!.map(imgUrl);
    return product.images;
  }, [product, variant, color]);

  const galleryKey = useMemo(() => gallery.join("|"), [gallery]);
  useEffect(() => setImgIndex(0), [galleryKey]);

  const price = variant ? variant.price : product?.minPrice || 0;
  const stock = variant ? variant.stock : product?.totalStock || 0;

  // Shipping calculations (for display only; actual payment in /checkout)
  const unitPrice = Number(variant?.price ?? price ?? 0);
  const subtotal = unitPrice * qty;
  const shippingFee = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  const colorsAvail = fullColors;
  const sizesAvail = fullSizes;

  const pickColor = (c: string) => {
    if (!product) return;
    setColor(c);
    const hasPair =
      size &&
      product.variants.some((v) => same(v.colour, c) && same(v.size, size) && v.stock > 0);
    const nextSize =
      hasPair
        ? size
        : fullSizes.find((s) =>
            product.variants.some(
              (v) => same(v.colour, c) && same(v.size, s) && v.stock > 0
            )
          ) || "";
    if (nextSize !== size) setSize(nextSize);
    const q = new URLSearchParams(search.toString());
    if (c) q.set("color", c);
    if (nextSize) q.set("size", nextSize);
    router.replace(`/Ethnic-Wears/${slugParamRaw}?${q.toString()}`);
  };

  const pickSize = (s: string) => {
    if (!product) return;
    setSize(s);
    const hasPair =
      color &&
      product.variants.some((v) => same(v.size, s) && same(v.colour, color) && v.stock > 0);
    const nextColor =
      hasPair
        ? color
        : fullColors.find((c) =>
            product.variants.some(
              (v) => same(v.size, s) && same(v.colour, c) && v.stock > 0
            )
          ) || "";
    if (nextColor !== color) setColor(nextColor);
    const q = new URLSearchParams(search.toString());
    if (nextColor) q.set("color", nextColor);
    if (s) q.set("size", s);
    router.replace(`/Ethnic-Wears/${slugParamRaw}?${q.toString()}`);
  };

  /* ========= Wishlist ========= */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const w = localStorage.getItem("wishlist");
      if (w) {
        const arr = JSON.parse(w);
        setWishlistIds(new Set(arr.map((i: any) => i.id)));
      }
    } catch {}
  }, []);
  const inWishlist = (pid: string) => wishlistIds.has(pid);

  const toggleWishlist = () => {
    if (!product) return;
    const id = product._id;
    const item = {
      id,
      productId: id,
      name: displayName(product),
      price: product.minPrice,
      image: (gallery[0] || product.images[0]) ?? "/images/poster1.png",
      productCode: product.product_code,
    };
    let existing: any[] = [];
    try {
      const data = localStorage.getItem("wishlist");
      if (data) existing = JSON.parse(data);
    } catch {}
    const has = existing.find((x: any) => x.id === id);
    const updated = has ? existing.filter((x: any) => x.id !== id) : [...existing, item];
    localStorage.setItem("wishlist", JSON.stringify(updated));
    setWishlistIds(new Set(updated.map((i: any) => i.id)));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("wishlist-updated"));
  };

  /* ========= Cart ========= */
  const addToCart = () => {
    if (!product || !variant) {
      alert("Please select available options.");
      return;
    }
    if (qty > variant.stock) {
      alert(`Only ${variant.stock} available.`);
      return;
    }
    const item = {
      id: `${product._id}-${variant.size}-${variant.colour}`,
      productId: product._id,
      variantId: variant._id,
      name: displayName(product),
      price: variant.price,
      image: (gallery[0] || product.images[0]) ?? "/images/poster1.png",
      quantity: qty,
      size: variant.size,
      color: variant.colour,
      productCode: product.product_code,
      material: product.material,
      category: product.category,
      maxStock: variant.stock,
    };
    let existing: any[] = [];
    try {
      const d = localStorage.getItem("cart");
      if (d) existing = JSON.parse(d);
    } catch {}
    const idx = existing.findIndex((i: any) => i.id === item.id);
    if (idx > -1) {
      const newQty = existing[idx].quantity + qty;
      if (newQty > item.maxStock) {
        alert(
          `Only ${item.maxStock} available. You already have ${existing[idx].quantity} in cart.`
        );
        return;
      }
      existing[idx] = { ...existing[idx], quantity: newQty };
    } else {
      existing.push(item);
    }
    localStorage.setItem("cart", JSON.stringify(existing));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("cart-updated"));
    setAddedName(displayName(product));
    setShowCartToast(true);
    setTimeout(() => setShowCartToast(false), 2500);
  };

  /* ========= Direct Order (go to /checkout) ========= */
  const orderNow = () => {
    if (!product || !variant) {
      alert("Please select available options.");
      return;
    }
    if (qty > variant.stock) {
      alert(`Only ${variant.stock} available.`);
      return;
    }

    const directItem = {
      id: `${product._id}-${variant.size}-${variant.colour}`,
      productId: product._id,
      name: displayName(product),
      price: variant.price,
      image: (gallery[0] || product.images[0]) ?? "/images/poster1.png",
      quantity: qty,
      size: variant.size,
      color: variant.colour,
      productCode: product.product_code,
      maxStock: variant.stock,
      isDirectOrder: true,
    };

    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("directOrder", JSON.stringify([directItem]));
      }
      router.push("/checkout?type=direct");
    } catch (e) {
      console.error("Failed to start direct checkout", e);
      alert("Unable to start checkout. Please try again or add to cart instead.");
    }
  };

  /* ========= Lightbox / Zoom ========= */
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setLightboxOpen(true);
  };
  const closeLightbox = () => {
    setLightboxOpen(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const zoomIn = () => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)));
  const resetZoom = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const onWheelZoom: React.WheelEventHandler = (e) => {
    if (!lightboxOpen) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  const onMouseDown: React.MouseEventHandler = (e) => {
    if (zoom === 1) return;
    setPanning(true);
    startRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onMouseMove: React.MouseEventHandler = (e) => {
    if (!panning || !startRef.current) return;
    setOffset({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  };
  const onMouseUp = () => setPanning(false);
  const onMouseLeave = () => setPanning(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart: React.TouchEventHandler = (e) => {
    if (zoom === 1) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX - offset.x, y: t.clientY - offset.y };
  };
  const onTouchMove: React.TouchEventHandler = (e) => {
    if (!touchStartRef.current || zoom === 1) return;
    const t = e.touches[0];
    setOffset({ x: t.clientX - touchStartRef.current.x, y: t.clientY - touchStartRef.current.y });
  };

  /* ========= Render ========= */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-700">Product not found.</p>
        <Link
          href="/Ethnic-Wears"
          className="text-sm px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-100"
        >
          Back to Ethnic Collection
        </Link>
      </div>
    );
  }

  const wishActive = inWishlist(product._id);

  return (
    <div className="min-h-screen bg-white">
      {/* Cart toast */}
      {showCartToast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <Check className="w-5 h-5" />
          <div>
            <p className="text-sm font-medium">Added to Cart</p>
            <p className="text-xs opacity-90">{addedName}</p>
          </div>
          <button
            onClick={() => setShowCartToast(false)}
            className="ml-2 hover:bg-green-600 rounded-full p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Product details */}
      <div className="container mx-auto px-4 pb-10">
        <div className="grid md:grid-cols-2 gap-8">
          {/* LEFT: Gallery */}
          <div>
            <button
              type="button"
              onClick={() => openLightbox(imgIndex)}
              className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 w-full"
              aria-label="Open image viewer"
            >
              <Image
                src={imgUrl(gallery[imgIndex])}
                alt={displayName(product)}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-cover"
              />
            </button>

            {gallery.length > 1 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {gallery.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    onDoubleClick={() => openLightbox(i)}
                    className={`relative aspect-square rounded border-2 overflow-hidden ${
                      imgIndex === i ? "border-black" : "border-transparent"
                    }`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <Image
                      src={imgUrl(g)}
                      alt={`${displayName(product)} view ${i + 1}`}
                      fill
                      sizes="(max-width: 768px) 25vw, 120px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Tip: double-click a thumbnail to open fullscreen.
            </p>
          </div>

          {/* RIGHT: Essentials ONLY */}
          <div>
            {/* Title + Wishlist */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-light text-gray-900">
                  {displayName(product)}
                </h1>
                {product.product_code && (
                  <p className="text-sm text-gray-500 mt-1">
                    Product Code: {product.product_code}
                  </p>
                )}
              </div>
              <button
                onClick={toggleWishlist}
                className={`w-10 h-10 rounded-full border flex items-center justify-center ${
                  wishActive
                    ? "border-red-500 text-red-500"
                    : "border-gray-300 text-gray-600 hover:text-red-500"
                }`}
                aria-label="Wishlist"
                title={wishActive ? "Remove from Wishlist" : "Add to Wishlist"}
              >
                <Heart className={`w-5 h-5 ${wishActive ? "fill-current" : ""}`} />
              </button>
            </div>

            {/* Essentials list */}
            <div className="mt-4 space-y-1 text-sm">
              <p>
                <span className="text-gray-500">Material:</span>{" "}
                <span className="font-medium text-gray-900">{product.material}</span>
              </p>
              <p>
                <span className="text-gray-500">Price:</span>{" "}
                <span className="font-medium text-gray-900">{inr(price)}</span>
              </p>
              <p>
                <span className="text-gray-500">Color:</span>{" "}
                <span className="font-medium text-gray-900">{color || "—"}</span>
              </p>
              <p>
                <span className="text-gray-500">Size:</span>{" "}
                <span className="font-medium text-gray-900">{size || "—"}</span>
              </p>
            </div>

            {/* Price (prominent) */}
            <div className="mt-4">
              <span className="text-3xl font-light text-gray-900">{inr(price)}</span>
              {product.minPrice !== product.maxPrice && (
                <span className="ml-2 text-sm text-gray-500">
                  (range {inr(product.minPrice)}–{inr(product.maxPrice)})
                </span>
              )}
              <div className="mt-2 text-xs text-gray-600">
                {subtotal >= SHIPPING_THRESHOLD ? (
                  <span className="text-green-700 font-medium">
                    ✅ Free Shipping on this order
                  </span>
                ) : (
                  <span>
                    🚚 Shipping: {inr(SHIPPING_FEE)} (free above {inr(SHIPPING_THRESHOLD)})
                  </span>
                )}
              </div>
            </div>

            {/* Color picker */}
            {fullColors.length > 0 && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Select Color {color && `: ${color}`}
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorsAvail.map((c) => {
                    const disabled = !product.variants.some(
                      (v) =>
                        same(v.colour, c) &&
                        (!size || same(v.size, size)) &&
                        v.stock > 0
                    );
                    return (
                      <button
                        key={c}
                        onClick={() => !disabled && pickColor(c)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                          same(color, c)
                            ? "border-black bg-black text-white"
                            : "border-gray-300 hover:border-gray-400"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={disabled}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size picker */}
            {fullSizes.length > 0 && (
              <div className="mt-5">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Select Size {size && `: ${size}`}
                </label>
                <div className="flex flex-wrap gap-2">
                  {sizesAvail.map((s) => {
                    const disabled = !product.variants.some(
                      (v) =>
                        same(v.size, s) &&
                        (!color || same(v.colour, color)) &&
                        v.stock > 0
                    );
                    return (
                      <button
                        key={s}
                        onClick={() => !disabled && pickSize(s)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                          same(size, s)
                            ? "border-black bg-black text-white"
                            : "border-gray-300 hover:border-gray-400"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={disabled}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock + Qty */}
            <div className="mt-6 flex items-center gap-4">
              <p
                className={`text-sm font-medium ${
                  stock > 5
                    ? "text-green-600"
                    : stock > 0
                    ? "text-yellow-700"
                    : "text-red-600"
                }`}
              >
                {stock > 0 ? `${stock} in stock` : "Out of stock"}
              </p>
              {stock > 0 && (
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 hover:bg-gray-100"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(stock, q + 1))}
                    className="w-10 h-10 hover:bg-gray-100"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                disabled={!variant || stock === 0}
                onClick={addToCart}
                className={`flex-1 bg-black text-white py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors font-medium inline-flex items-center justify-center gap-2 ${
                  !variant || stock === 0 ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </button>
              <button
                disabled={!variant || stock === 0}
                onClick={orderNow}
                className={`flex-1 border py-3 px-6 rounded-lg transition-colors font-medium ${
                  !variant || stock === 0
                    ? "border-gray-300 text-gray-400 cursor-not-allowed"
                    : "border-black text-black hover:bg-black hover:text-white"
                }`}
              >
                Order Now
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Secure online payment via Razorpay • Easy returns for damaged items • Fast shipping in
              Kerala
            </div>
          </div>
        </div>
      </div>

      {/* Related products */}
      <RelatedProductsClient
        currentId={product._id}
        currentSlug={product.slug || makeSlug(product)}
        category={product.category}
        limit={10}
      />

      {/* ===== Fullscreen Lightbox with Zoom ===== */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 text-white flex flex-col"
          onWheel={onWheelZoom}
          role="dialog"
          aria-modal="true"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div className="text-sm opacity-80">
              {displayName(product)} • {lightboxIndex + 1}/{gallery.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={zoomOut}
                className="px-2 py-1 rounded hover:bg-white/10"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="w-12 text-center text-xs">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="px-2 py-1 rounded hover:bg-white/10"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={resetZoom}
                className="px-2 py-1 rounded hover:bg-white/10"
                aria-label="Reset zoom"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={closeLightbox}
                className="ml-2 px-2 py-1 rounded hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image area */}
          <div
            className="flex-1 relative overflow-hidden"
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                cursor: zoom > 1 ? (panning ? ("grabbing" as const) : "grab") : "zoom-in",
              }}
              onDoubleClick={() => (zoom === 1 ? zoomIn() : resetZoom())}
            >
              <div
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transition: panning ? "none" : "transform 120ms ease-out",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl(gallery[lightboxIndex])}
                  alt={`Zoom ${lightboxIndex + 1}`}
                  className="max-h-[90vh] max-w-[92vw] object-contain select-none"
                  draggable={false}
                />
              </div>
            </div>
          </div>

          {/* Thumbnails row */}
          {gallery.length > 1 && (
            <div className="p-3 border-t border-white/10 overflow-x-auto">
              <div className="flex gap-2">
                {gallery.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setLightboxIndex(i);
                      resetZoom();
                    }}
                    className={`relative w-16 h-16 rounded overflow-hidden border ${
                      i === lightboxIndex ? "border-white" : "border-white/20"
                    }`}
                    aria-label={`Open image ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl(g)}
                      alt={`thumb ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
