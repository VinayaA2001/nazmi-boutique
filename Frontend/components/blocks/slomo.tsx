// components/blocks/slomo.tsx - FIXED VERSION
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SLIDES = [
  { 
    id: 1, 
    src: "/images/poster1.png",
    alt: "Summer Collection"
  },
  { 
    id: 2, 
    src: "/images/poster2.png",
    alt: "New Arrivals"
  },
  { 
    id: 3, 
    src: "/images/poster3.png", 
    alt: "Special Offers"
  },
];

export default function Slomo() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-full">
      {SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            className="object-cover object-center"
            priority={index === 0}
            sizes="100vw"
            quality={85}
          />
        </div>
      ))}
    </div>
  );
}