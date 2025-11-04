// C:\NAZMI_BOUTIQUE\Frontend\app\layout.tsx

import "./globals.css";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import WhatsAppButton from "@/components/layout/whatsAppButton";
import type { Metadata, Viewport } from "next";
import { Poppins, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import Script from "next/script";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext"; 

/* ---- GOOGLE FONTS ---- */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
  preload: true,
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-playfair",
  preload: true,
});

/* ---- VIEWPORT CONFIG ---- */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
  colorScheme: "light",
};

/* ---- ENHANCED SEO METADATA ---- */
export const metadata: Metadata = {
  title: {
    default: "Nazmi Boutique Koduvally Kozhikode | Premium Traditional & Western Wear",
    template: "%s | Nazmi Boutique Koduvally Kozhikode",
  },
  description:
    "Nazmi Boutique in Koduvally, Kozhikode — Kerala's premium women's fashion destination offering elegant traditional wear, western collections, smart TV prizes on purchases above ₹2000, and free delivery within 3 km radius. Explore ethnic kurtis, dresses, and festive wear crafted with perfection.",
  keywords: [
    "Nazmi Boutique",
    "Nazmi Boutique Koduvally",
    "Nazmi Boutique Kozhikode",
    "Nazmi Boutique Calicut",
    "Kerala Boutique",
    "Women's Clothing",
    "Ethnic Wear",
    "Traditional Wear",
    "Western Wear",
    "Sarees",
    "Kurtis",
    "Dresses",
    "Officewear",
    "Smart TV Offer",
    "Free Delivery within 3km",
    "Buy Above 2000 Win Prizes",
    "Kerala Fashion Store",
    "Nazmi Boutique Near Me",
    "Koduvally Boutique",
    "Koduvally Women's Fashion",
  ],
  authors: [{ name: "Nazmi Boutique Koduvally Kozhikode" }],
  creator: "Nazmi Boutique",
  publisher: "Nazmi Boutique",
  metadataBase: new URL("https://nazmiboutique.com"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Nazmi Boutique Koduvally Kozhikode | Elegant Traditional & Western Fashion",
    description:
      "Nazmi Boutique, the best women's fashion store in Koduvally, Kozhikode — discover elegant ethnic and western wear with offers above ₹2000 including Smart TV prizes and free delivery around 3 km.",
    url: "https://nazmiboutique.com",
    siteName: "Nazmi Boutique Koduvally Kozhikode",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Nazmi Boutique Koduvally Kozhikode - Premium Fashion Collection",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nazmi Boutique Koduvally Kozhikode | Premium Fashion Offers",
    description:
      "Shop stylish ethnic & western wear in Koduvally, Kozhikode — get Smart TV prizes on ₹2000+ purchases & enjoy free delivery within 3 km.",
    images: ["/og-image.jpg"],
    creator: "@nazmiboutique",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

/* ---- ROOT LAYOUT ---- */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${poppins.variable} ${playfair.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Enhanced Structured Data for Local E-commerce */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ClothingStore",
              name: "Nazmi Boutique Koduvally Kozhikode",
              description:
                "Nazmi Boutique — premium women's clothing store in Koduvally, Kozhikode offering traditional & western wear, Smart TV prizes above ₹2000 purchase, and free delivery around 3 km.",
              url: "https://nazmiboutique.com",
              telephone: "+91-99959-47709",
              email: "nazmiboutique1@gmail.com",
              address: {
                "@type": "PostalAddress",
                streetAddress: "Koduvally, Kozhikode, Kerala",
                addressLocality: "Koduvally",
                addressRegion: "Kerala",
                postalCode: "673572",
                addressCountry: "IN",
              },
              openingHours: "Mo-Su 09:00-21:00",
              priceRange: "₹799 - ₹10000",
              currenciesAccepted: "INR",
              areaServed: {
                "@type": "Place",
                name: "Koduvally Kozhikode",
              },
              hasOfferCatalog: {
                "@type": "OfferCatalog",
                name: "Nazmi Boutique Purchase Offers",
                itemListElement: [
                  {
                    "@type": "Offer",
                    name: "Above ₹2000 Purchase Lucky Draw",
                    description: "Win Smart TV and three prize categories for purchases above ₹2000.",
                    availability: "https://schema.org/InStock",
                    priceCurrency: "INR",
                  },
                  {
                    "@type": "Offer",
                    name: "Free Delivery within 3 km",
                    description: "Complimentary delivery for all nearby customers within 3 km radius.",
                  },
                ],
              },
              sameAs: [
                "https://www.instagram.com/nazmiboutique/",
                "https://www.facebook.com/nazmiboutique/",
                "https://maps.google.com/?q=Nazmi+Boutique+Koduvally+Kozhikode",
              ],
            }),
          }}
        />

        {/* Razorpay checkout.js */}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      </head>

      <body className="min-h-screen flex flex-col bg-white text-gray-900 font-sans antialiased">
        <AuthProvider>
          <CartProvider>
            <Header />
            <main className="flex-1 w-full">{children}</main>
            <Footer />
            <WhatsAppButton
              phone="+919995947709"
              preset="Hello Nazmi Boutique! I'm interested in your collections and offers"
            />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}