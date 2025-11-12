// Frontend/components/Footer.tsx
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Instagram,
  Youtube,
  MessageCircle,
  Mail,
  MapPin,
  Phone,
  Shield,
  Truck,
  CreditCard,
  Facebook,
  ExternalLink,
  Star,
} from "lucide-react";

/* ========= Static data (no re-creation per render) ========= */
const LOCATION = {
  address: "Nazmi Boutique, Kerala, India",
  googleMapsUrl: "https://maps.google.com/?q=Nazmi+Boutique+Kerala+India",
  mapsDirections: "https://maps.google.com/maps/dir//Nazmi+Boutique+Kerala+India",
} as const;

const SOCIAL_LINKS = [
  {
    href: "https://www.instagram.com/nazmiboutique_",
    icon: <Instagram className="w-5 h-5" aria-hidden />,
    label: "Instagram",
  },
  {
    href: "https://youtube.com/@nazmiboutique-vl6id?si=5DG8qLMa_iz3YvaZ",
    icon: <Youtube className="w-5 h-5" aria-hidden />,
    label: "YouTube",
  },
  {
    href: "https://www.facebook.com/share/19oRd6Jgyu/?mibextid=wwXIfr",
    icon: <Facebook className="w-5 h-5" aria-hidden />,
    label: "Facebook",
  },
  {
    href: "https://wa.me/919995947709",
    icon: <MessageCircle className="w-5 h-5" aria-hidden />,
    label: "WhatsApp",
  },
] as const;

const SHOP_LINKS = [
  { href: "/Ethnic-Wears", label: "Ethnic-Wears" },
  { href: "/western", label: "Western Wear" },
  { href: "/sale/under-999", label: "Sale Collection" },
] as const;

const HELP_LINKS = [
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact Us" },
  { href: "/shipping-info", label: "Shipping Info" },
  { href: "/returns-exchange", label: "Returns & Exchanges" },
] as const;

const LEGAL_LINKS = [
  { href: "/privacy-policy", label: "Privacy Policy", small: true },
  { href: "/terms", label: "Terms of Service", small: true },
] as const;

/* ========= UI helpers (lightweight, no client state) ========= */
function SocialLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="bg-gray-800 p-3 rounded-full text-gray-400 hover:text-white hover:bg-[#6D7E5F] transition-colors"
    >
      {icon}
    </a>
  );
}

function FooterLink({
  href,
  label,
  small = false,
}: {
  href: string;
  label: string;
  small?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`text-gray-400 hover:text-white transition-colors ${
          small ? "text-sm" : "text-base"
        }`}
      >
        <span className="relative">
          {label}
          <span className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-0.5 bg-[#6D7E5F] transition-[width]" />
        </span>
      </Link>
    </li>
  );
}

/* ========= Footer (server component) ========= */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#2C2C2C] text-white mt-20">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Trust Badges */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16 border-b border-gray-700 pb-12">
          <div className="flex items-center gap-4">
            <div className="bg-[#6D7E5F] p-3 rounded-full">
              <Truck className="w-6 h-6" aria-hidden />
            </div>
            <div>
              <h4 className="font-semibold text-lg">Free Shipping</h4>
              <p className="text-gray-400 text-sm">On orders over {"\u20B9"}2000</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-[#6D7E5F] p-3 rounded-full">
              <Shield className="w-6 h-6" aria-hidden />
            </div>
            <div>
              <h4 className="font-semibold text-lg">Secure Payment</h4>
              <p className="text-gray-400 text-sm">100% Protected</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-[#6D7E5F] p-3 rounded-full">
              <CreditCard className="w-6 h-6" aria-hidden />
            </div>
            <div>
              <h4 className="font-semibold text-lg">Easy 7-Day Returns</h4>
              <p className="text-gray-400 text-sm">For damaged products with video proof</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-[#6D7E5F] p-3 rounded-full">
              <Star className="w-6 h-6" aria-hidden />
            </div>
            <div>
              <h4 className="font-semibold text-lg">Premium Quality</h4>
              <p className="text-gray-400 text-sm">Handpicked fabrics with expert craftsmanship</p>
            </div>
          </div>

          <div className="flex items-center gap-4 col-span-2 lg:col-span-1">
            <div className="bg-[#6D7E5F] p-3 rounded-full">
              <Phone className="w-6 h-6" aria-hidden />
            </div>
            <div>
              <h4 className="font-semibold text-lg">24/7 Support</h4>
              <p className="text-gray-400 text-sm">We're here to help</p>
            </div>
          </div>
        </div>

        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-6">
            <div>
              <h3 className="text-3xl font-serif font-bold text-white mb-4">NAZMI</h3>
              <p className="text-gray-400 leading-relaxed text-lg">
                “Minimal fashion from Kerala — where tradition meets modern elegance.”
              </p>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-gray-400">
                <MapPin className="w-4 h-4 text-[#6D7E5F] mt-1 flex-shrink-0" aria-hidden />
                <div>
                  <span className="text-sm block mb-1">Kerala, India</span>
                  <div className="flex gap-2 mt-2">
                    <a
                      href={LOCATION.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-[#6D7E5F] text-white px-3 py-1 rounded-full hover:bg-[#5c6e50] transition-colors inline-flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" aria-hidden />
                      View Map
                    </a>
                    <a
                      href={LOCATION.mapsDirections}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-gray-700 text-white px-3 py-1 rounded-full hover:bg-gray-600 transition-colors inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden />
                      Directions
                    </a>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-400">
                <Phone className="w-4 h-4 text-[#6D7E5F]" aria-hidden />
                <span className="text-sm">+91 99959 47709</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400">
                <Mail className="w-4 h-4 text-[#6D7E5F]" aria-hidden />
                <span className="text-sm">nazmiboutique1@gmail.com</span>
              </div>
            </div>

            {/* Social */}
            <div className="flex space-x-3 pt-4">
              {SOCIAL_LINKS.map((s) => (
                <SocialLink key={s.label} href={s.href} icon={s.icon} label={s.label} />
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-semibold text-lg mb-6 text-white uppercase tracking-wider">Shop</h4>
            <ul className="space-y-4">
              {SHOP_LINKS.map((l) => (
                <FooterLink key={l.href} href={l.href} label={l.label} />
              ))}
            </ul>
          </div>

          {/* Help + Visit */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold text-lg mb-6 text-white uppercase tracking-wider">
                  Help
                </h4>
                <ul className="space-y-4">
                  {HELP_LINKS.map((l) => (
                    <FooterLink key={l.href} href={l.href} label={l.label} />
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-lg mb-4 text-white uppercase tracking-wider">
                  Visit Us
                </h4>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="aspect-video bg-gradient-to-br from-[#6D7E5F]/20 to-gray-700 rounded flex items-center justify-center mb-3">
                    <div className="text-center">
                      <MapPin className="w-8 h-8 text-[#6D7E5F] mx-auto mb-2" aria-hidden />
                      <p className="text-white text-sm font-medium">Nazmi Boutique</p>
                      <p className="text-gray-400 text-xs">Kerala, India</p>
                    </div>
                  </div>
                  <a
                    href={LOCATION.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#6D7E5F] text-white py-2 rounded-lg hover:bg-[#5c6e50] transition-colors text-sm font-medium inline-flex items-center justify-center gap-2"
                  >
                    <MapPin className="w-4 h-4" aria-hidden />
                    Open in Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="text-gray-400 text-sm">
              {"\u00A9"} {currentYear} Nazmi Boutique. All rights reserved.
            </div>

            <ul className="flex flex-wrap justify-center gap-6 text-sm">
              {LEGAL_LINKS.map((l) => (
                <FooterLink key={l.href} href={l.href} label={l.label} small={l.small} />
              ))}
            </ul>

            <div className="text-gray-500 text-sm flex items-center gap-2">
              <span>Made with</span>
              <span className="text-red-500" aria-hidden>
                ❤️
              </span>
              <span>in Kerala</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
