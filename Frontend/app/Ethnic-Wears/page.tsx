"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  X,
  Truck,
  Shield,
  RotateCcw,
  Star,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ---------- Config ---------- */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://nazmi-boutique-2.onrender.com";
const CLOUDINARY_BASE =
  "https://res.cloudinary.com/dq5xhg9uo/image/upload/";
const PLACEHOLDER = "/images/poster1.png";

/* ---------- Types ---------- */
interface ProductVariant {
  _id: string;
  size: string;
  colour: string;
  stock: number;
  price: number;
  images?: string[];
}

interface Product {
  _id: string;
  slug?: string;
  product_code: string;
  product_name: string;
  material: string;
  category: string;
  images: string[];
  description: string;
  variants: ProductVariant[];
  availableSizes: string[];
  availableColors: string[];
  totalStock: number;
  minPrice: number;
  maxPrice: number;
  hasMultipleOptions?: boolean;
  rating?: number;
  reviewCount?: number;
}

/* ---------- Helpers (robust) ---------- */
const toMoney = (v: unknown): number | undefined => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return v > 0 ? v : undefined;
  const n = String(v).trim().replace(/[₹¥$,]/g, "").replace(/[^\d.]/g, "");
  if (!n) return undefined;
  const x = parseFloat(n);
  return Number.isFinite(x) && x > 0 ? x : undefined;
};

const toInt = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Accepts: full url, /images/foo.jpg, "folder/file.jpg" (Cloudinary public id)
const toFullUrl = (img?: string | null): string => {
  if (!img || typeof img !== "string") return PLACEHOLDER;
  if (img.startsWith("http")) return img;
  if (img.startsWith("/")) return img; // your local public images
  // treat as cloudinary public id
  return CLOUDINARY_BASE + img.replace(/^\//, "");
};

function SafeImage({
  src,
  alt,
  className,
  fill,
  sizes,
}: {
  src: string | undefined | null;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
}) {
  const [imgSrc, setImgSrc] = useState(toFullUrl(src));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setImgSrc(toFullUrl(src));
    setLoading(true);
    setError(false);
  }, [src]);

  return (
    <div className={`relative ${fill ? "w-full h-full" : ""}`}>
      {loading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      )}
      <Image
        src={error ? PLACEHOLDER : imgSrc}
        alt={alt}
        fill={!!fill}
        sizes={sizes}
        className={`${className} ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
          setImgSrc(PLACEHOLDER);
        }}
      />
    </div>
  );
}

function normalizeProduct(raw: any): Product {
  if (!raw) throw new Error("Invalid product data");

  // Variants
  const rawVariants = Array.isArray(raw.variants) ? raw.variants : [];
  const variants: ProductVariant[] = rawVariants.map((v: any) => ({
    _id: String(v?._id ?? v?.id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    size: String(v?.size ?? "").trim(),
    colour: String(v?.colour ?? v?.color ?? "").trim(),
    stock: toInt(v?.stock ?? v?.quantity),
    price: toMoney(v?.price) ?? 0,
    images: Array.isArray(v?.images) ? v.images.map(toFullUrl) : [],
  }));

  // Derive sizes/colors
  const derivedSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean)));
  const derivedColors = Array.from(new Set(variants.map(v => v.colour).filter(Boolean)));

  const availableSizes: string[] =
    Array.isArray(raw.availableSizes) && raw.availableSizes.length
      ? raw.availableSizes.map((s: any) => String(s).trim()).filter(Boolean)
      : derivedSizes;

  const availableColors: string[] =
    Array.isArray(raw.availableColors) && raw.availableColors.length
      ? raw.availableColors.map((c: any) => String(c).trim()).filter(Boolean)
      : derivedColors;

  const totalStock =
    typeof raw.totalStock === "number" && raw.totalStock >= 0
      ? raw.totalStock
      : variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  // Prices (robust)
  const variantPrices = variants.map(v => v.price).filter(n => n > 0);
  let minPrice =
    (variantPrices.length ? Math.min(...variantPrices) : undefined) ??
    toMoney(raw.minPrice) ??
    toMoney(raw.price) ??
    0;

  let maxPrice =
    (variantPrices.length ? Math.max(...variantPrices) : undefined) ??
    toMoney(raw.maxPrice) ??
    minPrice;

  if (maxPrice < minPrice) maxPrice = minPrice;

  // Images
  const images: string[] = (
    Array.isArray(raw.images) && raw.images.length
      ? raw.images
      : variants.length > 0 && variants[0].images && variants[0].images.length
      ? variants[0].images
      : [PLACEHOLDER]
  ).map(toFullUrl);

  return {
    _id: String(raw._id ?? raw.id ?? ""),
    slug: raw.slug,
    product_code: raw.product_code || raw.productCode || "",
    product_name: raw.product_name || raw.productName || raw.name || "Untitled",
    material: raw.material || "",
    category: raw.category || "",
    images,
    description: raw.description || "",
    variants,
    availableSizes,
    availableColors,
    totalStock,
    minPrice,
    maxPrice,
    hasMultipleOptions:
      (variants.length > 1) ||
      availableColors.length > 1 ||
      availableSizes.length > 1,
    rating: typeof raw.rating === "number" ? raw.rating : 0,
    reviewCount: typeof raw.reviewCount === "number" ? raw.reviewCount : 0,
  };
}

/* ---------- Ethnic-only helper (relaxed) ---------- */
const ETHNIC_KEYWORDS = [
  "ethnic", "traditional", "saree", "salwar", "kurta", "lehenga",
  "churidar", "dupatta", "patiala", "anarkali", "ghagra", "choli",
  "set", "kali"
];

const WESTERN_KEYWORDS = [
  "western", "jeans", "tops", "dress", "skirt", "officewear",
  "denim", "jacket", "t-shirt", "shirt", "pants", "trouser"
];

// If API already filtered by category=ethnic, don't over-filter.
// Use this only as a *soft* guard when backend sends mixed results.
const looksEthnic = (p: Product): boolean => {
  const hay = `${p.category} ${p.material} ${p.product_name} ${p.description}`.toLowerCase();
  const hasEthnic = ETHNIC_KEYWORDS.some(k => hay.includes(k));
  const hasWestern = WESTERN_KEYWORDS.some(k => hay.includes(k));
  // prefer ethnic if both appear; but don’t exclude unless clearly western-only
  return hasEthnic || (!hasWestern && (p.category || "").toLowerCase().includes("ethnic"));
};

/* ---------- Slug ---------- */
const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, "-").replace(/(^-|-$)+/g, "");

const makeSlug = (p: Product): string => {
  if (p.slug) return slugify(p.slug);
  const base = p.product_name || `${p.material}-${p.category}` || String(p._id);
  const withCode = p.product_code ? `${base}-${p.product_code}` : base;
  return slugify(withCode);
};

/* ---------- Wishlist ---------- */
interface WishlistItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  productCode: string;
  slug?: string;
}

const useWishlist = () => {
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => {
      try {
        const data = localStorage.getItem("wishlist");
        if (data) {
          const parsed: WishlistItem[] = JSON.parse(data);
          setWishlist(new Set(parsed.map(i => i.id)));
        }
      } catch {}
    };
    load();
    const onChange = () => load();
    window.addEventListener("storage", onChange);
    window.addEventListener("wishlist-updated", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("wishlist-updated", onChange);
    };
  }, []);

  const toggleWishlist = (product: Product) => {
    try {
      const current: WishlistItem[] = JSON.parse(localStorage.getItem("wishlist") || "[]");
      const productSlug = makeSlug(product);
      const item: WishlistItem = {
        id: product._id,
        productId: product._id,
        name: product.product_name,
        price: product.minPrice,
        image: toFullUrl(product.images?.[0]),
        productCode: product.product_code,
        slug: productSlug,
      };
      const exists = current.findIndex(i => i.id === product._id);
      let next: WishlistItem[];
      if (exists > -1) {
        next = current.filter(i => i.id !== product._id);
        setWishlist(prev => {
          const m = new Set(prev);
          m.delete(product._id);
          return m;
        });
      } else {
        next = [...current, item];
        setWishlist(prev => new Set([...prev, product._id]));
      }
      localStorage.setItem("wishlist", JSON.stringify(next));
      window.dispatchEvent(new Event("wishlist-updated"));
    } catch {}
  };

  const isInWishlist = (id: string) => wishlist.has(id);
  return { wishlist, toggleWishlist, isInWishlist };
};

/* =======================================================================================
   PAGE COMPONENT
   ======================================================================================= */
export default function EthnicCollectionPage() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toggleWishlist, isInWishlist } = useWishlist();

  // Filters
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [sortBy, setSortBy] = useState("featured");

  // UI
  const [collapsed, setCollapsed] = useState(true);
  const scrollRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        // 🔁 Use your backend directly (more reliable in client components)
        const url = `/api/products?category=ethnic&match=any&inStock=1`;
        const res = await fetch(url, { cache: "no-store" });

        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }

        const raw = await res.json();
        if (!mounted) return;

        // Accept multiple shapes
        const list: any[] = Array.isArray(raw)
          ? raw
          : raw?.items || raw?.products || raw?.data || [];

        if (!Array.isArray(list)) {
          throw new Error("Invalid data format received from server");
        }

        // Normalize everything
        const normalized = list.map((x) => normalizeProduct(x));

        // If backend already filtered by category, don’t over-filter.
        // But if mixed content arrives, keep only “ethnic-looking” ones.
        // Strictly enforce ethnic-only (exclude western/coord terms like coord, co-ord)
        // Show ALL matching ethnic products (no client-side cap)
        const finalList = normalized.filter(looksEthnic);

        setProductList(finalList);
      } catch (err: any) {
        if (!mounted) return;
        console.error("Error fetching products:", err);
        setError(err?.message || "Failed to load products. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProducts();
    return () => {
      mounted = false;
    };
  }, []);

  // Extract filter options / ranges
  const { allSizes, allColors, allMaterials, globalMinPrice, globalMaxPrice } =
    useMemo(() => {
      const sizes = new Set<string>();
      const colors = new Set<string>();
      const materials = new Set<string>();
      let minPrice = Number.POSITIVE_INFINITY;
      let maxPrice = 0;

      productList.forEach((p) => {
        (p.availableSizes || []).forEach((s) => s && sizes.add(s.trim()));
        (p.availableColors || []).forEach((c) => c && colors.add(c.trim()));
        if (p.material) materials.add(p.material.trim());
        if (p.minPrice && p.minPrice < minPrice) minPrice = p.minPrice;
        if (p.maxPrice && p.maxPrice > maxPrice) maxPrice = p.maxPrice;
      });

      return {
        allSizes: ["", ...Array.from(sizes).sort()],
        allColors: ["", ...Array.from(colors).sort()],
        allMaterials: ["", ...Array.from(materials).sort()],
        globalMinPrice: Number.isFinite(minPrice) ? minPrice : 0,
        globalMaxPrice: maxPrice > 0 ? maxPrice : 10000,
      };
    }, [productList]);

  // Initialize price range
  useEffect(() => {
    if (productList.length > 0) {
      setPriceMin(globalMinPrice);
      setPriceMax(globalMaxPrice);
    }
  }, [productList.length, globalMinPrice, globalMaxPrice]);

  // Filter & sort
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = productList.filter((p) => {
      // price overlap test
      const priceOk = (p.minPrice ?? 0) <= priceMax && (p.maxPrice ?? 0) >= priceMin;
      if (!priceOk) return false;

      if (size && !(p.availableSizes || []).some((s) => s.toLowerCase() === size.toLowerCase()))
        return false;

      if (color && !(p.availableColors || []).some((c) => c.toLowerCase().includes(color.toLowerCase())))
        return false;

      if (material && !(p.material || "").toLowerCase().includes(material.toLowerCase()))
        return false;

      return true;
    });

    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => (a.minPrice ?? 0) - (b.minPrice ?? 0));
        break;
      case "price-high":
        filtered.sort((a, b) => (b.maxPrice ?? 0) - (a.maxPrice ?? 0));
        break;
      case "name":
        filtered.sort((a, b) => a.product_name.localeCompare(b.product_name));
        break;
      case "newest":
        filtered.sort((a, b) => b._id.localeCompare(a._id));
        break;
      default:
        break;
    }
    return filtered;
  }, [productList, priceMin, priceMax, size, color, material, sortBy]);

  const clearFilters = () => {
    setSize("");
    setColor("");
    setMaterial("");
    setPriceMin(globalMinPrice);
    setPriceMax(globalMaxPrice);
    setSortBy("featured");
  };

  const hasActiveFilters =
    !!size ||
    !!color ||
    !!material ||
    priceMin !== globalMinPrice ||
    priceMax !== globalMaxPrice;

  /* ---------------- UI ---------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Loading our Ethnic collection…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Products</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-black text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-b from-rose-50/70 via-white to-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-8 md:py-12 text-center">
          <h1 className="text-3xl md:text-5xl font-light text-gray-900 mb-3">
            Ethnic Collection
          </h1>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Traditional elegance meets contemporary minimalism. Handcrafted pieces from Kerala
            featuring authentic designs and premium fabrics.
          </p>
        </div>
      </div>

      {/* Filter & Sort Bar */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="w-5 h-5 text-gray-700" />
              <span className="font-medium text-gray-800">Filters & Sorting</span>
              {collapsed && hasActiveFilters && (
                <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                  Active filters
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Name A-Z</option>
                <option value="newest">Newest First</option>
              </select>

              <button
                onClick={() => setCollapsed((v) => !v)}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                aria-label={collapsed ? "Show filters" : "Hide filters"}
              >
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              collapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100 pb-6"
            }`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Price */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Price Range (₹)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={priceMin}
                    onChange={(e) => setPriceMin(Number(e.target.value) || 0)}
                    min={0}
                    max={priceMax}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={priceMax}
                    onChange={(e) => setPriceMax(Number(e.target.value) || 0)}
                    min={priceMin}
                    max={globalMaxPrice}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Size */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Size</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="">All Sizes</option>
                  {allSizes.filter(Boolean).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Color</label>
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="">All Colors</option>
                  {allColors.filter(Boolean).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Material */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Material</label>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="">All Materials</option>
                  {allMaterials.filter(Boolean).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-end gap-2">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-gray-600">
            Showing {filteredAndSortedProducts.length} of {productList.length} products
          </p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-sm text-black hover:text-gray-700 underline">
              Clear filters
            </button>
          )}
        </div>

        {filteredAndSortedProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {filteredAndSortedProducts.map((product) => {
              const slug = makeSlug(product);
              const firstVariant =
                product.variants.find((v) => v.stock > 0) || product.variants[0];
              const queryParams = firstVariant
                ? `?color=${encodeURIComponent(firstVariant.colour)}&size=${encodeURIComponent(
                    firstVariant.size
                  )}`
                : "";

              const salePrice = Math.round(product.minPrice || 0);
              const originalPrice = Math.round(
                product.maxPrice && product.maxPrice > salePrice
                  ? product.maxPrice
                  : salePrice > 0
                  ? salePrice * 1.3
                  : 0
              );
              const discountPercent =
                originalPrice > 0 ? Math.round(((originalPrice - salePrice) / originalPrice) * 100) : 0;

              const isWished = isInWishlist(product._id);

              return (
                <div
                  key={product._id}
                  className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-300"
                >
                  <Link href={`/Ethnic-Wears/${slug}${queryParams}`}>
                    <div className="relative aspect-[3/4] overflow-hidden">
                      {discountPercent > 0 && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="px-2 py-1 text-xs font-bold uppercase tracking-wide bg-green-600 text-white rounded-md shadow-lg">
                            {discountPercent}% OFF
                          </span>
                        </div>
                      )}

                      {product.totalStock === 0 && (
                        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                          <span className="bg-black text-white px-3 py-2 rounded-lg font-medium text-sm">
                            Out of Stock
                          </span>
                        </div>
                      )}

                      <SafeImage
                        src={product.images?.[0]}
                        alt={product.product_name}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {product.hasMultipleOptions && product.totalStock > 0 && (
                        <div className="absolute bottom-3 right-3 bg-black/90 text-white px-2 py-1 rounded text-xs backdrop-blur">
                          Options Available
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="p-4">
                    <Link href={`/Ethnic-Wears/${slug}${queryParams}`}>
                      <h3 className="font-medium text-gray-900 text-sm mb-2 leading-tight line-clamp-2 group-hover:text-black transition-colors">
                        {product.product_name}
                      </h3>
                    </Link>

                    <div className="flex items-baseline gap-2 mb-3">
                      {discountPercent > 0 && originalPrice > 0 && (
                        <span className="text-xs text-gray-500 line-through">₹{originalPrice}</span>
                      )}
                      <span className="text-lg font-bold text-gray-900">
                        {salePrice > 0 ? `₹${salePrice}` : "Price on request"}
                      </span>
                      {discountPercent > 0 && (
                        <span className="text-xs text-green-600 font-medium">Save {discountPercent}%</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/Ethnic-Wears/${slug}${queryParams}`}
                        className="flex-1 bg-black text-white text-sm font-medium py-2.5 rounded-lg text-center hover:bg-gray-800 transition-colors"
                      >
                        {product.hasMultipleOptions ? "VIEW OPTIONS" : "VIEW PRODUCT"}
                      </Link>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleWishlist(product);
                        }}
                        className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
                      >
                        <Heart
                          className={`w-4 h-4 transition-colors ${
                            isWished ? "text-red-500 fill-current" : "text-gray-600"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-light text-gray-900 mb-2">No Products Found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              We couldn't find any ethnic products matching your filters. Try adjusting your search criteria or
              browse our full collection.
            </p>
            <button
              onClick={clearFilters}
              className="bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Trust Features */}
      <div className="border-t border-gray-200 bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Free Shipping</h4>
              <p className="text-sm text-gray-600">Free delivery on orders above ₹2000</p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Secure Payment</h4>
              <p className="text-sm text-gray-600">100% secure and protected payments</p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">No Returns</h4>
              <p className="text-sm text-gray-600">No returns or exchanges available</p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-6 h-6 text-white" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Quality Assured</h4>
              <p className="text-sm text-gray-600">Handcrafted with premium materials</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}