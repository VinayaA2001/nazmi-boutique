// app/product/[slug]/ProductClientPage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

// 👉 use the shared data model & data
import { products as allProducts, Product } from "@/lib/data";

type Tab = "description" | "details" | "care" | "reviews";

export default function ProductClientPage({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>("description");
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    setLoading(true);

    // Find by slug; also fall back to slugified name if needed
    const bySlug =
      allProducts.find((p) => p.slug === slug) ||
      allProducts.find(
        (p) => p.name.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase()
      );

    if (bySlug) {
      setProduct(bySlug);
      if (bySlug.sizes?.length) setSelectedSize(bySlug.sizes[0]);

      const related = allProducts
        .filter((x) => x.category === bySlug.category && x.id !== bySlug.id)
        .slice(0, 4);
      setRelatedProducts(related);
    } else {
      setProduct(null);
      setRelatedProducts([]);
    }

    setLoading(false);
  }, [slug]);

  // helpers
  const decQty = () => setQuantity((q) => Math.max(1, q - 1));
  const incQty = () =>
    setQuantity((q) => (product ? Math.min(product.stock, q + 1) : q));

  const addToCart = () => {
    if (!product) return;
    if (product.sizes?.length && !selectedSize) return; // require size if available
    if (quantity > product.stock) {
      alert(`Only ${product.stock} in stock`);
      return;
    }

    setAddingToCart(true);

    const cartItem = {
      id: `${product.id}-${selectedSize || "NA"}-${selectedColor || "Default"}`,
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      quantity,
      size: selectedSize || "",
      color: selectedColor || "Default",
    };

    const existing = JSON.parse(localStorage.getItem("cart") || "[]");
    const idx = existing.findIndex((i: any) => i.id === cartItem.id);
    const updated =
      idx > -1
        ? existing.map((i: any, k: number) =>
            k === idx ? { ...i, quantity: i.quantity + quantity } : i
          )
        : [...existing, cartItem];

    localStorage.setItem("cart", JSON.stringify(updated));
    window.dispatchEvent(new Event("cartUpdated"));
    setTimeout(() => setAddingToCart(false), 600);
  };

  const buyNow = () => {
    addToCart();
    // simple client-side redirect (no Router here to keep file minimal)
    window.location.href = "/cart";
  };

  // static options (adjust any time)
  const availableColors = ["Black", "Navy Blue", "Burgundy", "Forest Green"];
  const productDetails = useMemo(
    () => ["Premium quality fabric", "Handcrafted embroidery", "Comfortable fit", "Machine washable"],
    []
  );
  const careInstructions = useMemo(
    () => ["Machine wash cold with similar colors", "Tumble dry low", "Iron on low heat", "Do not bleach"],
    []
  );

  if (loading) {
    return (
      <section className="container py-8">
        <div className="animate-pulse">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="aspect-square bg-gray-200 rounded-lg" />
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-6 bg-gray-200 rounded w-1/4" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
              </div>
              <div className="h-12 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="container py-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
          <p className="text-gray-600 mb-8">
            The product you're looking for doesn't exist or has been moved.
          </p>
        </div>
      </section>
    );
  }

  const images = (product.images?.length ? product.images : ["/images/fallback.jpg"]).slice(0, 5);

  return (
    <section className="container py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-600 mb-8">
        <Link href="/" className="hover:text-black transition">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-black transition">Products</Link>
        <span>/</span>
        <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="hover:text-black transition capitalize">
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-black">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-12 mb-16">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
            <Image
              src={images[selectedImage]}
              alt={product.name}
              width={600}
              height={600}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={`aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 transition-all ${
                  selectedImage === i ? "border-black" : "border-transparent"
                }`}
              >
                <Image
                  src={img}
                  alt={`${product.name} view ${i + 1}`}
                  width={150}
                  height={150}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium mb-2">
              {product.category}
            </span>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">{product.name}</h1>

            {/* Stock badge */}
            <div className="mt-1 mb-2 text-sm">
              {product.stock <= 0 ? (
                <span className="text-red-600 font-medium">Out of stock</span>
              ) : product.stock <= 3 ? (
                <span className="text-amber-600 font-medium">Only {product.stock} left</span>
              ) : (
                <span className="text-green-600 font-medium">In stock</span>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-gray-900">₹{product.price.toLocaleString()}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <>
                <span className="text-lg text-gray-500 line-through">₹{product.originalPrice.toLocaleString()}</span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                  {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                </span>
              </>
            )}
          </div>

          <p className="text-gray-600 text-lg leading-relaxed">{product.description}</p>

          {/* Color */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Color: {selectedColor || "Black"}</h3>
            <div className="flex gap-3">
              {["Black", "Navy Blue", "Burgundy", "Forest Green"].map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    selectedColor === color ? "border-black ring-2 ring-gray-200" : "border-gray-300"
                  }`}
                  style={{
                    backgroundColor:
                      color === "Black" ? "#000" :
                      color === "Navy Blue" ? "#001f3f" :
                      color === "Burgundy" ? "#800020" : "#228B22",
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          {product.sizes?.length ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Size</h3>
                <button className="text-sm text-gray-600 hover:text-black transition">Size Guide</button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`py-3 border rounded-lg font-medium transition-all ${
                      selectedSize === size ? "border-black bg-black text-white" : "border-gray-300 hover:border-black"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Quantity & Actions */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-gray-900">Quantity:</span>
              <div className="flex items-center border rounded-lg">
                <button
                  onClick={decQty}
                  className="w-12 h-12 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-l-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={incQty}
                  className="w-12 h-12 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-r-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={addToCart}
                disabled={addingToCart || product.stock === 0}
                className="flex-1 bg-black text-white py-4 px-8 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
              >
                {addingToCart ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : product.stock === 0 ? (
                  "Out of Stock"
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add to Cart
                  </>
                )}
              </button>
              <button
                onClick={buyNow}
                disabled={product.stock === 0}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 px-8 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-colors"
              >
                Buy Now
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t">
            <div className="text-center">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span>🚚</span>
              </div>
              <p className="text-xs text-gray-600">Free Shipping</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span>↩️</span>
              </div>
              <p className="text-xs text-gray-600">Easy Returns</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span>🔒</span>
              </div>
              <p className="text-xs text-gray-600">Secure Payment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t pt-12">
        <div className="flex border-b mb-8">
          {[
            { id: "description", label: "Description" },
            { id: "details", label: "Product Details" },
            { id: "care", label: "Care Instructions" },
            { id: "reviews", label: "Reviews" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === (tab.id as Tab)
                  ? "border-black text-black"
                  : "border-transparent text-gray-600 hover:text-black"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="prose max-w-none">
          {activeTab === "description" && (
            <div className="space-y-4">
              <p className="text-gray-600 leading-relaxed">{product.description}</p>
              <p className="text-gray-600 leading-relaxed">
                Crafted with premium materials and attention to detail, this piece
                combines traditional elegance with contemporary style.
              </p>
            </div>
          )}

          {activeTab === "details" && (
            <ul className="space-y-2">
              {productDetails.map((detail, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-600">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {detail}
                </li>
              ))}
            </ul>
          )}

          {activeTab === "care" && (
            <ul className="space-y-2">
              {careInstructions.map((instruction, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-600">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {instruction}
                </li>
              ))}
            </ul>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <p className="text-gray-600">No reviews yet. Be the first to review this product!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related */}
      {relatedProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-8">You Might Also Like</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((rp) => (
              <Link key={rp.id} href={`/product/${rp.slug}`} className="group">
                <div className="bg-gray-100 rounded-xl overflow-hidden aspect-square mb-4">
                  <Image
                    src={rp.images[0]}
                    alt={rp.name}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-black transition">
                  {rp.name}
                </h3>
                <p className="text-gray-600">₹{rp.price.toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}