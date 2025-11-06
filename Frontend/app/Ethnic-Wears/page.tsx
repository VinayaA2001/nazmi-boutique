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

/* ---------- Helpers ---------- */
const getImageUrl = (imagePath?: string | null): string => {
  if (!imagePath || typeof imagePath !== "string") return "/images/placeholder.jpg";
  if (imagePath.startsWith("http")) return imagePath;
  if (imagePath.startsWith("/")) return imagePath;
  return `${process.env.NEXT_PUBLIC_IMAGE_BASE_URL || ''}/images/${imagePath}`;
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
  const [imgSrc, setImgSrc] = useState(getImageUrl(src));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setImgSrc(getImageUrl(src));
    setLoading(true);
    setError(false);
  }, [src]);

  return (
    <div className={`relative ${fill ? 'w-full h-full' : ''}`}>
      {loading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      )}
      <Image
        src={error ? "/images/placeholder.jpg" : imgSrc}
        alt={alt}
        fill={!!fill}
        sizes={sizes}
        className={`${className} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
          setImgSrc("/images/placeholder.jpg");
        }}
      />
    </div>
  );
}

function normalizeProduct(raw: any): Product {
  if (!raw) {
    throw new Error("Invalid product data");
  }

  const variants: ProductVariant[] = Array.isArray(raw.variants) 
    ? raw.variants.map((v: any) => ({
        _id: String(v._id || v.id || Math.random().toString(36).substr(2, 9)),
        size: String(v.size || ""),
        colour: String(v.colour || v.color || ""),
        stock: Number(v.stock) || 0,
        price: Number(v.price) || 0,
        images: Array.isArray(v.images) ? v.images : [],
      }))
    : [];

  // Extract sizes and colors from variants
  const derivedSizes = Array.from(
    new Set(variants.map((v) => v.size).filter(Boolean).map(s => s.trim()))
  );
  const derivedColors = Array.from(
    new Set(variants.map((v) => v.colour).filter(Boolean).map(c => c.trim()))
  );

  // Use provided arrays or derive from variants
  const availableSizes = Array.isArray(raw.availableSizes) && raw.availableSizes.length 
    ? raw.availableSizes.map((s: any) => String(s).trim()).filter(Boolean)
    : derivedSizes;

  const availableColors = Array.isArray(raw.availableColors) && raw.availableColors.length
    ? raw.availableColors.map((c: any) => String(c).trim()).filter(Boolean)
    : derivedColors;

  // Calculate total stock
  const totalStock = typeof raw.totalStock === "number" && raw.totalStock >= 0
    ? raw.totalStock
    : variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  // Calculate price range
  const variantPrices = variants.map((v) => Number(v.price)).filter((n) => !Number.isNaN(n) && n > 0);
  const basePrice = Number(raw.price) || 0;
  
  let minPrice = 0;
  let maxPrice = 0;
  
  if (variantPrices.length > 0) {
    minPrice = Math.min(...variantPrices);
    maxPrice = Math.max(...variantPrices);
  } else if (basePrice > 0) {
    minPrice = maxPrice = basePrice;
  }

  // Override with explicit values if provided
  if (typeof raw.minPrice === "number" && raw.minPrice >= 0) minPrice = raw.minPrice;
  if (typeof raw.maxPrice === "number" && raw.maxPrice >= 0) maxPrice = raw.maxPrice;

  // Ensure maxPrice is not less than minPrice
  if (maxPrice < minPrice) maxPrice = minPrice;

  // Handle images
  const images = (Array.isArray(raw.images) && raw.images.length
    ? raw.images
    : variants.length > 0 && variants[0].images
      ? variants[0].images
      : ["/images/placeholder.jpg"]
  ).map(getImageUrl);

  return {
    _id: String(raw._id || raw.id),
    slug: raw.slug,
    product_code: raw.product_code || raw.productCode || "",
    product_name: raw.product_name || raw.productName || raw.name || "",
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
    hasMultipleOptions: variants.length > 1 || availableColors.length > 1 || availableSizes.length > 1,
    rating: typeof raw.rating === "number" ? raw.rating : 0,
    reviewCount: typeof raw.reviewCount === "number" ? raw.reviewCount : 0,
  };
}

/* ---------- Ethnic-only filter ---------- */
const ETHNIC_KEYWORDS = [
  "ethnic", "traditional", "saree", "salwar", "kurta", "lehenga", 
  "churidar", "dupatta", "patiala", "anarkali", "ghagra", "choli"
];

const WESTERN_KEYWORDS = [
  "western", "jeans", "tops", "dress", "skirt", "officewear", 
  "denim", "jacket", "t-shirt", "shirt", "pants", "trouser"
];

const isEthnicOnly = (p: Product): boolean => {
  if (!p) return false;
  
  const searchText = `${p.category} ${p.material} ${p.product_name} ${p.description}`.toLowerCase();
  
  const hasEthnic = ETHNIC_KEYWORDS.some(keyword => searchText.includes(keyword));
  const hasWestern = WESTERN_KEYWORDS.some(keyword => searchText.includes(keyword));
  
  return hasEthnic && !hasWestern;
};

/* ---------- Slug ---------- */
const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const makeSlug = (p: Product): string => {
  if (p.slug) return slugify(p.slug);
  
  const baseName = p.product_name?.length 
    ? p.product_name 
    : `${p.material}-${p.category}`;
    
  const withCode = p.product_code 
    ? `${baseName}-${p.product_code}`
    : baseName;
    
  return slugify(withCode);
};

/* ---------- Wishlist Management ---------- */
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
    const loadWishlist = () => {
      try {
        const data = localStorage.getItem("wishlist");
        if (data) {
          const parsed: WishlistItem[] = JSON.parse(data);
          setWishlist(new Set(parsed.map(item => item.id)));
        }
      } catch (error) {
        console.error("Error loading wishlist:", error);
      }
    };

    loadWishlist();

    // Listen for wishlist updates from other components
    const handleStorageChange = () => {
      loadWishlist();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("wishlist-updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("wishlist-updated", handleStorageChange);
    };
  }, []);

  const toggleWishlist = (product: Product) => {
    try {
      const currentWishlist: WishlistItem[] = JSON.parse(localStorage.getItem("wishlist") || "[]");
      const productSlug = makeSlug(product);
      
      const wishlistItem: WishlistItem = {
        id: product._id,
        productId: product._id,
        name: product.product_name || `${product.material} ${product.category}`,
        price: product.minPrice,
        image: getImageUrl(product.images?.[0]),
        productCode: product.product_code,
        slug: productSlug,
      };

      const existingIndex = currentWishlist.findIndex(item => item.id === product._id);
      let newWishlist: WishlistItem[];

      if (existingIndex > -1) {
        // Remove from wishlist
        newWishlist = currentWishlist.filter(item => item.id !== product._id);
        setWishlist(prev => {
          const next = new Set(prev);
          next.delete(product._id);
          return next;
        });
      } else {
        // Add to wishlist
        newWishlist = [...currentWishlist, wishlistItem];
        setWishlist(prev => new Set([...prev, product._id]));
      }

      localStorage.setItem("wishlist", JSON.stringify(newWishlist));
      window.dispatchEvent(new Event("wishlist-updated"));

    } catch (error) {
      console.error("Error updating wishlist:", error);
    }
  };

  const isInWishlist = (id: string): boolean => wishlist.has(id);

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

  // UI States
  const [collapsed, setCollapsed] = useState(true);
  const scrollRef = useRef(0);

  // Fetch products with better error handling
  useEffect(() => {
    let mounted = true;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/products?category=ethnic", {
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!mounted) return;

        if (!Array.isArray(data)) {
          throw new Error("Invalid data format received from server");
        }

        // Normalize and filter products
        const normalizedProducts = data.map(normalizeProduct);
        const ethnicProducts = normalizedProducts.filter(isEthnicOnly);

        setProductList(ethnicProducts);

      } catch (err: any) {
        if (!mounted) return;
        console.error("Error fetching products:", err);
        setError(err.message || "Failed to load products. Please try again.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      mounted = false;
    };
  }, []);

  // Extract filter options and price range
  const { allSizes, allColors, allMaterials, globalMinPrice, globalMaxPrice } = useMemo(() => {
    const sizes = new Set<string>();
    const colors = new Set<string>();
    const materials = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = 0;

    productList.forEach(product => {
      product.availableSizes?.forEach(size => {
        if (size && size.trim()) sizes.add(size.trim());
      });
      
      product.availableColors?.forEach(color => {
        if (color && color.trim()) colors.add(color.trim());
      });
      
      if (product.material && product.material.trim()) {
        materials.add(product.material.trim());
      }

      if (product.minPrice < minPrice) minPrice = product.minPrice;
      if (product.maxPrice > maxPrice) maxPrice = product.maxPrice;
    });

    return {
      allSizes: ["", ...Array.from(sizes).sort()],
      allColors: ["", ...Array.from(colors).sort()],
      allMaterials: ["", ...Array.from(materials).sort()],
      globalMinPrice: Number.isFinite(minPrice) ? minPrice : 0,
      globalMaxPrice: Number.isFinite(maxPrice) ? maxPrice : 10000,
    };
  }, [productList]);

  // Initialize price range when products load
  useEffect(() => {
    if (productList.length > 0) {
      setPriceMin(globalMinPrice);
      setPriceMax(globalMaxPrice);
    }
  }, [productList.length, globalMinPrice, globalMaxPrice]);

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = productList.filter(product => {
      // Price filter
      const priceOk = product.minPrice <= priceMax && product.maxPrice >= priceMin;
      if (!priceOk) return false;

      // Size filter
      if (size && !product.availableSizes.some(s => s.toLowerCase() === size.toLowerCase())) {
        return false;
      }

      // Color filter (case insensitive)
      if (color && !product.availableColors.some(c => 
        c.toLowerCase().includes(color.toLowerCase())
      )) {
        return false;
      }

      // Material filter (case insensitive)
      if (material && !product.material.toLowerCase().includes(material.toLowerCase())) {
        return false;
      }

      return true;
    });

    // Sort products
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.minPrice - b.minPrice);
        break;
      case "price-high":
        filtered.sort((a, b) => b.maxPrice - a.maxPrice);
        break;
      case "name":
        filtered.sort((a, b) => a.product_name.localeCompare(b.product_name));
        break;
      case "newest":
        // Assuming newer products have higher IDs (you might want to add a date field)
        filtered.sort((a, b) => b._id.localeCompare(a._id));
        break;
      case "featured":
      default:
        // Default sorting - you can implement your featured logic
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

  const hasActiveFilters = size || color || material || 
    priceMin !== globalMinPrice || 
    priceMax !== globalMaxPrice;

  /* ---------------- UI Components ---------------- */

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
              onClick={() => window.location.href = '/'}
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
      {/* Hero Section */}
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

      {/* Filter and Sort Bar */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="container mx-auto px-4">
          {/* Filter Header */}
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
              {/* Sort Dropdown */}
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
                onClick={() => setCollapsed(!collapsed)}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                aria-label={collapsed ? "Show filters" : "Hide filters"}
              >
                {collapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Expandable Filter Panel */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              collapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100 pb-6"
            }`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Price Range */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Price Range (₹)
                </label>
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

              {/* Size Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Size
                </label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="">All Sizes</option>
                  {allSizes.filter(Boolean).map((sizeOption) => (
                    <option key={sizeOption} value={sizeOption}>
                      {sizeOption}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Color
                </label>
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="">All Colors</option>
                  {allColors.filter(Boolean).map((colorOption) => (
                    <option key={colorOption} value={colorOption}>
                      {colorOption}
                    </option>
                  ))}
                </select>
              </div>

              {/* Material Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Material
                </label>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="">All Materials</option>
                  {allMaterials.filter(Boolean).map((materialOption) => (
                    <option key={materialOption} value={materialOption}>
                      {materialOption}
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

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8">
        {/* Results Count */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-gray-600">
            Showing {filteredAndSortedProducts.length} of {productList.length} products
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-black hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Products Grid */}
        {filteredAndSortedProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {filteredAndSortedProducts.map((product) => {
              const slug = makeSlug(product);
              const firstVariant = product.variants.find(v => v.stock > 0) || product.variants[0];
              const queryParams = firstVariant 
                ? `?color=${encodeURIComponent(firstVariant.colour)}&size=${encodeURIComponent(firstVariant.size)}`
                : "";

              // Calculate discount percentage
              const salePrice = Math.round(product.minPrice);
              const originalPrice = Math.round(
                product.maxPrice > salePrice ? product.maxPrice : salePrice * 1.3
              );
              const discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);

              const isWished = isInWishlist(product._id);

              return (
                <div
                  key={product._id}
                  className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-300"
                >
                  <Link href={`/Ethnic-Wears/${slug}${queryParams}`}>
                    <div className="relative aspect-[3/4] overflow-hidden">
                      {/* Discount Badge */}
                      {discountPercent > 0 && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="px-2 py-1 text-xs font-bold uppercase tracking-wide bg-green-600 text-white rounded-md shadow-lg">
                            {discountPercent}% OFF
                          </span>
                        </div>
                      )}

                      {/* Out of Stock Overlay */}
                      {product.totalStock === 0 && (
                        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                          <span className="bg-black text-white px-3 py-2 rounded-lg font-medium text-sm">
                            Out of Stock
                          </span>
                        </div>
                      )}

                      {/* Product Image */}
                      <SafeImage
                        src={product.images[0]}
                        alt={product.product_name}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Options Available Badge */}
                      {product.hasMultipleOptions && product.totalStock > 0 && (
                        <div className="absolute bottom-3 right-3 bg-black/90 text-white px-2 py-1 rounded text-xs backdrop-blur">
                          Options Available
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Product Info */}
                  <div className="p-4">
                    <Link href={`/Ethnic-Wears/${slug}${queryParams}`}>
                      <h3 className="font-medium text-gray-900 text-sm mb-2 leading-tight line-clamp-2 group-hover:text-black transition-colors">
                        {product.product_name}
                      </h3>
                    </Link>

                    {/* Price */}
                    <div className="flex items-baseline gap-2 mb-3">
                      {discountPercent > 0 && (
                        <span className="text-xs text-gray-500 line-through">
                          ₹{originalPrice}
                        </span>
                      )}
                      <span className="text-lg font-bold text-gray-900">
                        ₹{salePrice}
                      </span>
                      {discountPercent > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          Save {discountPercent}%
                        </span>
                      )}
                    </div>

                    {/* Actions */}
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
                            isWished 
                              ? "text-red-500 fill-current" 
                              : "text-gray-600"
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
          // Empty State
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-light text-gray-900 mb-2">
              No Products Found
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              We couldn't find any ethnic products matching your filters. Try adjusting your search criteria or browse our full collection.
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