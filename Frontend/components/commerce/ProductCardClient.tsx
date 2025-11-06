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

// Cloudinary URL optimization function
const optimizeCloudinaryUrl = (url: string) => {
  if (!url) return "/images/placeholder.png";
  
  // If it's already a local image, return as-is
  if (url.startsWith('/')) return url;
  
  // If it's a Cloudinary URL, optimize it
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    // Check if it already has transformations
    if (url.includes('/c_') || url.includes('/w_') || url.includes('/q_')) {
      return url;
    }
    // Add optimizations for Cloudinary URLs - optimized for product cards
    return url.replace('/upload/', '/upload/w_500,h_667,c_fill,q_auto,f_auto/');
  }
  
  // If it's an external URL but not Cloudinary, return as-is
  if (url.startsWith('http')) {
    return url;
  }
  
  return "/images/placeholder.png";
};

const inr = (n?: number) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "";

function categoryHref(p: CardProduct) {
  const cat = (p.category || "").toLowerCase();
  const base = cat.includes("west") ? "/western" : "/Ethnic-Wears";
  const slugOrId = p.slug || p._id;
  return `${base}/${encodeURIComponent(slugOrId)}`;
}

export default function ProductCardClient({ p }: { p: CardProduct }) {
  const [wishIds, setWishIds] = useState<Set<string>>(new Set());
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const inWishlist = useMemo(() => wishIds.has(p._id), [wishIds, p._id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wishlist");
      if (!raw) return;
      const arr = JSON.parse(raw) as any[];
      setWishIds(new Set(arr.map((x) => x.id || x._id)));
    } catch {}
  }, []);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
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

  // Optimize the image URL before using it
  const img = optimizeCloudinaryUrl(p.images?.[0] || "/images/placeholder.png");

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    console.error('Failed to load image:', img);
    setImageError(true);
    setImageLoading(false);
  };

  return (
    <div className="group rounded-2xl border border-gray-200 overflow-hidden bg-white hover:shadow-md transition-all duration-300">
      <div className="relative aspect-[3/4] bg-gray-100">
        <Image
          src={imageError ? "/images/placeholder.png" : img}
          alt={p.name}
          fill
          className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${
            imageLoading ? 'opacity-0' : 'opacity-100'
          }`}
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 25vw"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaUMkX0RbNao4bNZoWyIqCzq6iSRbIlmNgjzU7Uz//Z"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        
        {/* Loading skeleton */}
        {imageLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}
        
        <button
          onClick={toggleWishlist}
          className={`absolute top-2 right-2 w-9 h-9 rounded-full border flex items-center justify-center bg-white/90 backdrop-blur transition-all ${
            inWishlist 
              ? "border-red-400 text-red-500 hover:bg-red-50" 
              : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-white"
          }`}
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart 
            className={`w-4 h-4 transition-all ${
              inWishlist ? "fill-current scale-110" : "scale-100"
            }`} 
          />
        </button>
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-300" />
      </div>

      <div className="p-3.5">
        <Link href={categoryHref(p)} className="block group/link">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover/link:text-gray-600 transition-colors">
            {p.name}
          </h3>
          {p.category && (
            <p className="text-xs text-gray-500 mt-0.5 capitalize">
              {p.category.toLowerCase()}
            </p>
          )}
          {price && (
            <p className="mt-2 text-amber-700 font-semibold text-sm">
              {price}
            </p>
          )}
        </Link>
      </div>
    </div>
  );
}