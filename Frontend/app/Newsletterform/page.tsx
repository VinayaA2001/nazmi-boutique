// components/forms/NewsletterForm.tsx
"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Mail } from "lucide-react";

type Variant = "compact" | "card";

interface Props {
  /** Endpoint to POST the email (customize later if needed) */
  action?: string;
  /** Layout style: compact (footer) or card (section) */
  variant?: Variant;
  /** Additional CSS classes for wrapper */
  className?: string;
}

export default function NewsletterForm({
  action = "/api/newsletter",
  variant = "compact",
  className = "",
}: Props) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot for bots
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Handle form submission
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Email validation
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!validEmail) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    // Bot protection: honeypot field check
    if (website) return;

    try {
      setSubmitting(true);
      setStatus("idle");
      setMessage("");

      const res = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Subscription failed. Please try again.");
      }

      setEmail("");
      setStatus("success");
      setMessage("Thanks! Please check your inbox to confirm.");
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- COMPACT VERSION (for footer) ----------
  if (variant === "compact") {
    return (
      <form onSubmit={onSubmit} className={className}>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="newsletter-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400
                         focus:outline-none focus:border-[#6D7E5F] transition-colors text-sm"
              aria-invalid={status === "error"}
              aria-describedby={status !== "idle" ? "newsletter-status" : undefined}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg
                       bg-[#6D7E5F] text-white text-sm font-medium
                       hover:bg-[#5c6e50] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subscribing…
              </>
            ) : (
              "Subscribe"
            )}
          </button>
        </div>

        {/* Honeypot for bots */}
        <div aria-hidden="true" className="hidden">
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {status !== "idle" && (
          <p
            id="newsletter-status"
            role={status === "error" ? "alert" : "status"}
            className={`mt-2 text-xs flex items-center gap-1 ${
              status === "success" ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {status === "success" && <CheckCircle2 className="h-4 w-4" />}
            {message}
          </p>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
          By subscribing, you agree to receive emails from Nazmi Boutique. You can unsubscribe anytime.
        </p>
      </form>
    );
  }

  // ---------- CARD VERSION (for standalone section) ----------
  return (
    <div
      className={`bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-8 shadow-lg ${className}`}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-lg">N</span>
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">
          Join the Nazmi Boutique Family
        </h3>
        <p className="text-gray-600">Get exclusive offers, new drops & style tips.</p>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="bg-white rounded-xl p-6 border border-gray-200">
        <label htmlFor="newsletter-email-card" className="sr-only">
          Email address
        </label>
        <div className="flex gap-2">
          <input
            id="newsletter-email-card"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
            aria-invalid={status === "error"}
            aria-describedby={status !== "idle" ? "newsletter-status-card" : undefined}
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 font-medium min-w-[120px] flex items-center justify-center"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Subscribe"}
          </button>
        </div>

        {/* Honeypot */}
        <div aria-hidden="true" className="hidden">
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {status !== "idle" && (
          <p
            id="newsletter-status-card"
            role={status === "error" ? "alert" : "status"}
            className={`mt-3 text-sm flex items-center gap-1 ${
              status === "success" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {status === "success" && <CheckCircle2 className="h-4 w-4" />}
            {message}
          </p>
        )}

        <p className="mt-3 text-xs text-gray-500">
          🔒 No spam. 1–2 emails/week. Unsubscribe anytime.
        </p>
      </form>
    </div>
  );
}
