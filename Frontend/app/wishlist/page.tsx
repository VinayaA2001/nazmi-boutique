"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag, Eye } from "lucide-react";

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [showCartNotification, setShowCartNotification] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("wishlist");
    if (saved) setWishlist(JSON.parse(saved));
  }, []);

  const removeItem = (id: number) => {
    const updated = wishlist.filter((item) => item.id !== id);
    setWishlist(updated);
    localStorage.setItem("wishlist", JSON.stringify(updated));
  };

  const addToCart = (item: any) => {
    // Get existing cart or initialize empty array
    const existingCart = localStorage.getItem("cart");
    const cart = existingCart ? JSON.parse(existingCart) : [];
    
    // Check if item already exists in cart
    const existingItem = cart.find((cartItem: any) => 
      cartItem.id === item.id && 
      cartItem.size === item.size && 
      cartItem.color === item.color
    );

    if (existingItem) {
      // Update quantity if item exists
      const updatedCart = cart.map((cartItem: any) =>
        cartItem.id === item.id && 
        cartItem.size === item.size && 
        cartItem.color === item.color
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      );
      localStorage.setItem("cart", JSON.stringify(updatedCart));
    } else {
      // Add new item to cart
      const newItem = {
        ...item,
        quantity: 1,
        size: item.size || 'M', // Default size
        color: item.color || 'Default' // Default color
      };
      localStorage.setItem("cart", JSON.stringify([...cart, newItem]));
    }

    setShowCartNotification(true);
    setTimeout(() => setShowCartNotification(false), 3000);
  };

  const moveToCart = (item: any) => {
    addToCart(item);
    removeItem(item.id);
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
              {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
            <Link href="/" className="hover:text-gray-700">Home</Link>
            <span>›</span>
            <span className="text-gray-900">Wishlist</span>
          </div>
        </div>
      </div>

      {/* Wishlist Content */}
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
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/western"
                className="bg-gray-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Browse Western
              </Link>
              <Link 
                href="/Ethnic-Wears"
                className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:border-gray-400 transition-colors"
              >
                Browse Traditional
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Wishlist Actions */}
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">
                Saved {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'}
              </p>
              <button
                onClick={() => {
                  setWishlist([]);
                  localStorage.removeItem("wishlist");
                }}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Clear All
              </button>
            </div>

            {/* Wishlist Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {wishlist.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-400 transition-all duration-300 group"
                >
                  {/* Product Image */}
                  <div className="relative h-64 overflow-hidden">
                    <Image
                      src={item.image || item.images?.[0] || "/images/poster1.png"}
                      alt={item.title || item.name}
                      fill
                      className="object-cover group-hover:scale-105 transition duration-700"
                    />
                    
                    {/* Remove from Wishlist Button */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300 group/wishlist"
                    >
                      <Heart className="w-5 h-5 fill-red-500 text-red-500 group-hover/wishlist:fill-white group-hover/wishlist:text-white" />
                    </button>

                    {/* Quick Actions */}
                    <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="flex gap-2">
                        <button
                          onClick={() => moveToCart(item)}
                          className="flex-1 bg-gray-900 text-white py-2 px-3 rounded text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-1"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          Add to Cart
                        </button>
                        <Link 
                          href={(() => {
                            const cat = (item.category || '').toString().toLowerCase();
                            if (cat.includes('ethnic') || cat.includes('traditional')) return '/Ethnic-Wears';
                            if (cat.includes('western')) return '/western';
                            if (cat.includes('sale')) return '/sale';
                            return '/';
                          })()}
                          className="w-10 h-10 bg-white border border-gray-300 rounded flex items-center justify-center hover:border-gray-400 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                      {item.title || item.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {item.description}
                    </p>
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-gray-900">
                          ₹{item.price}
                        </span>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <>
                            <span className="text-sm text-gray-500 line-through">
                              ₹{item.originalPrice}
                            </span>
                            <span className="text-sm text-green-600 font-medium">
                              {Math.round((1 - item.price / item.originalPrice) * 100)}% OFF
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Product Meta */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="capitalize">{item.category}</span>
                      {item.inStock !== false && (
                        <span className="text-green-600">In Stock</span>
                      )}
                    </div>

                    {/* Mobile Action Button */}
                    <button
                      onClick={() => moveToCart(item)}
                      className="w-full mt-4 bg-gray-900 text-white py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 md:hidden"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Move to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Continue Shopping */}
            <div className="text-center mt-12 border-t pt-8">
              <p className="text-gray-600 mb-6">Continue exploring our collection</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  href="/western/tops"
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors"
                >
                  Western Tops
                </Link>
                <Link 
                  href="/western/officewear"
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors"
                >
                  Officewear
                </Link>
                <Link 
                  href="/western/bottomwears"
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors"
                >
                  Bottomwears
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cart Notification */}
      {showCartNotification && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Product moved to cart!
          </div>
        </div>
      )}
    </div>
  );
}
