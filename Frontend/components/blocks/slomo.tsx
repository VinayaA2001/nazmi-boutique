// components/blocks/slomo.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

type Slide = { id: number; src: string; alt: string };

const SLIDES: Slide[] = [
  { id: 1, src: "/images/poster1.png", alt: "Summer Collection" },
  { id: 2, src: "/images/poster2.png", alt: "New Arrivals" },
  { id: 3, src: "/images/poster3.png", alt: "Special Offers" },
];

export default function Slomo({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {SLIDES.map((slide, i) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={i === 0}
            sizes="100vw"
            quality={85}
            className="object-cover object-center"
          />
        </div>
      ))}
    </div>
  );
}
