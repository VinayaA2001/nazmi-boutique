// app/wishlist/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag, Eye } from "lucide-react";

type WishlistItem = {
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  images?: string[];
  image?: string;
  size?: string;
  color?: string;
  category?: string;
  inStock?: boolean;
  slug?: string; // preferred for product link
};

type CartItem = {
  id: string;               // use productId
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: string;
  color?: string;
  productCode?: string;
  maxStock?: number;
};

const inr = (n: number | string) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [showCartNotification, setShowCartNotification] = useState(false);

  /* Load wishlist once */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wishlist");
      const arr = saved ? JSON.parse(saved) : [];
      // Normalize: ensure productId string
      const norm: WishlistItem[] = (Array.isArray(arr) ? arr : []).map((it: any) => ({
        productId: String(it.productId ?? it.id ?? ""),
        name: it.name ?? it.title ?? "",
        price: Number(it.price ?? 0),
        originalPrice: it.originalPrice ? Number(it.originalPrice) : undefined,
        images: Array.isArray(it.images) ? it.images : undefined,
        image: it.image,
        size: it.size,
        color: it.color,
        category: it.category,
        inStock: it.inStock !== false,
        slug: it.slug, // if present we’ll deep-link to product
      })).filter(it => it.productId);
      setWishlist(norm);
    } catch {
      setWishlist([]);
    }
  }, []);

  const persist = (items: WishlistItem[]) => {
    setWishlist(items);
    localStorage.setItem("wishlist", JSON.stringify(items));
    // let other parts of app refresh counts
    window.dispatchEvent(new Event("wishlist-updated"));
  };

  const removeItem = (productId: string) => {
    persist(wishlist.filter((item) => item.productId !== productId));
  };

  const addToCart = (wish: WishlistItem) => {
    try {
      const raw = localStorage.getItem("cart");
      const cart: CartItem[] = raw ? JSON.parse(raw) : [];

      const keyMatch = (c: CartItem) =>
        c.productId === wish.productId &&
        (c.size ?? "") === (wish.size ?? "") &&
        (c.color ?? "") === (wish.color ?? "");

      const existingIdx = cart.findIndex(keyMatch);

      if (existingIdx >= 0) {
        cart[existingIdx] = {
          ...cart[existingIdx],
          quantity: (cart[existingIdx].quantity || 0) + 1,
        };
      } else {
        const img = wish.image || wish.images?.[0] || "/images/poster1.png";
        const newItem: CartItem = {
          id: wish.productId,
          productId: wish.productId,
          name: wish.name,
          price: Number(wish.price || 0),
          image: img,
          quantity: 1,
          size: wish.size,
          color: wish.color,
        };
        cart.push(newItem);
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("cart-updated"));
      setShowCartNotification(true);
      setTimeout(() => setShowCartNotification(false), 2500);
    } catch {
      // no-op
    }
  };

  const moveToCart = (wish: WishlistItem) => {
    addToCart(wish);
    removeItem(wish.productId);
  };

  // Build product detail URL: prefer slug. (Your product page lives at /Ethnic-Wears/[slug])
  // If slug missing, fall back to a category path (best-effort) else home.
  const productHref = (item: WishlistItem) => {
    if (item.slug) return `/Ethnic-Wears/${encodeURIComponent(item.slug)}`;
    const cat = (item.category || "").toLowerCase();
    if (cat.includes("ethnic") || cat.includes("traditional")) return "/Ethnic-Wears";
    if (cat.includes("western")) return "/western";
    if (cat.includes("sale")) return "/sale";
    return "/";
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-light text-gray-900">My Wishlist</h1>
              <Heart className="w-8 h-8 fill-red-500 text-red-500" />
            </div>
            <span className="text-gray-600 bg-gray-100 px-3 py-1 rounded-full text-sm">
              {wishlist.length} {wishlist.length === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
            <Link href="/" className="hover:text-gray-700">Home</Link>
            <span>›</span>
            <span className="text-gray-900">Wishlist</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {wishlist.length === 0 ? (
          <div className="text-center py-16 max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-light text-gray-900 mb-4">Your wishlist is empty</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Browse our collection and click the heart icon to save your favorite items here for later.
            </p>
            <Link
              href="/"
              className="bg-gray-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors inline-block"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            {/* Wishlist Actions */}
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">
                Saved {wishlist.length} {wishlist.length === 1 ? "item" : "items"}
              </p>
              <button
                onClick={() => persist([])}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Clear All
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {wishlist.map((item) => {
                const imgSrc = item.image || item.images?.[0] || "/images/poster1.png";
                const href = productHref(item);

                return (
                  <div
                    key={item.productId}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-400 transition-all duration-300 group"
                  >
                    {/* Clickable image → product */}
                    <Link href={href} className="relative block h-64 overflow-hidden">
                      <Image
                        src={imgSrc}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-700"
                      />
                    </Link>

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300 group/wishlist"
                      aria-label="Remove from wishlist"
                    >
                      <Heart className="w-5 h-5 fill-red-500 text-red-500 group-hover/wishlist:fill-white group-hover/wishlist:text-white" />
                    </button>

                    {/* Info */}
                    <div className="p-4">
                      {/* Title → product */}
                      <Link href={href} className="block">
                        <h3 className="font-medium text-gray-900 mb-2 line-clamp-2 hover:underline">
                          {item.name}
                        </h3>
                      </Link>

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-gray-900">
                            {inr(item.price)}
                          </span>
                          {item.originalPrice && item.originalPrice > item.price && (
                            <>
                              <span className="text-sm text-gray-500 line-through">
                                {inr(item.originalPrice)}
                              </span>
                              <span className="text-sm text-green-600 font-medium">
                                {Math.round((1 - item.price / item.originalPrice) * 100)}% OFF
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span className="capitalize">{item.category}</span>
                        {item.inStock !== false && <span className="text-green-600">In Stock</span>}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => moveToCart(item)}
                          className="flex-1 bg-gray-900 text-white py-2 px-3 rounded text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-1"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          Add to Cart
                        </button>

                        <Link
                          href={href}
                          className="w-10 h-10 bg-white border border-gray-300 rounded flex items-center justify-center hover:border-gray-400 transition-colors"
                          aria-label="View product"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Cart Notification */}
      {showCartNotification && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Product moved to cart!
          </div>
        </div>
      )}
    </div>
  );
}
