'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag, Truck, CreditCard, Zap } from 'lucide-react';

/* ========= Types ========= */
interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  selectedSize?: string;
  selectedColor?: string;
  quantity: number;
  inStock: boolean;
  category?: string;
  productCode?: string;
  maxStock: number;
  currentStock?: number;
  sku?: string;
}

/* ========= Config ========= */
const FREE_SHIP_THRESHOLD = 1999;
const SHIPPING_FEE = 60;
const COD_FEE = 40;
const GIFT_WRAP_FEE = 25;

/* Fake coupon store for demo (replace with API validation) */
const COUPONS: Record<
  string,
  { type: 'percent' | 'flat'; value: number; minSubtotal?: number; label?: string }
> = {
  SAVE10: { type: 'percent', value: 10, minSubtotal: 999, label: '10% OFF' },
  FLAT100: { type: 'flat', value: 100, minSubtotal: 999, label: '₹100 OFF' },
};

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSticky, setIsSticky] = useState(false);

  // UX extras
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [useCOD, setUseCOD] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [pincode, setPincode] = useState('');
  const [eta, setEta] = useState<string>('—');

  /* ====== Load / persist ====== */
  const loadCart = () => {
    try {
      const raw = JSON.parse(localStorage.getItem('cart') || '[]');
      const validated: CartItem[] = raw.map((it: CartItem) => {
        const stock = it.currentStock ?? it.maxStock ?? 1;
        return { ...it, currentStock: stock, inStock: stock > 0, quantity: Math.max(1, Math.min(it.quantity, stock)) };
      });
      setCartItems(validated);
    } catch {
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const persistCart = (next: CartItem[]) => {
    setCartItems(next);
    localStorage.setItem('cart', JSON.stringify(next));
    window.dispatchEvent(new Event('cart-updated'));
  };

  useEffect(() => {
    loadCart();
    window.addEventListener('cart-updated', loadCart);

    const obs = new IntersectionObserver(([entry]) => setIsSticky(!entry.isIntersecting), { threshold: [0] });
    const el = document.getElementById('cart-sentinel');
    if (el) obs.observe(el);

    // Load persisted UX toggles (optional)
    const savedCOD = localStorage.getItem('cart_useCOD');
    const savedWrap = localStorage.getItem('cart_giftWrap');
    const savedCoupon = localStorage.getItem('cart_coupon');
    const savedNotes = localStorage.getItem('cart_notes');
    const savedPin = localStorage.getItem('cart_pincode');

    if (savedCOD) setUseCOD(savedCOD === '1');
    if (savedWrap) setGiftWrap(savedWrap === '1');
    if (savedCoupon) setAppliedCoupon(savedCoupon);
    if (savedNotes) setOrderNotes(savedNotes);
    if (savedPin) setPincode(savedPin);

    return () => {
      window.removeEventListener('cart-updated', loadCart);
      if (el) obs.unobserve(el);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('cart_useCOD', useCOD ? '1' : '0');
  }, [useCOD]);
  useEffect(() => {
    localStorage.setItem('cart_giftWrap', giftWrap ? '1' : '0');
  }, [giftWrap]);
  useEffect(() => {
    if (appliedCoupon) localStorage.setItem('cart_coupon', appliedCoupon);
    else localStorage.removeItem('cart_coupon');
  }, [appliedCoupon]);
  useEffect(() => {
    localStorage.setItem('cart_notes', orderNotes);
  }, [orderNotes]);
  useEffect(() => {
    localStorage.setItem('cart_pincode', pincode);
  }, [pincode]);

  /* ====== Cart actions ====== */
  const updateQty = (id: string, newQty: number) => {
    if (newQty < 1) return;
    const next = cartItems.map((it) => {
      if (it.id !== id) return it;
      const stock = it.currentStock ?? it.maxStock ?? 1;
      return { ...it, quantity: Math.min(newQty, stock) };
    });
    persistCart(next);
  };

  const removeItem = (id: string) => {
    const next = cartItems.filter((it) => it.id !== id);
    persistCart(next);
  };

  const clearCart = () => {
    if (!confirm('Remove all items from cart?')) return;
    persistCart([]);
  };

  /* ====== Pricing ====== */
  const subtotal = useMemo(() => cartItems.reduce((t, it) => t + it.price * it.quantity, 0), [cartItems]);

  const undiscountedTotal = useMemo(
    () => cartItems.reduce((t, it) => t + (it.originalPrice ?? it.price) * it.quantity, 0),
    [cartItems]
  );

  const automaticDiscount = Math.max(0, undiscountedTotal - subtotal);

  // Coupon calculation (client-side demo)
  const couponValue = useMemo(() => {
    if (!appliedCoupon) return 0;
    const c = COUPONS[appliedCoupon.toUpperCase()];
    if (!c) return 0;
    if (c.minSubtotal && subtotal < c.minSubtotal) return 0;
    return c.type === 'percent' ? Math.round((subtotal * c.value) / 100) : c.value;
  }, [appliedCoupon, subtotal]);

  const shipping = subtotal >= FREE_SHIP_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE;
  const codFee = useCOD ? COD_FEE : 0;
  const wrapFee = giftWrap ? GIFT_WRAP_FEE : 0;

  const grandTotal = Math.max(0, subtotal - couponValue) + shipping + codFee + wrapFee;

  const savingsPct = undiscountedTotal > 0 ? Math.round(((undiscountedTotal - subtotal) / undiscountedTotal) * 100) : 0;

  /* ====== Coupon handlers ====== */
  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    const meta = COUPONS[code];
    if (!meta) {
      setCouponError('Invalid coupon code');
      setAppliedCoupon(null);
      return;
    }
    if (meta.minSubtotal && subtotal < meta.minSubtotal) {
      setCouponError(`Minimum subtotal ₹${meta.minSubtotal} required`);
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(code);
    setCouponError(null);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  /* ====== ETA (simple demo) ====== */
  useEffect(() => {
    if (!pincode || pincode.length < 6) {
      setEta('—');
      return;
    }
    // Simple ETA demo: 2–5 days, slightly different if far pincode
    const base = 2 + Math.min(3, Math.max(0, Number(pincode[pincode.length - 1]) % 4));
    const arrive = new Date();
    arrive.setDate(arrive.getDate() + base);
    setEta(arrive.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
  }, [pincode]);

  /* ====== UI ====== */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8" />
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              <div className="xl:col-span-3 space-y-6">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex gap-6">
                      <div className="w-28 h-28 bg-gray-200 rounded-xl" />
                      <div className="flex-1 space-y-3">
                        <div className="h-6 bg-gray-200 rounded w-3/4" />
                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                        <div className="h-8 bg-gray-200 rounded w-32" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-96" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Sticky sentinel */}
      <div id="cart-sentinel" className="h-px" />

      {/* Header */}
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
              <h1 className="text-4xl font-light text-gray-900">Shopping Cart</h1>
            </div>

            <div className="flex items-center gap-4">
              {cartItems.length > 0 && (
                <>
                  <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                    <Zap className="w-4 h-4 text-green-500" />
                    <span>Free shipping on orders over ₹{FREE_SHIP_THRESHOLD.toLocaleString()}</span>
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
          <div className="text-center py-16 max-w-2xl mx-auto">
            <div className="w-40 h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
              <ShoppingBag className="w-20 h-20 text-gray-400" />
            </div>
            <h2 className="text-4xl font-light text-gray-900 mb-4">Your Cart is Empty</h2>
            <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto leading-relaxed">
              Discover our curated collection of ethnic & western wear. Fill your cart with pieces you’ll love.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-gray-900 to-gray-700 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <Zap className="w-5 h-5" />
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Items */}
            <div className="xl:col-span-3 space-y-6">
              {/* Savings banner */}
              {(automaticDiscount > 0) && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-100 border border-green-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">%</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-900">
                          You’re saving ₹{automaticDiscount.toLocaleString()}!
                        </h3>
                        <p className="text-sm text-green-700">{savingsPct}% off MRP</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* List */}
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const stock = item.currentStock ?? item.maxStock ?? 1;

                  return (
                    <div
                      key={`${item.id}-${item.selectedSize ?? ''}-${item.selectedColor ?? ''}`}
                      className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-500 p-6"
                    >
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Image */}
                        <div className="flex-shrink-0">
                          <div className="relative w-28 h-28 rounded-xl overflow-hidden shadow-md">
                            <Image
                              src={item.image || '/images/poster1.png'}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="112px"
                            />
                            {stock === 0 && (
                              <div className="absolute inset-0 bg-red-500/90 flex items-center justify-center rounded-xl">
                                <span className="text-white text-xs font-semibold px-2 py-1">Out of Stock</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                            <div className="flex-1">
                              <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-1 line-clamp-2">
                                {item.name}
                              </h3>

                              <div className="flex flex-wrap gap-2 mb-3 text-sm">
                                {item.selectedSize && (
                                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg">Size: {item.selectedSize}</span>
                                )}
                                {item.selectedColor && (
                                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg">Color: {item.selectedColor}</span>
                                )}
                                {item.category && (
                                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg">{item.category}</span>
                                )}
                                {(item.productCode || item.sku) && (
                                  <span className="text-gray-500">SKU: {item.productCode || item.sku}</span>
                                )}
                              </div>

                              {/* Price */}
                              <div className="flex items-center gap-3">
                                <p className="text-2xl font-bold text-gray-900">₹{item.price.toLocaleString()}</p>
                                {item.originalPrice && item.originalPrice > item.price && (
                                  <>
                                    <p className="text-lg text-gray-500 line-through">
                                      ₹{item.originalPrice.toLocaleString()}
                                    </p>
                                    <span className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                                      Save {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Row actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-300"
                                title="Remove item"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          {/* Qty + line total */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
                                <button
                                  onClick={() => updateQty(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1 || stock === 0}
                                  className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-30 rounded-lg min-w-[40px]"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="px-4 py-2 min-w-[50px] text-center font-semibold text-gray-900 text-lg border-l border-r border-gray-200">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQty(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= stock || stock === 0}
                                  className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-30 rounded-lg min-w-[40px]"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              <span className="text-xs text-gray-500">In stock: {stock}</span>
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
            </div>

            {/* Summary */}
            <div className="xl:col-span-1">
              <div
                className={`bg-white rounded-2xl shadow-xl border border-gray-100 p-6 transition-all duration-300 ${
                  isSticky ? 'xl:fixed xl:top-24 xl:w-[380px] xl:z-40 xl:shadow-2xl' : 'xl:sticky xl:top-8'
                }`}
              >
                <h2 className="text-2xl font-light text-gray-900 mb-4">Order Summary</h2>

                {/* Totals */}
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span>Subtotal ({cartItems.length} items)</span>
                    <span className="font-medium">₹{subtotal.toLocaleString()}</span>
                  </div>
                  {automaticDiscount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Price Drop Savings</span>
                      <span className="font-semibold">-₹{automaticDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {appliedCoupon && couponValue > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Coupon ({appliedCoupon})</span>
                      <span className="font-semibold">-₹{couponValue.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className={shipping === 0 ? 'text-green-600 font-semibold' : 'font-medium'}>
                      {shipping === 0 ? 'FREE' : `₹${SHIPPING_FEE}`}
                    </span>
                  </div>
                  {giftWrap && (
                    <div className="flex justify-between">
                      <span>Gift Wrap</span>
                      <span className="font-medium">₹{GIFT_WRAP_FEE}</span>
                    </div>
                  )}
                  {useCOD && (
                    <div className="flex justify-between">
                      <span>COD Fee</span>
                      <span className="font-medium">₹{COD_FEE}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-3 flex justify-between text-base">
                    <span className="font-semibold text-gray-900">Total Amount</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      ₹{grandTotal.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-500">Inclusive of all taxes • No returns</p>
                </div>

                {/* Checkout */}
                <Link
                  href={{
                    pathname: '/checkout',
                    query: {
                      cod: useCOD ? '1' : '0',
                      wrap: giftWrap ? '1' : '0',
                      note: orderNotes ? '1' : '0', // keep short; read full note from storage on checkout
                      coupon: appliedCoupon ?? '',
                    },
                  }}
                  className="w-full bg-gradient-to-r from-gray-900 to-gray-700 text-white py-4 px-6 rounded-xl font-semibold hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-3"
                  onClick={() => {
                    // Save checkout meta so /checkout can read full values
                    sessionStorage.setItem(
                      'checkout_meta',
                      JSON.stringify({
                        cod: useCOD,
                        giftWrap,
                        orderNotes,
                        coupon: appliedCoupon,
                        pincode,
                      })
                    );
                  }}
                >
                  <CreditCard className="w-5 h-5" />
                  PROCEED TO CHECKOUT
                </Link>

                {/* Pay Now hook (Razorpay, optional) */}
                {/* <button
                  className="mt-3 w-full border border-gray-300 py-3 rounded-lg hover:bg-gray-50"
                  onClick={initiatePayment}
                >
                  Pay Now (Card/UPI)
                </button> */}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

