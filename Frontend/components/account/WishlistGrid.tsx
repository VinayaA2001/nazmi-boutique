"use client";

import Image from "next/image";
import Link from "next/link";
import { WishlistItem, ProductLite } from "@/lib/type";
import { formatINR } from "@/lib/currency";

export default function WishlistGrid({
  wishlist,
  rehydrated,
  onRemove,
}: {
  wishlist: WishlistItem[];
  rehydrated: Record<string, ProductLite>;
  onRemove: (id: string) => void;
}) {
  if (!wishlist.length) {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white border rounded-2xl p-6 text-center">
          <p className="text-gray-600 mb-4">Your wishlist is empty.</p>
          <a href="/products" className="px-5 py-2 rounded-lg bg-black text-white inline-block">Continue Shopping</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="bg-white border rounded-2xl p-4 md:p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlist.map((w) => {
            const fresh = rehydrated[w.productId];
            const price = fresh?.price ?? w.price;
            const inStock = fresh?.inStock ?? true;
            const img = fresh?.image ?? w.image ?? "/images/poster1.png";
            const cat = (fresh as any)?.category?.toLowerCase?.() || "";\n            const base = cat.includes("west") ? "/western" : "/Ethnic-Wears";\n            const slug = fresh?.slug ? `${base}/${fresh.slug}` : "#";

            return (
              <div key={w.productId} className="group bg-white border rounded-xl overflow-hidden">
                <div className="relative aspect-[3/4]">
                  <Image src={img} alt={w.name} fill className="object-cover" />
                  {!inStock && <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">Out of Stock</div>}
                  <button onClick={() => onRemove(w.productId)}
                          className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded hover:bg-black" aria-label="Remove from wishlist">
                    Remove
                  </button>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium line-clamp-2">{w.name}</h3>
                  {w.productCode && <p className="text-xs text-gray-500 mb-1">Code: {w.productCode}</p>}
                  <p className="text-sm font-semibold">{formatINR(price)}</p>
                  <div className="mt-2 flex gap-2">
                    <Link href={slug} className="flex-1 text-center text-xs py-2 rounded bg-gray-900 text-white hover:bg-black">View</Link>
                    <button disabled={!inStock} className="flex-1 text-center text-xs py-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => alert("Add to cart hook (wire your cart here).")}>
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


