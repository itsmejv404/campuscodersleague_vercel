"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, ArrowRight, KeyRound, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // If session is already active, direct to dashboard
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  // Handle countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send verification code.");
      } else {
        setMessage(data.message || "A 6-digit code has been sent to your email.");
        setStep("otp");
        setResendCooldown(60); // 60s cooldown
      }
    } catch {
      setError("Network error. Please verify your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("email-otp", {
        email: email.trim().toLowerCase(),
        code: cleanCode,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        router.replace("/dashboard");
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch {
      setError("Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm text-gray-500">
            {status === "authenticated" ? "Redirecting to dashboard..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/ccl_logo.jpeg"
              alt="Campus Coders League"
              width={96}
              height={96}
              className="w-24 h-24 object-cover rounded-full shadow-md border-2 border-indigo-100"
              priority
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Campus Coders League
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in with your organization email to create teams and vote.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs p-6 sm:p-8">
          {/* Status Banners */}
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start text-xs sm:text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mr-2.5 mt-0.5 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-5 p-3.5 rounded-lg bg-green-50 border border-green-200 flex items-start text-xs sm:text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 flex-shrink-0 text-green-500" />
              <span>{message}</span>
            </div>
          )}

          {step === "email" ? (
            /* Step 1: Email Form */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5"
                >
                  Organization Email
                </label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="student@kiot.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  Passwordless authentication. We will email you a secure 6-digit OTP.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <>
                    Send One-Time Code
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Step 2: OTP Verification Form */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="otp"
                    className="block text-xs font-semibold uppercase tracking-wider text-gray-700"
                  >
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError(null);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    Change Email
                  </button>
                </div>

                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                    className="block w-full pl-9 pr-3 py-2.5 tracking-widest text-center text-lg font-semibold border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Sent to: <strong className="text-gray-700">{email}</strong></span>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || loading}
                    onClick={() => handleSendOtp()}
                    className="text-indigo-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  "Verify & Sign In"
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center text-center space-y-1 text-xs text-gray-400">
            <span>Restricted to verified organization participants.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
