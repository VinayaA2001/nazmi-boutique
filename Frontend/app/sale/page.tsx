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
  const mrpRaw = discounted / 0.7;
  const rounded = Math.round(mrpRaw / 10) * 10;
  return Math.max(rounded, Math.ceil(mrpRaw));
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

/* ---------- Component ---------- */
export default function SaleListingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // toast
  const [showCartToast, setShowCartToast] = useState(false);
  const [addedName, setAddedName] = useState("");

  // Filter state
  type CatFilter = "all" | "ethnic" | "western";
  const [categoryFilter, setCategoryFilter] = useState<CatFilter>("all");
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(5000);
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all products and filter for sale items
      const res = await fetch("/api/products", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid data format");
      
      // Filter for sale items - products with "sale" in category or tags
      const saleProducts = data.filter((product: any) => {
        const category = String(product.category || "").toLowerCase();
        const tags = Array.isArray(product.tags) ? product.tags.map((t: any) => String(t).toLowerCase()) : [];
        return category.includes('sale') || tags.includes('sale') || product.isSale === true;
      });
      
      setProducts(saleProducts.map(normalizeProduct));
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
    
    // Show toast
    setAddedName(item.name);
    setShowCartToast(true);
    setTimeout(() => setShowCartToast(false), 2200);
  };

  const inWishlist = (id: string) => wishlist.has(id);

  // Compute option lists and global price range
  const { allSizes, allColors, globalMinPrice, globalMaxPrice } = useMemo(() => {
    const sizes = new Set<string>();
    const colors = new Set<string>();
    let minP = Number.POSITIVE_INFINITY;
    let maxP = 0;

    for (const p of products) {
      p.availableSizes?.forEach((s) => s && sizes.add(String(s)));
      p.availableColors?.forEach((c) => c && colors.add(String(c)));
      if (typeof p.minPrice === "number") minP = Math.min(minP, p.minPrice);
      if (typeof p.maxPrice === "number") maxP = Math.max(maxP, p.maxPrice);
    }
    if (!Number.isFinite(minP)) minP = 0;
    if (maxP === 0) maxP = 5000;

    return {
      allSizes: Array.from(sizes).sort(),
      allColors: Array.from(colors).sort(),
      globalMinPrice: minP,
      globalMaxPrice: maxP,
    };
  }, [products]);

  // Initialize price inputs
  useEffect(() => {
    if (products.length) {
      setPriceMin(globalMinPrice);
      setPriceMax(globalMaxPrice);
    }
  }, [globalMinPrice, globalMaxPrice, products.length]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (categoryFilter !== "all") {
        const category = p.category?.toLowerCase() || "";
        if (categoryFilter === "ethnic" && !category.includes('ethnic')) return false;
        if (categoryFilter === "western" && !category.includes('western')) return false;
      }

      // Price filter
      if (p.minPrice > priceMax || p.maxPrice < priceMin) return false;

      // Size filter
      if (selectedSizes.size > 0) {
        const productSizes = new Set(p.availableSizes.map(s => s.toLowerCase()));
        const hasMatchingSize = Array.from(selectedSizes).some(selectedSize => 
          productSizes.has(selectedSize.toLowerCase())
        );
        if (!hasMatchingSize) return false;
      }

      // Color filter
      if (selectedColors.size > 0) {
        const productColors = new Set(p.availableColors.map(c => c.toLowerCase()));
        const hasMatchingColor = Array.from(selectedColors).some(selectedColor => 
          productColors.has(selectedColor.toLowerCase())
        );
        if (!hasMatchingColor) return false;
      }

      return true;
    });
  }, [products, categoryFilter, priceMin, priceMax, selectedSizes, selectedColors]);

  const clearFilters = () => {
    setCategoryFilter("all");
    setSelectedSizes(new Set());
    setSelectedColors(new Set());
    setPriceMin(globalMinPrice);
    setPriceMax(globalMaxPrice);
  };

  const hasActiveFilters = categoryFilter !== "all" || selectedSizes.size > 0 || selectedColors.size > 0 || priceMin > globalMinPrice || priceMax < globalMaxPrice;

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-white grid place-items-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading sale products…</p>
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
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">SALE</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Amazing deals on selected items. Limited time offer!
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Filter Toggle */}
      <div className="lg:hidden border-b bg-white">
        <div className="container mx-auto px-4 py-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 w-full justify-center py-2 border rounded-lg"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
            {hasActiveFilters && (
              <span className="bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {[categoryFilter !== "all", selectedSizes.size, selectedColors.size, priceMin > globalMinPrice, priceMax < globalMaxPrice].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar - Desktop */}
          <div className={`hidden lg:block w-64 flex-shrink-0 ${showFilters ? 'lg:block' : ''}`}>
            <div className="sticky top-24 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Category</h4>
                <div className="space-y-2">
                  {[
                    { value: "all", label: "All Categories" },
                    { value: "ethnic", label: "Ethnic Wear" },
                    { value: "western", label: "Western Wear" }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="category"
                        value={option.value}
                        checked={categoryFilter === option.value}
                        onChange={(e) => setCategoryFilter(e.target.value as CatFilter)}
                        className="text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Filter */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Price Range</h4>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={priceMin}
                      onChange={(e) => setPriceMin(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={priceMax}
                      onChange={(e) => setPriceMax(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    ₹{priceMin} - ₹{priceMax}
                  </div>
                </div>
              </div>

              {/* Size Filter */}
              {allSizes.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Size</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {allSizes.map((size) => (
                      <label key={size} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedSizes.has(size)}
                          onChange={(e) => {
                            const newSizes = new Set(selectedSizes);
                            if (e.target.checked) {
                              newSizes.add(size);
                            } else {
                              newSizes.delete(size);
                            }
                            setSelectedSizes(newSizes);
                          }}
                          className="rounded text-black focus:ring-black"
                        />
                        <span className="text-sm text-gray-700">{size}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Filter */}
              {allColors.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Color</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {allColors.map((color) => (
                      <label key={color} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedColors.has(color)}
                          onChange={(e) => {
                            const newColors = new Set(selectedColors);
                            if (e.target.checked) {
                              newColors.add(color);
                            } else {
                              newColors.delete(color);
                            }
                            setSelectedColors(newColors);
                          }}
                          className="rounded text-black focus:ring-black"
                        />
                        <span className="text-sm text-gray-700 capitalize">{color}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Filters */}
          {showFilters && (
            <div className="lg:hidden fixed inset-0 z-50 bg-white p-4 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Filters</h3>
                <button onClick={() => setShowFilters(false)} className="p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Mobile filter content same as desktop */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Category</h4>
                  <div className="space-y-2">
                    {[
                      { value: "all", label: "All Categories" },
                      { value: "ethnic", label: "Ethnic Wear" },
                      { value: "western", label: "Western Wear" }
                    ].map((option) => (
                      <label key={option.value} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="category-mobile"
                          value={option.value}
                          checked={categoryFilter === option.value}
                          onChange={(e) => setCategoryFilter(e.target.value as CatFilter)}
                          className="text-black focus:ring-black"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Price Range</h4>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={priceMin}
                        onChange={(e) => setPriceMin(Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={priceMax}
                        onChange={(e) => setPriceMax(Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                    </div>
                  </div>
                </div>

                {allSizes.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Size</h4>
                    <div className="space-y-2">
                      {allSizes.map((size) => (
                        <label key={size} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedSizes.has(size)}
                            onChange={(e) => {
                              const newSizes = new Set(selectedSizes);
                              if (e.target.checked) {
                                newSizes.add(size);
                              } else {
                                newSizes.delete(size);
                              }
                              setSelectedSizes(newSizes);
                            }}
                            className="rounded text-black focus:ring-black"
                          />
                          <span className="text-sm text-gray-700">{size}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {allColors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Color</h4>
                    <div className="space-y-2">
                      {allColors.map((color) => (
                        <label key={color} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedColors.has(color)}
                            onChange={(e) => {
                              const newColors = new Set(selectedColors);
                              if (e.target.checked) {
                                newColors.add(color);
                              } else {
                                newColors.delete(color);
                              }
                              setSelectedColors(newColors);
                            }}
                            className="rounded text-black focus:ring-black"
                          />
                          <span className="text-sm text-gray-700 capitalize">{color}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowFilters(false)}
                  className="w-full bg-black text-white py-3 rounded-lg font-medium"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{filteredProducts.length}</span> products
                  {hasActiveFilters && " (filtered)"}
                </p>
              </div>
              
              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  {categoryFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm">
                      {categoryFilter}
                      <button onClick={() => setCategoryFilter("all")}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {Array.from(selectedSizes).map((size) => (
                    <span key={size} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm">
                      Size: {size}
                      <button onClick={() => {
                        const newSizes = new Set(selectedSizes);
                        newSizes.delete(size);
                        setSelectedSizes(newSizes);
                      }}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {Array.from(selectedColors).map((color) => (
                    <span key={color} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm">
                      Color: {color}
                      <button onClick={() => {
                        const newColors = new Set(selectedColors);
                        newColors.delete(color);
                        setSelectedColors(newColors);
                      }}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {(priceMin > globalMinPrice || priceMax < globalMaxPrice) && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm">
                      Price: ₹{priceMin}-{priceMax}
                      <button onClick={() => {
                        setPriceMin(globalMinPrice);
                        setPriceMax(globalMaxPrice);
                      }}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Tag className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your filters to see more results.</p>
                <button 
                  onClick={clearFilters}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {filteredProducts.map((p) => {
                  const name = p.product_name || `${p.material} ${p.category}`;
                  const slug = makeSlug(p);
                  const firstInStock = p.variants.find((v) => Number(v.stock) > 0) || p.variants[0];
                  const q = firstInStock
                    ? `?color=${encodeURIComponent(firstInStock.colour)}&size=${encodeURIComponent(firstInStock.size)}`
                    : "";

                  const discountedMin = Math.round(p.minPrice);
                  const discountedMax = Math.round(p.maxPrice);
                  const mrpMin = calcMRPFromDiscount(discountedMin);
                  const mrpMax = calcMRPFromDiscount(discountedMax);

                  return (
                    <div
                      key={`${p._id}-${p.product_code}`}
                      className="group bg-white rounded-lg overflow-hidden transform transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow-xl border border-gray-100"
                    >
                      <Link href={`/sale/${slug}${q}`}>
                        <div className="relative aspect-[3/4] overflow-hidden">
                          <Image
                            src={imgUrl(p.images[0])}
                            alt={name}
                            fill
                            className="object-cover group-hover:scale-110 transition duration-500"
                          />
                          {/* 30% OFF Badge */}
                          <div className="absolute left-2 top-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-red-600 text-white">
                              30% OFF
                            </span>
                          </div>
                          
                          {p.hasMultipleOptions && (
                            <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs">
                              Options Available
                            </div>
                          )}
                        </div>
                      </Link>

                      <div className="p-3">
                        <Link href={`/sale/${slug}${q}`}>
                          <h3 className="font-medium text-gray-900 text-sm mb-1 leading-tight line-clamp-2 hover:text-gray-600">
                            {name}
                          </h3>
                        </Link>

                        {/* Price block */}
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

                        <div className="flex items-center justify-between">
                          <Link 
                            href={`/sale/${slug}${q}`}
                            className="flex-1 py-2 text-xs font-medium rounded bg-black text-white text-center hover:bg-gray-800"
                          >
                            {p.hasMultipleOptions ? "VIEW OPTIONS" : "VIEW PRODUCT"}
                          </Link>
                          <button
                            onClick={() => toggleWishlist(p)}
                            className={`ml-2 p-2 rounded border ${
                              inWishlist(p._id) 
                                ? "bg-red-50 border-red-200 text-red-500" 
                                : "bg-gray-50 border-gray-200 text-gray-600 hover:text-red-500"
                            }`}
                            aria-label="Toggle wishlist"
                          >
                            <Heart className={`w-4 h-4 ${inWishlist(p._id) ? "fill-current" : ""}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {showCartToast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in slide-in-from-right">
          <Check className="w-5 h-5" />
          <div>
            <p className="text-sm font-medium">Wishlist Updated</p>
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