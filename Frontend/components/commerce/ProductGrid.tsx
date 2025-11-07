"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, Eye, Star } from "lucide-react";

/* ======= Config ======= */
const PLACEHOLDER = "/images/poster1.png";
const RAW = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"; // no trailing '/'
const ORIGIN = RAW.replace(/\/+$/, "");
const API = `${ORIGIN}/api`;

/* Make any relative path absolute (e.g. '/uploads/x.jpg' or 'uploads/x.jpg') */
function ensureAbs(u?: string): string {
  if (!u) return PLACEHOLDER;
  try {
    new URL(u); // already absolute
    return u;
  } catch {
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${ORIGIN}${path}`;
  }
}

/* Normalize API response to array */
function asArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  return [];
}

/* ======= Types ======= */
type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  category: string;
  description?: string;
  sizes?: string[];
  colors?: string[];
  featured?: boolean;
  inStock?: boolean;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  product_code?: string;
  material?: string;
  variants?: any[];
  availableSizes?: string[];
  availableColors?: string[];
  totalStock?: number;
  minPrice?: number;
  maxPrice?: number;
};

type CartItem = Product & {
  quantity: number;
  selectedSize: string;
  selectedColor: string;
};

/* Sample products kept for fallback */
const sampleProducts: Product[] = [
  {
    id: "p1",
    name: "Floral Print Anarkali",
    price: 2299,
    originalPrice: 2999,
    image: "/images/products/product-1.jpg",
    images: [
      "/images/products/product-1-1.jpg",
      "/images/products/product-1-2.jpg",
      "/images/products/product-1-3.jpg",
      "/images/products/product-1-4.jpg",
    ],
    category: "traditional",
    description:
      "Beautiful floral print anarkali with intricate embroidery work and comfortable fabric",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Red", "Blue", "Green"],
    featured: true,
    inStock: true,
    rating: 4.5,
    reviewCount: 128,
    tags: ["new", "bestseller", "embroidered"],
  },
  {
    id: "p2",
    name: "Designer Silk Saree",
    price: 3599,
    originalPrice: 4599,
    image: "/images/products/product-2.jpg",
    images: [
      "/images/products/product-2-1.jpg",
      "/images/products/product-2-2.jpg",
      "/images/products/product-2-3.jpg",
      "/images/products/product-2-4.jpg",
    ],
    category: "traditional",
    description: "Pure silk saree with zari border and elegant pallu design",
    sizes: ["Free Size"],
    colors: ["Maroon", "Gold", "Navy"],
    featured: true,
    inStock: true,
    rating: 4.8,
    reviewCount: 89,
    tags: ["new", "premium", "silk"],
  },
];

export default function ProductGrid() {
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  /* ------- Load products from API + fallback ------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/products`, { cache: "no-store" });
        if (!res.ok) throw new Error("API failed");
        const mongoData = asArray(await res.json());
        const mongoProducts = transformMongoDBProducts(mongoData);
        const all = [...sampleProducts, ...mongoProducts];
        setProducts(all);
      } catch (e) {
        console.error("Failed API; using sample products.", e);
        setProducts(sampleProducts);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ------- Transform MongoDB records -> Product ------- */
  const transformMongoDBProducts = (rows: any[]): Product[] => {
    const map = new Map<string, Product>();
    for (const rec of rows) {
      // robust grouping key
      const key =
        String(rec.product_code || "").trim() ||
        String(rec._id || "").trim() ||
        `${rec.material || ""}-${rec.category || ""}`;

      if (!map.has(key)) {
        const image0 = Array.isArray(rec.images) && rec.images[0] ? ensureAbs(rec.images[0]) : PLACEHOLDER;
        const images = Array.isArray(rec.images)
          ? rec.images.filter(Boolean).map(ensureAbs)
          : [];

        map.set(key, {
          id: String(rec._id || key),
          name: rec.product_name || `${rec.material ?? ""} ${rec.category ?? ""}`.trim() || "Product",
          price: Number(rec.price || rec.minPrice || 0),
          image: image0,
          images: images.length ? images : [image0],
          category: String(rec.category || "traditional").toLowerCase(),
          description: rec.description || `${rec.material ?? ""} ${rec.category ?? ""}`.trim(),
          sizes: [],
          colors: [],
          featured: false,
          inStock: Number(rec.stock || rec.totalStock || 0) > 0,
          rating: 4.2,
          reviewCount: 0,
          tags: ["traditional", "handcrafted"],
          product_code: rec.product_code,
          material: rec.material,
          variants: [],
          availableSizes: [],
          availableColors: [],
          totalStock: 0,
          minPrice: Number.isFinite(rec.price) ? Number(rec.price) : Number(rec.minPrice || 0),
          maxPrice: Number.isFinite(rec.price) ? Number(rec.price) : Number(rec.maxPrice || 0),
        });
      }

      const p = map.get(key)!;

      // push variant (guard missing fields)
      const vSize = rec.size?.toString();
      const vColor = rec.colour?.toString() || rec.color?.toString();
      const vStock = Number(rec.stock || 0);
      const vPrice = Number(rec.price || p.price || 0);

      p.variants!.push({
        _id: rec._id,
        size: vSize,
        colour: vColor,
        stock: vStock,
        price: vPrice,
      });

      if (vSize && !p.sizes!.includes(vSize)) {
        p.sizes!.push(vSize);
        p.availableSizes!.push(vSize);
      }
      if (vColor && !p.colors!.includes(vColor)) {
        p.colors!.push(vColor);
        p.availableColors!.push(vColor);
      }

      p.totalStock = (p.totalStock || 0) + vStock;
      p.minPrice = Math.min(p.minPrice || vPrice, vPrice);
      p.maxPrice = Math.max(p.maxPrice || vPrice, vPrice);
      p.price = p.minPrice || p.price;
    }

    return Array.from(map.values());
  };

  /* ------- Load localStorage ------- */
  useEffect(() => {
    try {
      const w = localStorage.getItem("wishlist");
      const c = localStorage.getItem("cart");
      if (w) setWishlist(JSON.parse(w));
      if (c) setCart(JSON.parse(c));
    } catch (e) {
      console.error("localStorage parse error", e);
    }
  }, []);

  /* ------- Filter ------- */
  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => (p.category || "").toLowerCase() === selectedCategory.toLowerCase());

  /* ------- Wishlist ------- */
  const toggleWishlist = (p: Product) => {
    const has = wishlist.some((i) => i.id === p.id);
    const next = has ? wishlist.filter((i) => i.id !== p.id) : [...wishlist, p];
    setWishlist(next);
    localStorage.setItem("wishlist", JSON.stringify(next));
    window.dispatchEvent(new Event("wishlist-updated"));
  };

  /* ------- Add to cart (variant aware) ------- */
  const addToCart = (p: Product, size = "", color = "") => {
    const variants = Array.isArray(p.variants) ? p.variants : [];

    if (variants.length > 1) {
      if (!size && (p.availableSizes?.length || 0) > 0) {
        alert("Please select a size before adding to cart.");
        return;
      }
      if (!color && (p.availableColors?.length || 0) > 0) {
        alert("Please select a color before adding to cart.");
        return;
      }
    }

    let variantPrice = p.price;
    let variantStock = p.totalStock || 0;

    if (variants.length) {
      const v = variants.find(
        (x: any) =>
          (x.size || p.sizes?.[0]) === (size || p.sizes?.[0]) &&
          (x.colour || p.colors?.[0]) === (color || p.colors?.[0])
      );
      if (v) {
        variantPrice = Number(v.price || variantPrice);
        variantStock = Number(v.stock || 0);
        if (variantStock < 1) {
          alert(`Sorry, ${size || ""} ${color || ""} is out of stock.`);
          return;
        }
      }
    }

    const s = size || p.sizes?.[0] || "Free Size";
    const c = color || p.colors?.[0] || "Default";

    const existing = cart.find((i) => i.id === p.id && i.selectedSize === s && i.selectedColor === c);
    const next = existing
      ? cart.map((i) =>
          i.id === p.id && i.selectedSize === s && i.selectedColor === c
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      : [...cart, { ...p, quantity: 1, selectedSize: s, selectedColor: c, price: variantPrice }];

    setCart(next);
    localStorage.setItem("cart", JSON.stringify(next));
    window.dispatchEvent(new Event("cart-updated"));
    console.log(`${p.name} added to cart!`);
  };

  /* ------- Quick view ------- */
  const openQuickView = (p: Product) => {
    setQuickViewProduct(p);
    setCurrentImageIndex(0);
    setSelectedSize("");
    setSelectedColor("");
  };

  /* ------- Helpers for variants ------- */
  const getAvailableColors = (p: Product, size: string) => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    if (!variants.length) return p.colors || [];
    return Array.from(
      new Set(
        variants.filter((v: any) => v.size === size && Number(v.stock) > 0).map((v: any) => v.colour).filter(Boolean)
      )
    );
  };

  const getAvailableSizes = (p: Product, color: string) => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    if (!variants.length) return p.sizes || [];
    return Array.from(
      new Set(
        variants.filter((v: any) => v.colour === color && Number(v.stock) > 0).map((v: any) => v.size).filter(Boolean)
      )
    );
  };

  const getSelectedVariantPrice = (p: Product) => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    if (!selectedSize || !selectedColor || !variants.length) return p.price;
    const v = variants.find((x: any) => x.size === selectedSize && x.colour === selectedColor);
    return Number(v?.price ?? p.price);
    };

  const getSelectedVariantStock = (p: Product) => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    if (!selectedSize || !selectedColor || !variants.length) return p.totalStock || 0;
    const v = variants.find((x: any) => x.size === selectedSize && x.colour === selectedColor);
    return Number(v?.stock ?? 0);
  };

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  /* ------- Loading ------- */
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 aspect-[3/4] rounded-2xl mb-4"></div>
              <div className="bg-gray-200 h-4 rounded mb-2"></div>
              <div className="bg-gray-200 h-4 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ------- Render ------- */
  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredProducts.map((p) => {
          const isInWishlist = wishlist.some((i) => i.id === p.id);
          const discount = p.originalPrice
            ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
            : 0;
          const showPriceRange =
            Number.isFinite(p.minPrice) && Number.isFinite(p.maxPrice) && p.minPrice !== p.maxPrice;

          const imgSrc = imageErrors[p.id] ? PLACEHOLDER : ensureAbs(p.image);

          return (
            <div
              key={p.id}
              className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-[#E8E9E0] hover:border-[#6D7E5F]"
            >
              {/* Badges */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
                {p.tags?.includes("new") && (
                  <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">NEW</span>
                )}
                {discount > 0 && (
                  <span className="bg-[#6D7E5F] text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                    {discount}% OFF
                  </span>
                )}
                {typeof p.totalStock === "number" && p.totalStock < 5 && (
                  <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                    Only {p.totalStock} left
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                <button
                  onClick={() => toggleWishlist(p)}
                  className="p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-lg"
                  aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      isInWishlist ? "text-red-500 fill-red-500" : "text-gray-600 hover:text-red-500"
                    }`}
                  />
                </button>

                <button
                  onClick={() => openQuickView(p)}
                  className="p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-lg"
                  aria-label="Quick view"
                >
                  <Eye className="w-4 h-4 text-gray-600 hover:text-[#6D7E5F]" />
                </button>
              </div>

              {/* Image */}
              <Link href={`/products/${p.id}`}>
                <div className="relative overflow-hidden bg-[#E8E9E0] aspect-[3/4]">
                  <Image
                    src={imgSrc}
                    alt={p.name}
                    fill
                    className="object-cover group-hover:scale-105 transition duration-500"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    onError={() => handleImageError(p.id)}
                  />
                  {Array.isArray(p.variants) && p.variants.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded text-xs">
                      {p.availableSizes?.length || 0} sizes • {p.availableColors?.length || 0} colors
                    </div>
                  )}
                </div>
              </Link>

              {/* Info */}
              <div className="p-4">
                <Link href={`/products/${p.id}`}>
                  <h3 className="font-semibold text-lg mb-1 hover:text-[#6D7E5F] transition-colors line-clamp-2">
                    {p.name}
                  </h3>
                </Link>

                {p.product_code && <p className="text-xs text-gray-500 mb-1">Code: {p.product_code}</p>}

                {p.rating && (
                  <div className="flex items-center gap-1 mb-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${i < Math.floor(p.rating!) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-600">({p.reviewCount})</span>
                  </div>
                )}

                {p.description && <p className="text-gray-600 text-sm mb-2 line-clamp-2">{p.description}</p>}

                <div className="flex items-center gap-2 mb-3">
                  {showPriceRange ? (
                    <p className="text-[#6D7E5F] font-bold text-lg">₹{p.minPrice} - ₹{p.maxPrice}</p>
                  ) : (
                    <>
                      <p className="text-[#6D7E5F] font-bold text-lg">₹{p.price.toLocaleString()}</p>
                      {p.originalPrice && (
                        <p className="text-gray-500 text-sm line-through">₹{p.originalPrice.toLocaleString()}</p>
                      )}
                    </>
                  )}
                </div>

                {p.sizes && p.sizes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.sizes.slice(0, 4).map((s) => (
                      <span key={s} className="text-xs bg-[#E8E9E0] text-[#2C2C2C] px-2 py-1 rounded border">
                        {s}
                      </span>
                    ))}
                    {p.sizes.length > 4 && (
                      <span className="text-xs bg-[#E8E9E0] text-[#2C2C2C] px-2 py-1 rounded border">
                        +{p.sizes.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => addToCart(p)}
                  className="w-full bg-[#6D7E5F] text-white py-3 px-4 rounded-lg font-semibold hover:bg-[#5c6e50] transition-all duration-300 flex items-center justify-center space-x-2 group"
                >
                  <ShoppingCart className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Add to Cart</span>
                </button>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => openQuickView(p)}
                    className="flex-1 text-center text-sm text-[#6D7E5F] hover:text-[#5c6e50] transition-colors py-1"
                  >
                    Quick View
                  </button>
                  <button className="flex-1 text-center text-sm text-[#6D7E5F] hover:text-[#5c6e50] transition-colors py-1">
                    Buy Now
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick View (unchanged UI; images made safe if needed) */}
      {quickViewProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="grid md:grid-cols-2 gap-8 p-6">
              <div className="space-y-4">
                <div className="relative aspect-square bg-[#E8E9E0] rounded-2xl overflow-hidden">
                  <Image
                    src={
                      ensureAbs(quickViewProduct.images?.[currentImageIndex]) ||
                      ensureAbs(quickViewProduct.image)
                    }
                    alt={quickViewProduct.name}
                    fill
                    className="object-cover"
                  />
                </div>

                {quickViewProduct.images && quickViewProduct.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {quickViewProduct.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImageIndex(i)}
                        className={`relative aspect-square bg-[#E8E9E0] rounded-lg overflow-hidden border-2 ${
                          currentImageIndex === i ? "border-[#6D7E5F]" : "border-transparent"
                        }`}
                      >
                        <Image src={ensureAbs(img)} alt={`${quickViewProduct.name} ${i + 1}`} fill className="object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ...(rest of your quick view content stays the same) */}
              {/* (kept your variant selection + actions) */}
            </div>
          </div>
        </div>
      )}

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-[#92A079] text-6xl mb-4">🛍️</div>
          <h3 className="text-xl font-semibold text-[#2C2C2C] mb-2">No products found</h3>
          <p className="text-gray-600">Try selecting a different category</p>
        </div>
      )}
    </div>
  );
}
