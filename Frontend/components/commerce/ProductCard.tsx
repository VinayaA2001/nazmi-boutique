"use client";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/data";
import SizeGuide from "./SizeGuide";

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

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  // Safe fallbacks with Cloudinary optimization
  const images = Array.isArray(product.images) && product.images.length > 0 
    ? product.images.map(img => optimizeCloudinaryUrl(img))
    : [];
  const firstImage = images[0] || "/images/placeholder.png";
  const tags = Array.isArray((product as any).tags) ? (product as any).tags as string[] : [];

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const msg = encodeURIComponent(`Hi Nazmi! I'm interested in "${product.name}" (₹${product.price}).`);
  const wa = phone ? `https://wa.me/${phone}?text=${msg}` : "#";

  const discount = product.originalPrice
    ? Math.max(0, Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100))
    : 0;

  const stockNum = (product as any).stock as number | undefined;
  const inStock = product.inStock !== false && (stockNum === undefined || stockNum > 0);

  const stockLabel = (() => {
    if (!inStock) return "Out of stock";
    if (typeof stockNum === "number") {
      if (stockNum <= 3) return `Only ${stockNum} left`;
      return `${stockNum} in stock`;
    }
    return "In stock";
  })();

  const colors: { name: string; value: string }[] = Array.isArray((product as any).colors)
    ? ((product as any).colors as { name: string; value: string }[])
    : [];

  return (
    <article className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
      <div className="relative aspect-[3/4] overflow-hidden">
        <Image
          src={firstImage}
          alt={product.name}
          fill
          className={`object-cover transition-transform duration-300 ${
            inStock ? "group-hover:scale-105" : "grayscale"
          }`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaUMkX0RbNao4bNZoWyIqCzq6iSRbIlmNgjzU7Uz//Z"
        />

        {/* NEW badge */}
        {tags.includes("new") && (
          <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
            NEW
          </div>
        )}

        {/* Discount badge */}
        {discount > 0 && (
          <div className="absolute top-3 right-3 bg-amber-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
            {discount}% OFF
          </div>
        )}

        {/* Low stock ribbon */}
        {inStock && typeof stockNum === "number" && stockNum > 0 && stockNum <= 3 && (
          <div className="absolute bottom-3 left-3 bg-amber-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
            {stockLabel}
          </div>
        )}

        {/* Out of stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white px-3 py-1 rounded-full text-xs font-semibold">Out of stock</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <Link href={`/products/${product.id}`} className="group/link">
          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 group-hover/link:text-amber-700 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Product code (optional) */}
        {(product as any).productCode && (
          <p className="text-[11px] text-gray-500 mb-1">Code: {(product as any).productCode}</p>
        )}

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>

        {/* Color swatches (optional) */}
        {colors.length > 0 && (
          <div className="flex items-center gap-1 mb-3">
            {colors.slice(0, 4).map((c, i) => (
              <span
                key={i}
                className="inline-block w-4 h-4 rounded-full border border-gray-300"
                title={c.name}
                style={{ backgroundColor: c.value }}
              />
            ))}
            {colors.length > 4 && (
              <span className="text-xs text-gray-500 ml-1">+{colors.length - 4}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-amber-700">₹{product.price.toLocaleString("en-IN")}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-sm text-gray-500 line-through">₹{product.originalPrice.toLocaleString("en-IN")}</span>
            )}
          </div>
          <span
            className={`text-xs font-medium ${
              inStock ? "text-green-600" : "text-red-600"
            }`}
            title={stockLabel}
          >
            {stockLabel}
          </span>
        </div>

        {/* Size Guide */}
        <div className="mb-3">
          <SizeGuide productType="clothing" className="text-xs" />
        </div>

        <div className="flex gap-2">
          <Link
            href={`/products/${product.id}`}
            className="flex-1 text-center bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            View Details
          </Link>

          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 text-center px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              inStock && phone
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
            aria-disabled={!inStock || !phone}
            onClick={(e) => {
              if (!inStock || !phone) e.preventDefault();
            }}
          >
            WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}