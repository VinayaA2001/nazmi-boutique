'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag, Shield, Truck, ArrowLeft, CreditCard, RotateCcw, Heart, Zap, Lock, Star, Camera } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
  inStock: boolean;
  category?: string;
  productCode?: string;
  maxStock: number;
  currentStock: number;
  size?: string;
  sku?: string;
  description?: string;
  returnPolicy?: string;
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSticky, setIsSticky] = useState(false);
  const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);

  const loadCartItems = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const validatedCart = cart.map((item: CartItem) => ({
        ...item,
        currentStock: item.currentStock || item.maxStock || 1,
        inStock: (item.currentStock || item.maxStock || 1) > 0
      }));
      setCartItems(validatedCart);
    } catch (error) {
      console.error('Error loading cart:', error);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedForLater = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('savedForLater') || '[]');
      setSavedForLater(saved);
    } catch (error) {
      console.error('Error loading saved items:', error);
      setSavedForLater([]);
    }
  };

  useEffect(() => {
    loadCartItems();
    loadSavedForLater();
    window.addEventListener('cart-updated', loadCartItems);
    
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: [0] }
    );
    
    const sentinel = document.getElementById('cart-sentinel');
    if (sentinel) observer.observe(sentinel);
    
    return () => {
      window.removeEventListener('cart-updated', loadCartItems);
      if (sentinel) observer.unobserve(sentinel);
    };
  }, []);

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    const updatedCart = cartItems.map(item => {
      if (item.id === productId) {
        const currentStock = item.currentStock || item.maxStock;
        const finalQuantity = Math.min(newQuantity, currentStock);
        return { 
          ...item, 
          quantity: finalQuantity,
          inStock: currentStock > 0
        };
      }
      return item;
    });
    
    setCartItems(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const removeItem = (productId: string) => {
    const updatedCart = cartItems.filter(item => item.id !== productId);
    setCartItems(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const moveToWishlist = (item: CartItem) => {
    removeItem(item.id);
    const updatedSaved = [...savedForLater, item];
    setSavedForLater(updatedSaved);
    localStorage.setItem('savedForLater', JSON.stringify(updatedSaved));
  };

  const moveToCart = (item: CartItem) => {
    const updatedSaved = savedForLater.filter(savedItem => savedItem.id !== item.id);
    setSavedForLater(updatedSaved);
    localStorage.setItem('savedForLater', JSON.stringify(updatedSaved));
    
    const updatedCart = [...cartItems, item];
    setCartItems(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.setItem('cart', '[]');
    window.dispatchEvent(new Event('cart-updated'));
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateDiscount = () => {
    return cartItems.reduce((total, item) => {
      if (item.originalPrice) {
        return total + ((item.originalPrice - item.price) * item.quantity);
      }
      return total;
    }, 0);
  };

  const calculateShipping = () => {
    const subtotal = calculateSubtotal();
    return subtotal > 1999 ? 0 : 60; // Changed to 60rs
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateShipping();
  };

  const getSavingsPercentage = () => {
    const originalTotal = cartItems.reduce((total, item) => 
      total + ((item.originalPrice || item.price) * item.quantity), 0
    );
    const discountedTotal = calculateSubtotal();
    return originalTotal > 0 ? Math.round(((originalTotal - discountedTotal) / originalTotal) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              <div className="xl:col-span-3 space-y-6">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex gap-6">
                      <div className="w-28 h-28 bg-gray-200 rounded-xl"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-8 bg-gray-200 rounded w-32"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-96"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Sticky Sentinel */}
      <div id="cart-sentinel" className="h-px" />
      
      {/* Enhanced Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="p-3 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl shadow-lg">
                  <ShoppingBag className="w-8 h-8 text-white" />
                </div>
                {cartItems.length > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
                    {cartItems.length}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-4xl font-light text-gray-900 mb-2">Shopping Cart</h1>
                {/* Removed "Back to Ethnic Wears" link */}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {cartItems.length > 0 && (
                <>
                  <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                    <Zap className="w-4 h-4 text-green-500" />
                    <span>Free shipping on orders over ₹1,999</span>
                  </div>
                  <button
                    onClick={clearCart}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 text-sm font-medium transition-colors border border-red-200 hover:border-red-300 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Cart
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {cartItems.length === 0 ? (
          // Enhanced Empty Cart State
          <div className="text-center py-16 max-w-2xl mx-auto">
            <div className="w-40 h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg relative">
              <ShoppingBag className="w-20 h-20 text-gray-400" />
              <div className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg">
                <div className="w-6 h-6 bg-gray-400 rounded-full"></div>
              </div>
            </div>
            <h2 className="text-4xl font-light text-gray-900 mb-4">Your Cart is Empty</h2>
            <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto leading-relaxed">
              Discover our curated collection of ethnic wears and fashion products. Fill your cart with items you'll love.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/"
                className="bg-gradient-to-r from-gray-900 to-gray-700 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-3"
              >
                <Zap className="w-5 h-5" />
                Continue Shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Cart Items Section */}
            <div className="xl:col-span-3 space-y-6">
              {/* Savings Banner */}
              {calculateDiscount() > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-100 border border-green-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">%</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-900">You're saving ₹{calculateDiscount().toLocaleString()}!</h3>
                        <p className="text-sm text-green-700">That's {getSavingsPercentage()}% off your order</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-900">₹{calculateDiscount().toLocaleString()}</p>
                      <p className="text-sm text-green-700">Total Savings</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cart Items */}
              <div className="space-y-4">
                {cartItems.map((item, index) => {
                  const currentStock = item.currentStock || item.maxStock;
                  
                  return (
                    <div 
                      key={`${item.id}-${item.selectedSize}-${item.selectedColor}`}
                      className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-500 p-6 relative overflow-hidden"
                    >
                      {/* Removed stock warning section */}
                      
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Product Image */}
                        <div className="flex-shrink-0 relative">
                          <div className="relative w-28 h-28 rounded-xl overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                            <Image
                              src={item.image || "/api/placeholder/112/112"}
                              alt={item.name}
                              fill
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                              onError={(e) => {
                                e.currentTarget.src = "/api/placeholder/112/112";
                              }}
                            />
                            {currentStock === 0 && (
                              <div className="absolute inset-0 bg-red-500/90 flex items-center justify-center rounded-xl">
                                <span className="text-white text-sm font-medium px-2 py-1">Out of Stock</span>
                              </div>
                            )}
                          </div>
                          {/* Quick Actions */}
                          <div className="absolute -bottom-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                              onClick={() => moveToWishlist(item)}
                              className="bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors"
                            >
                              <Heart className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                            <div className="flex-1">
                              <Link href={`/product/${item.id}`} className="hover:opacity-80 transition-opacity">
                                <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">{item.name}</h3>
                              </Link>
                              <div className="flex flex-wrap gap-2 mb-3">
                                <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                                  Size: {item.selectedSize || item.size || 'Free Size'}
                                </span>
                                {item.selectedColor && (
                                  <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                                    Color: {item.selectedColor}
                                  </span>
                                )}
                                {item.category && (
                                  <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                              
                              {/* Price Display */}
                              <div className="flex items-center gap-3 mb-2">
                                <p className="text-2xl font-bold text-gray-900">
                                  ₹{item.price.toLocaleString()}
                                </p>
                                {item.originalPrice && item.originalPrice > item.price && (
                                  <>
                                    <p className="text-lg text-gray-500 line-through">
                                      ₹{item.originalPrice.toLocaleString()}
                                    </p>
                                    <span className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
                                      Save {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%
                                    </span>
                                  </>
                                )}
                              </div>
                              
                              {/* Product Code */}
                              {item.productCode && (
                                <p className="text-sm text-gray-500">SKU: {item.productCode}</p>
                              )}
                              {item.sku && (
                                <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                              )}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => moveToWishlist(item)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-300"
                                title="Save for later"
                              >
                                <Heart className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-300"
                                title="Remove item"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          {/* Quantity Controls & Total */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1 || currentStock === 0}
                                  className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-white min-w-[40px] flex items-center justify-center"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="px-4 py-2 min-w-[50px] text-center font-semibold text-gray-900 text-lg border-l border-r border-gray-200">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= currentStock || currentStock === 0}
                                  className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-white min-w-[40px] flex items-center justify-center"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className="text-2xl font-bold text-gray-900">
                                ₹{(item.price * item.quantity).toLocaleString()}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                {item.quantity} × ₹{item.price.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Saved for Later Section */}
              {savedForLater.length > 0 && (
                <div className="mt-12">
                  <h3 className="text-2xl font-light text-gray-900 mb-6 flex items-center gap-3">
                    <Heart className="w-6 h-6 text-red-500" />
                    Saved for Later ({savedForLater.length})
                  </h3>
                  <div className="space-y-4">
                    {savedForLater.map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                        <div className="flex gap-4">
                          <div className="w-20 h-20 rounded-lg overflow-hidden">
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={80}
                              height={80}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>
                            <p className="text-lg font-bold text-gray-900 mb-2">₹{item.price.toLocaleString()}</p>
                            <button
                              onClick={() => moveToCart(item)}
                              className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                            >
                              <Plus className="w-4 h-4" />
                              Move to Cart
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary - Enhanced Sticky Sidebar */}
            <div className="xl:col-span-1">
              <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transition-all duration-300 ${
                isSticky ? 'xl:fixed xl:top-24 xl:w-[380px] xl:z-40 xl:shadow-2xl' : 'xl:sticky xl:top-8'
              }`}>
                <h2 className="text-2xl font-light text-gray-900 mb-6 pb-4 border-b border-gray-100">Order Summary</h2>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Subtotal ({cartItems.length} items)</span>
                    <span className="font-semibold">₹{calculateSubtotal().toLocaleString()}</span>
                  </div>
                  
                  {calculateDiscount() > 0 && (
                    <div className="flex justify-between items-center text-green-600">
                      <span>Discount</span>
                      <span className="font-bold">-₹{calculateDiscount().toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-gray-700">
                    <span>Shipping</span>
                    <span className={calculateShipping() === 0 ? "text-green-600 font-bold" : "font-semibold"}>
                      {calculateShipping() === 0 ? "FREE" : `₹${calculateShipping().toLocaleString()}`}
                    </span>
                  </div>
                  
                  {/* Enhanced Free Shipping Progress */}
                  {calculateShipping() > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Truck className="w-4 h-4 text-amber-600" />
                        <p className="text-amber-800 font-medium text-sm">
                          Add ₹{(1999 - calculateSubtotal()).toLocaleString()} for FREE shipping!
                        </p>
                      </div>
                      <div className="w-full bg-amber-200 rounded-full h-2 mb-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-1000 ease-out shadow-sm"
                          style={{ 
                            width: `${Math.min((calculateSubtotal() / 1999) * 100, 100)}%` 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-amber-700">
                        <span>₹0</span>
                        <span className="font-medium">
                          {Math.round((calculateSubtotal() / 1999) * 100)}% Complete
                        </span>
                        <span>₹1,999</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center text-lg mb-2">
                      <span className="font-semibold text-gray-900">Total Amount</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                        ₹{calculateTotal().toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm">Inclusive of all taxes • No returns</p>
                  </div>
                </div>

                {/* Enhanced Checkout Button */}
                <Link
                  href="/checkout"
                  className="w-full bg-gradient-to-r from-gray-900 to-gray-700 text-white py-4 px-6 rounded-xl font-semibold hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-3 mb-4 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-700 to-gray-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CreditCard className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">PROCEED TO CHECKOUT</span>
                </Link>

                {/* Removed Continue Shopping button */}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}