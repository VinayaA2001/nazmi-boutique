"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, ShoppingCart, Check, Minus, Plus, Truck, RotateCcw, Info } from "lucide-react";

/* eslint-disable @next/next/no-img-element */

type Variant = {
  _id?: string;
  size?: string;
  colour?: string;  // backend spelling
  color?: string;   // alt spelling
  stock?: number;
  price?: number;
  images?: string[];
};

type Product = {
  _id: string;
  slug?: string;
  product_code?: string;
  product_name?: string;
  name?: string;
  material?: string;
  category?: string;
  images?: string[];
  colorImages?: Record<string, string[]>;
  description?: string;
  variants?: Variant[];
  availableSizes?: string[];
  availableColors?: string[];
  totalStock?: number;
  minPrice?: number;
  maxPrice?: number;
  specs?: Record<string, string>;
};

const norm = (s?: string) => (s ?? "").trim().toLowerCase();
const same = (a?: string, b?: string) => norm(a) === norm(b);
const currency = (n?: number) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "");

// helpers
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function ProductDetailsClient({ product }: { product: Product }) {
  const title = product.product_name || product.name || "Untitled";
  const baseImages = product.images ?? [];
  const variants = Array.isArray(product.variants) ? product.variants : [];

  /** Derive full color/size options (fallback to variants if lists are missing) */
  const fullColors = useMemo(() => {
    const fromBackend = (product.availableColors || []).filter(Boolean);
    if (fromBackend.length) return fromBackend;
    const set = new Set<string>();
    variants.forEach((v) => {
      const c = v.colour || v.color;
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [product.availableColors, variants]);

  const fullSizes = useMemo(() => {
    const fromBackend = (product.availableSizes || []).filter(Boolean);
    if (fromBackend.length) return fromBackend;
    const set = new Set<string>();
    variants.forEach((v) => {
      if (v.size) set.add(v.size);
    });
    return Array.from(set);
  }, [product.availableSizes, variants]);

  /** State */
  const [activeColor, setActiveColor] = useState<string | undefined>(undefined);
  const [activeSize, setActiveSize] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);
  const [mainIndex, setMainIndex] = useState(0);

  /** Lightbox + Zoom (Option D) */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1); // 1..4
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [panning, setPanning] = useState(false);
  const panRef = useRef({ x: 0, y: 0, tx0: 0, ty0: 0 });
  const touchRef = useRef<{ x: number; t: number } | null>(null);

  // lock body scroll when viewer open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = viewerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [viewerOpen]);

  /** Init defaults to the first in-stock variant (or first available option) */
  useEffect(() => {
    const firstInStock = variants.find((v) => (v.stock ?? 0) > 0);
    const c = firstInStock?.colour || firstInStock?.color || fullColors[0];
    const s = firstInStock?.size || fullSizes[0];
    setActiveColor(c);
    setActiveSize(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product._id]);

  /** Build a lowercase-key map for colorImages so lookups are case-insensitive */
  const colorImgMap: Record<string, string[]> | undefined = useMemo(() => {
    if (!product.colorImages) return undefined;
    const out: Record<string, string[]> = {};
    for (const [k, arr] of Object.entries(product.colorImages)) {
      out[norm(k)] = Array.isArray(arr) ? arr : [];
    }
    return out;
  }, [product.colorImages]);

  /** Active variant(s) that match current selection */
  const matchingVariants = useMemo(() => {
    if (!variants.length) return [];
    return variants.filter((v) => {
      const vc = v.colour || v.color;
      const colorOk = activeColor ? same(vc, activeColor) : true;
      const sizeOk = activeSize ? same(v.size, activeSize) : true;
      return colorOk && sizeOk;
    });
  }, [variants, activeColor, activeSize]);

  /** Price/Stock */
  const computedPrice = useMemo(() => {
    const pv = matchingVariants.find((v) => typeof v.price === "number")?.price;
    if (typeof pv === "number") return pv;
    return product.minPrice ?? product.maxPrice ?? undefined;
  }, [matchingVariants, product.minPrice, product.maxPrice]);

  const computedStock = useMemo(() => {
    if (matchingVariants.length) {
      return matchingVariants.reduce((s, v) => s + (v.stock || 0), 0);
    }
    return product.totalStock ?? 0;
  }, [matchingVariants, product.totalStock]);

  /** Gallery (variant images > colorImages[color] > baseImages) */
  const gallery = useMemo(() => {
    const variantWithImgs = matchingVariants.find((v) => Array.isArray(v.images) && v.images.length);
    if (variantWithImgs?.images?.length) return variantWithImgs.images;
    const ck = norm(activeColor);
    if (ck && colorImgMap?.[ck]?.length) return colorImgMap[ck];
    return baseImages.length ? baseImages : ["/images/placeholder.jpg"];
  }, [matchingVariants, activeColor, colorImgMap, baseImages]);

  useEffect(() => setMainIndex(0), [gallery.join("|")]);

  /** Wishlist init */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("wishlist");
      const w = JSON.parse(raw || "[]");
      setWish(Array.isArray(w) && w.some((x: any) => (x._id || x.id) === product._id));
    } catch {}
  }, [product._id]);

  /** Actions */
  const addToCart = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("cart");
      const cart = JSON.parse(raw || "[]");
      const key = `${product._id}:${activeColor || ""}:${activeSize || ""}`;
      const idx = cart.findIndex((i: any) => i.key === key);
      const price = computedPrice || 0;
      if (idx >= 0) {
        cart[idx].quantity += qty;
      } else {
        cart.push({
          key,
          _id: product._id,
          slug: product.slug,
          name: title,
          price,
          color: activeColor,
          size: activeSize,
          image: gallery[0],
          quantity: qty,
        });
      }
      window.localStorage.setItem("cart", JSON.stringify(cart));
      if (typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }
    } catch {}
  };

  const toggleWishlist = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("wishlist");
      const w = JSON.parse(raw || "[]");
      const idx = w.findIndex((x: any) => (x._id || x.id) === product._id);
      if (idx >= 0) {
        w.splice(idx, 1);
        setWish(false);
      } else {
        w.push({
          _id: product._id,
          id: product._id,
          slug: product.slug,
          name: title,
          image: gallery[0],
        });
        setWish(true);
      }
      window.localStorage.setItem("wishlist", JSON.stringify(w));
      if (typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("wishlist-updated"));
      }
    } catch {}
  };

  /** Lightbox handlers */
  const openViewer = (i: number) => {
    setViewerIndex(i);
    setViewerOpen(true);
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const zoomBy = (delta: number, cx?: number, cy?: number) => {
    const next = clamp(scale + delta, 1, 4);
    // zoom towards cursor center if provided
    if (viewportRef.current && cx !== undefined && cy !== undefined) {
      const rect = viewportRef.current.getBoundingClientRect();
      const ox = cx - rect.left - rect.width / 2 - tx;
      const oy = cy - rect.top - rect.height / 2 - ty;
      const factor = next / scale;
      setTx(tx + ox - ox * factor);
      setTy(ty + oy - oy * factor);
    }
    setScale(next);
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    zoomBy(delta, e.clientX, e.clientY);
  };

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (scale === 1) return;
    setPanning(true);
    panRef.current = { x: e.clientX, y: e.clientY, tx0: tx, ty0: ty };
  };
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!panning) return;
    const dx = e.clientX - panRef.current.x;
    const dy = e.clientY - panRef.current.y;
    setTx(panRef.current.tx0 + dx);
    setTy(panRef.current.ty0 + dy);
  };
  const onMouseUp = () => setPanning(false);
  const onDoubleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    if (scale === 1) zoomBy(1, e.clientX, e.clientY);
    else {
      setScale(1);
      setTx(0);
      setTy(0);
    }
  };

  // touch swipe / pan
  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchRef.current = { x: t.clientX, t: Date.now() };
      if (scale > 1) {
        setPanning(true);
        panRef.current = { x: t.clientX, y: t.clientY, tx0: tx, ty0: ty };
      }
    }
  };
  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (panning && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - panRef.current.x;
      const dy = t.clientY - panRef.current.y;
      setTx(panRef.current.tx0 + dx);
      setTy(panRef.current.ty0 + dy);
    }
  };
  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const last = touchRef.current;
    setPanning(false);
    if (!last) return;
    const dt = Date.now() - last.t;
    const endX = (e.changedTouches[0] || last).clientX;
    const distX = endX - last.x;

    // quick swipe left/right when not zoomed
    if (scale === 1 && dt < 350 && Math.abs(distX) > 40) {
      if (distX < 0) setViewerIndex((i) => (i + 1) % gallery.length);
      else setViewerIndex((i) => (i - 1 + gallery.length) % gallery.length);
    }
  };

  /** Render */
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <div
            className="relative w-full aspect-[4/5] bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 cursor-zoom-in"
            onClick={() => openViewer(mainIndex)}
            title="Click to view large"
          >
            <Image
              src={gallery[mainIndex] || "/images/placeholder.jpg"}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width:1024px) 100vw, 50vw"
              priority
            />
          </div>

          {gallery.length > 1 && (
            <div className="mt-4 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 gap-2">
              {gallery.map((img, i) => (
                <button
                  key={i}
                  className={`relative aspect-square rounded-lg overflow-hidden border transition ${
                    i === mainIndex ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-400"
                  }`}
                  onClick={() => setMainIndex(i)}
                  onDoubleClick={() => openViewer(i)}
                  aria-label={`Preview ${i + 1}`}
                  title="Double-click to open"
                >
                  <Image src={img} alt={`${title} ${i + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
            <button
              onClick={toggleWishlist}
              className={`w-10 h-10 rounded-full border flex items-center justify-center ${
                wish ? "border-red-400 text-red-500" : "border-gray-300 text-gray-700 hover:text-red-500"
              }`}
              aria-label="Wishlist"
              title={wish ? "Remove from Wishlist" : "Add to Wishlist"}
            >
              <Heart className={`w-5 h-5 ${wish ? "fill-current" : ""}`} />
            </button>
          </div>

          <div className="mt-2 flex items-center gap-3">
            {typeof computedPrice === "number" ? (
              <p className="text-xl sm:text-2xl font-semibold text-amber-700">{currency(computedPrice)}</p>
            ) : (
              <p className="text-gray-500">Price will show after selecting options</p>
            )}
            <span
              className={`text-xs px-2 py-1 rounded-full border ${
                (computedStock ?? 0) > 0
                  ? "text-green-700 bg-green-50 border-green-200"
                  : "text-red-700 bg-red-50 border-red-200"
              }`}
            >
              {(computedStock ?? 0) > 0 ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          {/* Color */}
          {fullColors.length ? (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-900">Color</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {fullColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveColor(c)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      same(activeColor, c)
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 hover:border-gray-900"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Size */}
          {fullSizes.length ? (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-900">Size</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {fullSizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setActiveSize(s)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      same(activeSize, s)
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 hover:border-gray-900"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Quantity + Actions */}
          <div className="mt-6 flex items-center gap-3">
            <div className="inline-flex items-center border border-gray-300 rounded-xl overflow-hidden">
              <button className="px-3 py-2 hover:bg-gray-50" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-sm font-semibold">{qty}</span>
              <button className="px-3 py-2 hover:bg-gray-50" onClick={() => setQty((q) => q + 1)}>
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              disabled={(computedStock ?? 0) <= 0}
              onClick={addToCart}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm disabled:opacity-50"
            >
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </button>

            <button
              onClick={toggleWishlist}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border transition ${
                wish ? "border-red-300 bg-red-50 text-red-600" : "border-gray-300 hover:border-gray-900"
              }`}
            >
              <Heart className={`w-4 h-4 ${wish ? "fill-red-500 text-red-500" : ""}`} />
              {wish ? "Wishlisted" : "Wishlist"}
            </button>
          </div>

          {/* Meta */}
          <div className="mt-6 text-sm text-gray-600 space-y-1">
            {product.product_code && (
              <p>
                <span className="font-medium text-gray-800">Code:</span> {product.product_code}
              </p>
            )}
            {product.category && (
              <p>
                <span className="font-medium text-gray-800">Category:</span> {product.category}
              </p>
            )}
            {product.material && (
              <p>
                <span className="font-medium text-gray-800">Material:</span> {product.material}
              </p>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">Description</h2>
              <p className="mt-2 text-gray-700 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Specs */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900">Specifications</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-1 text-amber-600" />
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-900">{k}:</span> {v}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shipping & Returns */}
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            <div className="border rounded-xl p-4">
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <Truck className="w-4 h-4" /> Shipping
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Free delivery on orders above ₹2000. Standard shipping 2–5 business days.
              </p>
            </div>
            <div className="border rounded-xl p-4">
              <div className="flex items-center gap-2 font-semibold text-gray-900">
                <RotateCcw className="w-4 h-4" /> Returns
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Easy 7-day return for damaged products with unboxing video proof.
              </p>
            </div>
          </div>

          {/* Note */}
          <div className="mt-4 text-xs text-gray-500 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5" />
            <p>Actual color may vary slightly due to lighting and display settings.</p>
          </div>
        </div>
      </div>

      {/* ===== LIGHTBOX (Myntra-style) ===== */}
      {viewerOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm">
          {/* Top bar */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div className="text-white text-sm opacity-80">
              {title} &nbsp;•&nbsp; {viewerIndex + 1}/{gallery.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale((s) => clamp(s + 0.25, 1, 4))}
                className="px-3 py-1.5 rounded-md bg-white/10 text-white hover:bg-white/20"
              >
                +
              </button>
              <button
                onClick={() => setScale((s) => clamp(s - 0.25, 1, 4))}
                className="px-3 py-1.5 rounded-md bg-white/10 text-white hover:bg-white/20"
              >
                −
              </button>
              <button
                onClick={() => {
                  setScale(1);
                  setTx(0);
                  setTy(0);
                }}
                className="px-3 py-1.5 rounded-md bg-white/10 text-white hover:bg-white/20"
                title="Reset"
              >
                100%
              </button>
              <button
                onClick={() => closeViewer()}
                className="px-3 py-1.5 rounded-md bg-white/10 text-white hover:bg-white/20"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Main stage */}
          <div
            ref={viewportRef}
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onDoubleClick={onDoubleClick}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={() => closeViewer()}
            style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
          >
            <img
              src={gallery[viewerIndex]}
              alt=""
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              className="select-none"
              style={{
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                transition: panning ? "none" : "transform 120ms ease",
                maxWidth: "90vw",
                maxHeight: "85vh",
                objectFit: "contain",
                willChange: "transform",
              }}
            />
          </div>

          {/* Arrows */}
          {gallery.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewerIndex((i) => (i - 1 + gallery.length) % gallery.length);
                  setScale(1);
                  setTx(0);
                  setTy(0);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewerIndex((i) => (i + 1) % gallery.length);
                  setScale(1);
                  setTx(0);
                  setTy(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl"
                aria-label="Next"
              >
                ›
              </button>
            </>
          )}

          {/* Thumbs */}
          {gallery.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {gallery.map((src, i) => (
                <button
                  key={src + i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewerIndex(i);
                    setScale(1);
                    setTx(0);
                    setTy(0);
                  }}
                  className={`h-14 w-14 rounded-md overflow-hidden border ${
                    i === viewerIndex ? "border-white" : "border-white/40"
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}