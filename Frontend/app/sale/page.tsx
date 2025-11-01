// app/sale/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, X, Check, Tag, XCircle, SlidersHorizontal } from "lucide-react";

/* ---------- Types ---------- */
type Variant = {
  _id?: string;
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
  description: string;
  variants: Variant[];
  availableSizes: string[];
  availableColors: string[];
  totalStock: number;
  minPrice: number;
  maxPrice: number;
  hasMultipleOptions?: boolean;
};

/* ---------- Helpers ---------- */
const imgUrl = (p?: string | null) => {
  if (!p || typeof p !== "string") return "/images/placeholder.jpg";
  if (p.startsWith("http") || p.startsWith("/")) return p;
  return `/images/${p}`;
};

function calcMRPFromDiscount(discounted: number) {
  // Option B: show MRP such that discounted is 30% OFF → discounted = 0.7 * MRP
  // Round to nearest 10 for retail-style price (looks like your screenshot)
  const mrpRaw = discounted / 0.7;
  const rounded = Math.round(mrpRaw / 10) * 10;
  return Math.max(rounded, Math.ceil(mrpRaw)); // safety
}

function normalizeProduct(raw: any): Product {
  const variants: Variant[] = Array.isArray(raw.variants) ? raw.variants : [];

  const derivedSizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
  const derivedColors = Array.from(new Set(variants.map((v) => v.colour).filter(Boolean)));

  const availableSizes: string[] = raw.availableSizes?.length ? raw.availableSizes : derivedSizes;
  const availableColors: string[] = raw.availableColors?.length ? raw.availableColors : derivedColors;

  const totalStock =
    typeof raw.totalStock === "number"
      ? raw.totalStock
      : variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

  const allPrices = variants.map((v) => Number(v.price)).filter((n) => !Number.isNaN(n));
  const minPrice =
    typeof raw.minPrice === "number"
      ? raw.minPrice
      : allPrices.length
      ? Math.min(...allPrices)
      : Number(raw.price) || 0;
  const maxPrice =
    typeof raw.maxPrice === "number"
      ? raw.maxPrice
      : allPrices.length
      ? Math.max(...allPrices)
      : minPrice;

  const images: string[] =
    Array.isArray(raw.images) && raw.images.length ? raw.images.map(imgUrl) : ["/images/placeholder.jpg"];

  const hasMultipleOptions =
    (variants?.length || 0) > 1 || (availableSizes?.length || 0) > 1 || (availableColors?.length || 0) > 1;

  return {
    _id: String(raw._id),
    slug: raw.slug,
    product_code: raw.product_code ?? "",
    product_name: raw.product_name ?? "",
    material: raw.material ?? "",
    category: raw.category ?? "",
    images,
    description: raw.description ?? "",
    variants,
    availableSizes,
    availableColors,
    totalStock,
    minPrice,
    maxPrice,
    hasMultipleOptions,
  };
}

function makeSlug(p: Product) {
  if (p.slug) return p.slug;
  const base = p.product_name?.length ? p.product_name : `${p.material}-${p.category}`;
  const code = p.product_code ? `-${p.product_code}` : "";
  return (base + code).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

/* ---------- Category guards ---------- */
const WESTERN_KEYS = [
  "western",
  "western-wear",
  "jeans",
  "denim",
  "top",
  "shirt",
  "t-shirt",
  "skirt",
  "dress",
  "trousers",
  "pants",
  "jacket",
  "coord",
  "co-ord",
  "blazer",
  "hoodie",
  "sweatshirt",
  "officewear",
];
const ETHNIC_KEYS = [
  "ethnic",
  "ethnic-wear",
  "saree",
  "salwar",
  "kurta",
  "lehenga",
  "anarkali",
  "traditional",
  "sherwani",
];

const isWestern = (p: Product) => {
  const hay = `${p.category} ${p.material} ${p.product_name}`.toLowerCase();
  return WESTERN_KEYS.some((k) => hay.includes(k));
};
const isEthnic = (p: Product) => {
  const hay = `${p.category} ${p.material} ${p.product_name}`.toLowerCase();
  return ETHNIC_KEYS.some((k) => hay.includes(k));
};

/* ---------- Component ---------- */
export default function SaleListingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // toast (optional)
  const [showCartToast, setShowCartToast] = useState(false);
  const [addedName, setAddedName] = useState("");

  // ----- Filter state -----
  type CatFilter = "all" | "ethnic" | "western";
  const [categoryFilter, setCategoryFilter] = useState<CatFilter>("all");
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(0);
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());

  const clearFilters = () => {
    setCategoryFilter("all");
    setSelectedSizes(new Set());
    setSelectedColors(new Set());
    setPriceMin(globalMinPrice);
    setPriceMax(globalMaxPrice);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all sale items that are in stock
      const res = await fetch("/api/products?sale=1&inStock=1", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid data format");
      setProducts(data.map(normalizeProduct));
    } catch (e: any) {
      setError(e.message || "Failed to load sale products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    try {
      const w = localStorage.getItem("wishlist");
      if (w) setWishlist(new Set(JSON.parse(w).map((i: any) => i.id)));
    } catch {}
  }, []);

  const toggleWishlist = (p: Product) => {
    const id = p._id;
    let existing: any[] = [];
    try {
      const d = localStorage.getItem("wishlist");
      if (d) existing = JSON.parse(d);
    } catch {}
    const has = existing.find((x: any) => x.id === id);
    const item = {
      id,
      productId: id,
      name: p.product_name || `${p.material} ${p.category}`,
      price: p.minPrice,
      image: p.images?.[0] || "/images/placeholder.jpg",
      productCode: p.product_code,
    };
    const updated = has ? existing.filter((x: any) => x.id !== id) : [...existing, item];
    localStorage.setItem("wishlist", JSON.stringify(updated));
    setWishlist(new Set(updated.map((x: any) => x.id)));
    window.dispatchEvent(new Event("wishlist-updated"));
  };
  const inWishlist = (id: string) => wishlist.has(id);

  // Base: keep only western ≤ 500 and ethnic ≤ 1500, and in stock
  const baseSaleProducts = useMemo(() => {
    return products
      .filter((p) => (p.totalStock ?? 0) > 0)
      .filter((p) => {
        if (isWestern(p)) return p.minPrice <= 500;
        if (isEthnic(p)) return p.minPrice <= 1500;
        return false;
      });
  }, [products]);

  // Compute option lists and global price range from base set
  const { allSizes, allColors, globalMinPrice, globalMaxPrice } = useMemo(() => {
    const sizes = new Set<string>();
    const colors = new Set<string>();
    let minP = Number.POSITIVE_INFINITY;
    let maxP = 0;

    for (const p of baseSaleProducts) {
      p.availableSizes?.forEach((s) => s && sizes.add(String(s)));
      p.availableColors?.forEach((c) => c && colors.add(String(c)));
      if (typeof p.minPrice === "number") minP = Math.min(minP, p.minPrice);
      if (typeof p.maxPrice === "number") maxP = Math.max(maxP, p.maxPrice);
    }
    if (!Number.isFinite(minP)) minP = 0;

    return {
      allSizes: Array.from(sizes).sort(),
      allColors: Array.from(colors).sort(),
      globalMinPrice: minP,
      globalMaxPrice: maxP,
    };
  }, [baseSaleProducts]);

  // Initialize price inputs on first load of base set
  useEffect(() => {
    if (baseSaleProducts.length) {
      setPriceMin(globalMinPrice);
      setPriceMax(globalMaxPrice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalMinPrice, globalMaxPrice, baseSaleProducts.length]);

  // Apply UI filters
  const filteredProducts = useMemo(() => {
    return baseSaleProducts.filter((p) => {
      // Category toggle
      if (categoryFilter === "ethnic" && !isEthnic(p)) return false;
      if (categoryFilter === "western" && !isWestern(p)) return false;

      // Price overlap (based on discounted range minPrice–maxPrice)
      const priceOverlap =
        (p.minPrice <= priceMax && p.maxPrice >= priceMin) ||
        (p.minPrice >= priceMin && p.minPrice <= priceMax);
      if (!priceOverlap) return false;

      // Size
      if (selectedSizes.size) {
        const sizes = new Set((p.availableSizes || []).map((s) => String(s)));
        const ok = Array.from(selectedSizes).some((s) => sizes.has(s));
        if (!ok) return false;
      }

      // Color (case-insensitive)
      if (selectedColors.size) {
        const colors = new Set((p.availableColors || []).map((c) => String(c).toLowerCase()));
        const ok = Array.from(selectedColors).some((c) => colors.has(c.toLowerCase()));
        if (!ok) return false;
      }

      return true;
    });
  }, [baseSaleProducts, categoryFilter, priceMin, priceMax, selectedSizes, selectedColors]);

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-white grid place-items-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading sale picks…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white grid place-items-center">
        <div className="text-center">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-12 h-12 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load</h3>
          <p className="text-gray-600 mb-4 max-w-md">{error}</p>
          <button onClick={fetchProducts} className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Banners */}
      <section aria-label="Sale banners">
        <div className="mx-auto max-w-7xl px-4 pt-12 pb-4">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Western ≤ ₹500", image: "/images/sales2.png", badge: "Steals", note: "Best-value western picks" },
              { title: "Ethnic ≤ ₹1500", image: "/images/sales3.png", badge: "Great Deals", note: "Budget ethnic favourites" },
              { title: "Last Chance", image: "/images/sales1.png", badge: "Limited stock", note: "Final pieces on sale" },
            ].map((c) => (
              <div key={c.title} className="relative overflow-hidden rounded-2xl border border-black/15 bg-white shadow-sm">
                <div className="relative h-40 md:h-44">
                  <Image src={c.image} alt={c.title} fill className="object-cover" priority />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base md:text-lg font-semibold text-neutral-900">{c.title}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 border border-amber-200">
                      <Tag className="h-3.5 w-3.5" />
                      {c.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{c.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filters bar */}
      <div className="sticky top-0 z-30 border-y border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  <option value="all">All</option>
                  <option value="ethnic">Ethnic</option>
                  <option value="western">Western</option>
                </select>
              </div>

              {/* Price */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Min</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="h-9 w-28 px-2 rounded-lg border border-gray-200 text-sm"
                  value={priceMin}
                  min={globalMinPrice}
                  max={priceMax}
                  onChange={(e) => setPriceMin(Math.max(Number(e.target.value || 0), globalMinPrice))}
                />
              </div>
              <span className="self-end pb-2 text-gray-400">—</span>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Max</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="h-9 w-28 px-2 rounded-lg border border-gray-200 text-sm"
                  value={priceMax}
                  min={priceMin}
                  max={globalMaxPrice}
                  onChange={(e) => setPriceMax(Math.min(Number(e.target.value || 0), globalMaxPrice))}
                />
              </div>

              {/* Size */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Size</label>
                <select
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = new Set(selectedSizes);
                    if (!v) next.clear();
                    else {
                      if (next.has(v)) next.delete(v);
                      else next.add(v);
                    }
                    setSelectedSizes(next);
                  }}
                  className="h-9 min-w-36 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                  value=""
                >
                  <option value="">All Sizes</option>
                  {allSizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color */}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Color</label>
                <select
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase();
                    const next = new Set(selectedColors);
                    if (!v) next.clear();
                    else {
                      if (next.has(v)) next.delete(v);
                      else next.add(v);
                    }
                    setSelectedColors(next);
                  }}
                  className="h-9 min-w-36 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                  value=""
                >
                  <option value="">All Colors</option>
                  {allColors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs px-3 h-9 rounded-lg border border-gray-300 hover:bg-gray-50"
                title="Clear all filters"
              >
                <XCircle className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>

          {/* Active selections */}
          <div className="mt-2 flex flex-wrap gap-2">
            {categoryFilter !== "all" && (
              <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                {categoryFilter === "ethnic" ? "Ethnic" : "Western"}
              </span>
            )}
            {(priceMin > globalMinPrice || priceMax < globalMaxPrice) && (
              <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                ₹{priceMin}–₹{priceMax}
              </span>
            )}
            {Array.from(selectedSizes).map((s) => (
              <button
                key={`sz-${s}`}
                onClick={() => {
                  const next = new Set(selectedSizes);
                  next.delete(s);
                  setSelectedSizes(next);
                }}
                className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200"
              >
                Size: {s} ✕
              </button>
            ))}
            {Array.from(selectedColors).map((c) => (
              <button
                key={`cl-${c}`}
                onClick={() => {
                  const next = new Set(selectedColors);
                  next.delete(c);
                  setSelectedColors(next);
                }}
                className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200"
              >
                Color: {c} ✕
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto px-4 pb-12">
        {filteredProducts.length > 0 && (
          <p className="text-sm text-gray-600 mb-4">
            Showing <span className="font-medium text-gray-900">{filteredProducts.length}</span> items
          </p>
        )}

        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-600 mb-4">No matching sale products right now.</p>
            <button onClick={clearFilters} className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {filteredProducts.map((p) => {
              const name = p.product_name || `${p.material} ${p.category}`;
              const slug = makeSlug(p);
              const firstInStock = p.variants.find((v) => Number(v.stock) > 0) || p.variants[0];
              const q = firstInStock
                ? `?color=${encodeURIComponent(firstInStock.colour)}&size=${encodeURIComponent(firstInStock.size)}`
                : "";

              // Price presentation (Option B)
              const discountedMin = Math.round(p.minPrice);
              const discountedMax = Math.round(p.maxPrice);
              const mrpMin = calcMRPFromDiscount(discountedMin);
              const mrpMax = calcMRPFromDiscount(discountedMax);

              return (
                <Link
                  key={`${p._id}-${p.product_code}`}
                  href={`/sale/${slug}${q}`}
                  className="group bg-white rounded-lg overflow-hidden transform transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow-xl border border-gray-100"
                >
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <Image
                      src={imgUrl(p.images[0])}
                      alt={name}
                      fill
                      className="object-cover group-hover:scale-110 transition duration-500"
                    />
                    {/* 30% OFF Badge */}
                    <div className="absolute left-2 top-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 text-white">
                        30% OFF
                      </span>
                    </div>
                    {/* Wishlist */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        toggleWishlist(p);
                        setAddedName(name);
                        setShowCartToast(true);
                        setTimeout(() => setShowCartToast(false), 2200);
                      }}
                      className={`absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center ${
                        inWishlist(p._id) ? "text-red-500" : "text-gray-600 hover:text-red-500"
                      }`}
                      aria-label="Toggle wishlist"
                    >
                      <Heart className={`w-4 h-4 ${inWishlist(p._id) ? "fill-current" : ""}`} />
                    </button>

                    {p.hasMultipleOptions && (
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs">
                        Options Available
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="font-medium text-gray-900 text-sm mb-1 leading-tight line-clamp-2">
                      {name}
                    </h3>

                    {/* Price block (no product code on sale grid) */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500 line-through">
                        ₹{mrpMin}
                        {discountedMin !== discountedMax && ` - ₹${mrpMax}`}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        ₹{discountedMin}
                        {discountedMin !== discountedMax && ` - ₹${discountedMax}`}
                      </span>
                    </div>

                    <div className="w-full py-2 text-xs font-medium rounded bg-black text-white text-center">
                      {p.hasMultipleOptions ? "VIEW OPTIONS" : "VIEW PRODUCT"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {showCartToast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <Check className="w-5 h-5" />
          <div>
            <p className="text-sm font-medium">Updated</p>
            <p className="text-xs opacity-90">{addedName}</p>
          </div>
          <button onClick={() => setShowCartToast(false)} className="ml-2 hover:bg-green-600 rounded-full p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
