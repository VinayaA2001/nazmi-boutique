// C:\NAZMI_BOUTIQUE\Frontend\components\account\WishlistGrid.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import type { ProductLite, WishlistItem } from "@/lib/type";

export default function WishlistGrid({
  wishlist,
  products,
  onRemove,
}: {
  wishlist: WishlistItem[];
  products: Record<string, ProductLite>;
  onRemove: (id: string) => void;
}) {
  if (!wishlist?.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-600">
        <p className="mb-3">Your wishlist is empty</p>
        <Link
          href="/sale"
          className="inline-flex items-center px-4 py-2 rounded-full text-sm bg-black text-white hover:bg-gray-900 transition"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-lg font-semibold mb-4">Your Wishlist</h2>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {wishlist.map((w) => {
          const fresh = products[w.productId];

          const name = fresh?.name ?? w.name ?? "Product";
          const price = fresh?.price ?? w.price;
          const inStock = fresh?.inStock ?? true;
          const img = fresh?.image ?? w.image ?? "/images/poster1.png";

          // ✅ determine base path & slug cleanly (no \n!)
          const cat =
            (fresh as any)?.category?.toLowerCase?.() || "";
          const base = cat.includes("west") ? "/western" : "/Ethnic-Wears";
          const slug = fresh?.slug ? `${base}/${fresh.slug}` : "#";

          return (
            <div
              key={w.productId}
              className="group bg-white border rounded-xl overflow-hidden"
            >
              <Link href={slug} className="block">
                <div className="aspect-[4/5] bg-gray-100 relative">
                  <Image
                    src={img}
                    alt={name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {!inStock && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-xs font-semibold text-white bg-black/70 px-2 py-1 rounded">
                        Out of stock
                      </span>
                    </div>
                  )}
                </div>
              </Link>

              <div className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={slug} className="block">
                    <p className="text-sm font-medium truncate">
                      {name}
                    </p>
                  </Link>
                  {price != null && (
                    <p className="text-sm text-gray-800 mt-0.5">
                      ₹{Number(price).toLocaleString("en-IN")}
                    </p>
                  )}
                  {!inStock && (
                    <p className="text-xs text-red-500 mt-0.5">
                      Currently unavailable
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(w.productId)}
                  className="text-xs text-gray-500 hover:text-red-600 underline flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
