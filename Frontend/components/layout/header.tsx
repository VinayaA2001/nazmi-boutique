"use client";
import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { Heart, ShoppingCart, User, Search, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

declare global {
  interface WindowEventMap {
    "wishlist-updated": CustomEvent;
    "cart-updated": CustomEvent;
  }
}

interface NavItem {
  href: string;
  label: string;
  icon?: string;
  highlight?: boolean;
  featured?: boolean;
}

export default function Header() {
  const [wishlistCount, setWishlistCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { cartItems, getCartItemsCount } = useCart();

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setIsClient(true), []);

  const cartCount = getCartItemsCount();

  const loadCounts = useCallback(() => {
    if (!isClient) return;
    try {
      const wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");
      setWishlistCount(Array.isArray(wishlist) ? wishlist.length : 0);
    } catch (error) {
      console.error("Error loading counts:", error);
    }
  }, [isClient]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    loadCounts();

    const handleStorageUpdate = () => loadCounts();

    window.addEventListener("storage", handleStorageUpdate);
    window.addEventListener("wishlist-updated", handleStorageUpdate as EventListener);
    window.addEventListener("scroll", handleScroll, { passive: true });

    const pollInterval = setInterval(loadCounts, 2000);
    return () => {
      window.removeEventListener("storage", handleStorageUpdate);
      window.removeEventListener("wishlist-updated", handleStorageUpdate as EventListener);
      window.removeEventListener("scroll", handleScroll);
      clearInterval(pollInterval);
    };
  }, [loadCounts, pathname, isClient]);

  /** Close search on outside click or Escape */
  useEffect(() => {
    if (!searchOpen && !accountDropdownOpen) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      const searchEl = searchWrapRef.current;
      const accountEl = accountDropdownRef.current;
      const target = e.target as Node | null;
      
      if (searchOpen && searchEl && target && !searchEl.contains(target)) {
        setSearchOpen(false);
      }
      
      if (accountDropdownOpen && accountEl && target && !accountEl.contains(target)) {
        setAccountDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setAccountDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen, accountDropdownOpen]);

  /** Also close popover on route changes */
  useEffect(() => {
    setSearchOpen(false);
    setAccountDropdownOpen(false);
  }, [pathname]);

  /** Navigate to search page and close popover */
  const goSearch = (term: string) => {
    const q = term.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  /** Form submit uses SPA navigation */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goSearch(searchQuery);
  };

  const isActiveLink = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const closeAllMenus = () => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setAccountDropdownOpen(false);
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    closeAllMenus();
    router.push("/");
  };

  // Toggle account dropdown
  const toggleAccountDropdown = () => {
    setAccountDropdownOpen(!accountDropdownOpen);
    setSearchOpen(false);
  };

  // Navigate to account page
  const goToAccount = () => {
    router.push("/account");
    closeAllMenus();
  };

  const desktopNavItems: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/Ethnic-Wears", label: "Ethnic Wears", featured: true },
    { href: "/western", label: "Western", featured: true },
    { href: "/sale", label: "Sale", highlight: true },
  ];

  const mobileNavItems: NavItem[] = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/Ethnic-Wears", label: "Ethnic Wears", icon: "👘" },
    { href: "/western", label: "Western", icon: "👗" },
    { href: "/sale", label: "Sale", icon: "🔥", highlight: true },
    { href: "/account", label: "My Account", icon: "👤" },
    { href: "/wishlist", label: `Wishlist`, icon: "❤️" },
    { href: "/cart", label: `Shopping Cart`, icon: "🛒" },
  ];

  const quickSearchTerms = [
    "Sharara",
    "Jeans",
    "Churidhars",
    "Co-ords sets",
    "Tops",
    "Salwar sets",
    "Kafftan tops",
  ];

  return (
    <>
      {/* Announcement Bar (hidden) */}
      <div className="hidden bg-gradient-to-r from-gray-900 to-gray-800 text-white text-sm py-3 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" aria-hidden>
          <div className="absolute top-2 left-10">✨</div>
          <div className="absolute top-1 right-20">⭐</div>
          <div className="absolute bottom-1 left-1/4">💫</div>
        </div>
      </div>

      {/* Main Header */}
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          scrolled ? "bg-white/95 backdrop-blur-xl shadow-2xl border-b border-gray-100" : "bg-white border-b border-gray-100"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[var(--header-offset)]">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center group transition-all duration-500 flex-shrink-0"
              onClick={closeAllMenus}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full blur-md opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
                <Image
                  src="/logo.png"
                  alt="Nazmi Boutique - Premium Fashion"
                  width={56}
                  height={56}
                  priority
                  className="relative rounded-full border-2 border-amber-200 shadow-lg transition-all duration-500 group-hover:scale-105 group-hover:border-amber-300 group-hover:shadow-xl"
                />
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full opacity-0 group-hover:opacity-20 blur transition-opacity duration-500" />
              </div>
              <div className="ml-4">
                <span className="text-2xl font-serif font-bold text-gray-900 tracking-wider block leading-tight">
                  NAZMI
                </span>
                <span className="text-xs text-amber-700 font-medium tracking-widest uppercase bg-amber-50 px-2 py-1 rounded-full">
                  Luxury Boutique
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {desktopNavItems.map(({ href, label, highlight, featured }) => (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-6 py-2 transition-all duration-300 font-medium text-[15px] group ${
                    isActiveLink(href)
                      ? highlight
                        ? "text-red-600 font-semibold"
                        : featured
                        ? "text-amber-700 font-semibold"
                        : "text-gray-900 font-semibold"
                      : highlight
                      ? "text-red-500 hover:text-red-700"
                      : featured
                      ? "text-amber-600 hover:text-amber-800"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span className="relative z-10">{label}</span>
                  <div
                    className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 h-0.5 transition-all duration-300 ${
                      isActiveLink(href)
                        ? highlight
                          ? "w-4/5 bg-red-600"
                          : featured
                          ? "w-4/5 bg-amber-600"
                          : "w-4/5 bg-gray-900"
                        : highlight
                        ? "bg-red-500 group-hover:w-4/5 w-0"
                        : featured
                        ? "bg-amber-500 group-hover:w-4/5 w-0"
                        : "bg-gray-600 group-hover:w-4/5 w-0"
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-50/50 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {featured && (
                    <div className="absolute -top-1 -right-1">
                      <div className="relative">
                        <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-75" />
                        <div className="relative w-2 h-2 bg-amber-500 rounded-full" />
                      </div>
                    </div>
                  )}
                  {highlight && (
                    <div className="absolute -top-2 -right-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-gradient-to-br from-red-500 to-red-600 border border-white shadow-lg" />
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </nav>

            {/* Action Icons */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Search (with outside click close) */}
              <div className="relative" ref={searchWrapRef}>
                <button
                  onClick={() => setSearchOpen((v) => !v)}
                  className="relative p-3 text-gray-600 hover:text-amber-600 transition-all duration-300 group rounded-2xl hover:bg-amber-50"
                  aria-label="Search products"
                >
                  <Search className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-amber-500/10 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-300" />
                </button>

                {searchOpen && (
                  <div className="fixed top-20 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 w-auto sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 animate-in slide-in-from-top-5 duration-300 z-50">
                    <form onSubmit={handleSearch} className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search traditional wear, western outfits..."
                          className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50 text-gray-900 placeholder-gray-500 transition-all duration-300"
                          autoFocus
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white py-4 rounded-xl font-semibold hover:from-amber-700 hover:to-amber-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        Search Fashion Collection
                      </button>
                    </form>

                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wider">
                        Trending Searches:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {quickSearchTerms.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => goSearch(term)}
                            className="text-sm bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:from-amber-50 hover:to-amber-100 hover:text-amber-700 transition-all duration-300 border border-gray-200 hover:border-amber-200"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Account - FIXED: Click goes to account page, hover shows dropdown */}
              <div className="relative" ref={accountDropdownRef}>
                <button
                  onClick={goToAccount} // CHANGED: Now goes directly to account page
                  onMouseEnter={() => setAccountDropdownOpen(true)} // ADDED: Show dropdown on hover
                  onMouseLeave={() => setAccountDropdownOpen(false)} // ADDED: Hide dropdown on mouse leave
                  className="relative p-3 text-gray-600 hover:text-amber-600 transition-all duration-300 rounded-2xl hover:bg-amber-50 hidden sm:block"
                  aria-label="My account"
                >
                  <User className="w-5 h-5 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-amber-500/10 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-300" />
                </button>
                
                {/* Account dropdown - Shows on hover */}
                {accountDropdownOpen && (
                  <div 
                    className="absolute top-14 right-0 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50"
                    onMouseEnter={() => setAccountDropdownOpen(true)} // ADDED: Keep dropdown open when hovering over it
                    onMouseLeave={() => setAccountDropdownOpen(false)} // ADDED: Close dropdown when mouse leaves
                  >
                    {isAuthenticated ? (
                      <>
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
                          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                        <Link
                          href="/account"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                          onClick={closeAllMenus}
                        >
                          My Account
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                          onClick={closeAllMenus}
                        >
                          Sign In
                        </Link>
                        <Link
                          href="/register"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                          onClick={closeAllMenus}
                        >
                          Create Account
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Wishlist */}
              <Link
                href="/wishlist"
                className="relative p-3 text-gray-600 hover:text-red-500 transition-all duration-300 group rounded-2xl hover:bg-red-50"
                onClick={closeAllMenus}
                aria-label={`Wishlist with ${wishlistCount} items`}
              >
                <Heart
                  className={`w-5 h-5 transition-all duration-300 group-hover:scale-110 ${
                    wishlistCount > 0 ? "fill-red-500 text-red-500 animate-pulse" : ""
                  }`}
                />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs bg-gradient-to-br from-red-500 to-red-600 text-white w-5 h-5 flex items-center justify-center rounded-full font-semibold border-2 border-white shadow-lg">
                    {wishlistCount > 99 ? "99+" : wishlistCount}
                  </span>
                )}
                <div className="absolute inset-0 bg-red-500/10 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-300" />
              </Link>

              {/* Cart */}
              <Link
                href="/cart"
                className="relative p-3 text-gray-600 hover:text-amber-600 transition-all duration-300 group rounded-2xl hover:bg-amber-50"
                onClick={closeAllMenus}
                aria-label={`Shopping cart with ${cartCount} items`}
              >
                <ShoppingCart className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs bg-gradient-to-br from-amber-500 to-amber-600 text-white w-5 h-5 flex items-center justify-center rounded-full font-semibold border-2 border-white shadow-lg animate-bounce">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
                <div className="absolute inset-0 bg-amber-500/10 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-300" />
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => {
                  setMobileMenuOpen((v) => !v);
                  setSearchOpen(false);
                  setAccountDropdownOpen(false);
                }}
                className="lg:hidden relative p-3 text-gray-600 hover:text-amber-600 transition-all duration-300 rounded-2xl hover:bg-amber-50 group"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                <div className="w-6 h-6 flex flex-col justify-center items-center gap-1">
                  <div className={`w-6 h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                  <div className={`w-6 h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                  <div className={`w-6 h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
                </div>
                <div className="absolute inset-0 bg-amber-500/10 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-300" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed top-[var(--header-offset)] left-0 right-0 bottom-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-2xl animate-in slide-in-from-top duration-300 z-40 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-2">
              {mobileNavItems.map(({ href, label, icon, highlight }) => (
                <Link
                  key={href + label}
                  href={href}
                  className={`flex items-center py-4 px-6 text-lg font-medium transition-all duration-300 rounded-2xl group ${
                    isActiveLink(href)
                      ? highlight
                        ? "bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-l-4 border-red-500 shadow-sm"
                        : "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-l-4 border-amber-500 shadow-sm font-semibold"
                      : highlight
                      ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                      : "text-gray-600 hover:bg-gradient-to-r hover:from-amber-50 hover:to-amber-100 hover:text-amber-700"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="text-2xl mr-4 transition-transform duration-300 group-hover:scale-110">
                    {icon}
                  </span>
                  <span className="flex-1">{label}</span>
                  {isClient && label === "Wishlist" && wishlistCount > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                      {wishlistCount}
                    </span>
                  )}
                  {isClient && label === "Shopping Cart" && cartCount > 0 && (
                    <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                      {cartCount}
                    </span>
                  )}
                  {highlight && (
                    <span className="ml-2 px-2 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full font-semibold animate-pulse">
                      SALE
                    </span>
                  )}
                </Link>
              ))}
              
              {/* Auth section in mobile menu */}
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center py-4 px-6 text-lg text-red-600 hover:bg-red-50 transition-colors rounded-2xl text-left"
                >
                  <span className="text-2xl mr-4">🚪</span>
                  <span>Sign Out</span>
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex items-center py-4 px-6 text-lg text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors rounded-2xl"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-2xl mr-4">🔑</span>
                    <span>Sign In</span>
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center py-4 px-6 text-lg text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors rounded-2xl"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="text-2xl mr-4">👤</span>
                    <span>Create Account</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Soft Glow Divider under header */}
      <div className="fixed left-0 right-0 top-[var(--header-offset)] z-40 h-[3px] bg-black/40 shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none" />

      {/* Spacer for fixed header */}
      <div className="h-[var(--header-offset)]" />
    </>
  );
}