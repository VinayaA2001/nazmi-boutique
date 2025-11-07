"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

export type CardProduct = {
  _id: string;
  slug?: string;
  name: string;
  category?: string;
  images: string[];
  minPrice?: number;
  maxPrice?: number;
};

const inr = (n?: number) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "";

function categoryHref(p: CardProduct) {
  const cat = (p.category || "").toLowerCase();
  const base = cat.includes("west") ? "/western" : "/Ethnic-Wears";
  const slugOrId = p.slug || p._id;
  return `${base}/${encodeURIComponent(slugOrId)}`;
}

interface ProductCardClientProps {
  p: CardProduct;
  compact?: boolean;
}

export default function ProductCardClient({ p, compact = false }: ProductCardClientProps) {
  const [wishIds, setWishIds] = useState<Set<string>>(new Set());
  const inWishlist = useMemo(() => wishIds.has(p._id), [wishIds, p._id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wishlist");
      if (!raw) return;
      const arr = JSON.parse(raw) as any[];
      setWishIds(new Set(arr.map((x) => x.id || x._id)));
    } catch {}
  }, []);

  const toggleWishlist = () => {
    let arr: any[] = [];
    try {
      const raw = localStorage.getItem("wishlist");
      if (raw) arr = JSON.parse(raw);
    } catch {}

    const key = p._id;
    const idx = arr.findIndex((x) => (x.id || x._id) === key);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push({
        id: key,
        _id: key,
        name: p.name,
        image: p.images?.[0],
        slug: p.slug,
      });
    }
    localStorage.setItem("wishlist", JSON.stringify(arr));
    setWishIds(new Set(arr.map((x) => x.id || x._id)));
    window.dispatchEvent(new Event("wishlist-updated"));
  };

  const price =
    p.minPrice && p.maxPrice && p.minPrice !== p.maxPrice
      ? `${inr(p.minPrice)}–${inr(p.maxPrice)}`
      : inr(p.minPrice || p.maxPrice);

  const img = p.images?.[0] || "/images/poster1.png";

  if (compact) {
    return (
      <div className="group rounded-lg border border-gray-150 overflow-hidden bg-white hover:shadow-sm transition-all">
        <div className="relative aspect-[3/4]">
          <Image
            src={img}
            alt={p.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width:768px) 50vw, (max-width:1280px) 25vw, 25vw"
          />
          <button
            onClick={toggleWishlist}
            className={`absolute top-1 right-1 w-6 h-6 rounded-full border flex items-center justify-center bg-white/90 backdrop-blur ${
              inWishlist ? "border-red-400 text-red-500" : "border-gray-200 text-gray-700"
            }`}
            aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`w-3 h-3 ${inWishlist ? "fill-current" : ""}`} />
          </button>
        </div>

        <div className="p-1.5">
          <Link href={categoryHref(p)} className="block">
            <h3 className="text-[10px] font-medium text-gray-900 line-clamp-2 leading-tight min-h-[2rem]">
              {p.name}
            </h3>
            {price && (
              <p className="mt-0.5 text-[10px] text-amber-700 font-semibold leading-tight">
                {price}
              </p>
            )}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-2xl border border-gray-200 overflow-hidden bg-white hover:shadow-md transition-all">
      <div className="relative aspect-[3/4]">
        <Image
          src={img}
          alt={p.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          sizes="(max-width:768px) 50vw, (max-width:1280px) 25vw, 25vw"
        />
        <button
          onClick={toggleWishlist}
          className={`absolute top-2 right-2 w-9 h-9 rounded-full border flex items-center justify-center bg-white/90 backdrop-blur ${
            inWishlist ? "border-red-400 text-red-500" : "border-gray-200 text-gray-700"
          }`}
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart className={`w-4 h-4 ${inWishlist ? "fill-current" : ""}`} />
        </button>
      </div>

      <div className="p-3.5">
        <Link href={categoryHref(p)} className="block">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{p.name}</h3>
          {p.category && (
            <p className="text-xs text-gray-500 mt-0.5">{p.category}</p>
          )}
          {price && <p className="mt-2 text-amber-700 font-semibold">{price}</p>}
        </Link>
      </div>
    </div>
  );
}
