"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://nazmi-boutique-2.onrender.com";

type BackendStatus = "checking" | "online" | "offline";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    (async () => {
      await checkBackendStatus();
      await validateToken();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
      setBackendStatus(response.ok ? "online" : "offline");
    } catch {
      setBackendStatus("offline");
    }
  };

  const validateToken = async () => {
    if (!token) {
      setErrors({ token: "Invalid reset link. Please request a new password reset." });
      return;
    }
    // If backend is offline, skip strict validation (demo mode)
    if (backendStatus === "offline") return;

    try {
      const response = await fetch(`/api/auth/validate-reset-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      // Treat 404 as "endpoint not implemented" — allow user to proceed
      if (!response.ok && response.status !== 404) {
        setErrors({
          token: "Invalid or expired reset token. Please request a new password reset link.",
        });
      }
    } catch (error) {
      // Don’t block user if validation endpoint isn’t reachable; allow demo flow
      console.error("Token validation error:", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (errors.general) setErrors((prev) => ({ ...prev, general: "" }));
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password))
      newErrors.password = "Password must include uppercase, lowercase, and numbers";

    if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (!token) newErrors.token = "Reset token is missing";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBackendReset = async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: formData.password,
        }),
      });

      if (response.ok) return true;

      const errorData = await response.json().catch(() => ({}));
      setErrors({
        general: errorData.message || "Failed to reset password",
      });
      return false;
    } catch (error) {
      console.error("Backend password reset failed:", error);
      setErrors({ general: "Connection error. Please try again." });
      return false;
    }
  };

  const handleDemoReset = (): boolean => {
    setMessage("🎉 Password reset successfully! Redirecting to login...");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    setMessage("");

    try {
      let resetSuccess = false;

      if (backendStatus === "online") {
        resetSuccess = await handleBackendReset();
      }

      // Only use demo when backend is truly offline
      if (!resetSuccess && backendStatus === "offline") {
        resetSuccess = handleDemoReset();
      }

      if (resetSuccess) {
        setTimeout(() => {
          router.push("/auth/login");
        }, 1500);
      }
    } catch {
      setErrors({ general: "An unexpected error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    if (!formData.password) return { strength: 0, text: "", color: "" };

    let strength = 0;
    if (formData.password.length >= 8) strength++;
    if (/[a-z]/.test(formData.password)) strength++;
    if (/[A-Z]/.test(formData.password)) strength++;
    if (/\d/.test(formData.password)) strength++;
    if (/[^A-Za-z0-9]/.test(formData.password)) strength++;

    const strengthMap: Record<number, { text: string; color: string }> = {
      0: { text: "Very Weak", color: "bg-red-500" },
      1: { text: "Weak", color: "bg-red-400" },
      2: { text: "Fair", color: "bg-yellow-500" },
      3: { text: "Good", color: "bg-yellow-400" },
      4: { text: "Strong", color: "bg-green-500" },
      5: { text: "Very Strong", color: "bg-green-600" },
    };

    return { strength, ...strengthMap[Math.min(strength, 5)] };
  };

  const strength = passwordStrength();

  if (errors.token) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-600 to-orange-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <span className="text-white font-bold text-2xl">N</span>
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h1>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <p className="text-gray-600 mb-2">{errors.token}</p>

            <div className="mt-6 space-y-3">
              <Link
                href="/auth/forgotpassword"
                className="w-full bg-amber-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-amber-700 transition-colors block"
              >
                Request New Reset Link
              </Link>
              <Link
                href="/auth/login"
                className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors block"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-amber-600 to-orange-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <span className="text-white font-bold text-2xl">N</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create New Password</h1>
          <p className="text-gray-600 text-sm">Enter your new password below.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          {/* Backend Status */}
          {backendStatus !== "checking" && (
            <div
              className={`mb-6 p-3 rounded-lg text-center text-sm ${
                backendStatus === "online"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-yellow-50 text-yellow-700 border border-yellow-200"
              }`}
            >
              {backendStatus === "online" ? "✅ Backend Connected" : "🔄 Using Demo Mode"}
            </div>
          )}

          {/* Success */}
          {message && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-700 text-sm">{message}</p>
            </div>
          )}

          {/* General error */}
          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 text-sm">{errors.general}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors ${
                    errors.password ? "border-red-300 bg-red-50" : "border-gray-300 hover:border-gray-400"
                  }`}
                  placeholder="Enter your new password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword((s) => !s)}
                >
                  <svg
                    className={`w-5 h-5 ${errors.password ? "text-red-400" : "text-gray-400"} hover:text-gray-600`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {showPassword ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    )}
                  </svg>
                </button>
              </div>

              {/* Strength */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">Password strength</span>
                    <span className="text-xs font-medium text-gray-700">{strength.text}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${(strength.strength / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password}</p>}
            </div>

            {/* Confirm */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors ${
                    errors.confirmPassword ? "border-red-300 bg-red-50" : "border-gray-300 hover:border-gray-400"
                  }`}
                  placeholder="Confirm your new password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                >
                  <svg
                    className={`w-5 h-5 ${errors.confirmPassword ? "text-red-400" : "text-gray-400"} hover:text-gray-600`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {showConfirmPassword ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    )}
                  </svg>
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-amber-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Resetting Password...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  Reset Password
                </>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Remember your password?{" "}
              <Link
                href="/auth/login"
                className="font-semibold text-amber-600 hover:text-amber-700 transition-colors underline"
              >
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Security Badges */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-center">
          <div className="text-xs text-gray-600 p-3 bg-white rounded-lg border border-gray-200">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            Secure Reset
          </div>
          <div className="text-xs text-gray-600 p-3 bg-white rounded-lg border border-gray-200">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            Encrypted
          </div>
        </div>
      </div>
    </section>
  );
}
