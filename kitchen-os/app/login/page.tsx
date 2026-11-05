"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // --- NEW: OTP States ---
  const [showOTP, setShowOTP] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const [authSuccess, setAuthSuccess] = useState<"login" | "signup" | null>(null);
  const [loadingText, setLoadingText] = useState("Patience we are cooking...");

  const triggerSuccessSequence = (type: "login" | "signup") => {
    setAuthSuccess(type);
    setTimeout(() => {
      setLoadingText(type === "signup" ? "Welcome Chef" : "Welcome back chef");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    }, 2000);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // --- Frontend Validation Check ---
    if (!email.trim() && !password.trim()) {
      setErrorMessage("Please enter both your email address and a password to create an account.");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("Please enter a password to secure your account.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Your password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    // 1. Capture both 'data' and 'error' from Supabase
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    } else if (data.session) {
      // 2. Email Confirmation is OFF in Supabase:
      // User is immediately logged in, trigger the heartbeat animation!
      triggerSuccessSequence("signup");
    } else {
      // 3. Email Confirmation is ON in Supabase:
      // No session yet, switch the UI to ask for the 6-digit OTP code
      setSuccessMessage("A 6-digit code has been sent to your email.");
      setShowOTP(true);
      setLoading(false);
    }
  };

  // --- Verify the OTP Code ---
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!otpCode.trim() || otpCode.length !== 6) {
      setErrorMessage("Please enter the full 6-digit verification code.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode,
      type: "signup",
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    } else {
      // Success! They are now verified and logged in.
      triggerSuccessSequence("signup");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // --- Frontend Validation Check ---
    if (!email.trim() && !password.trim()) {
      setErrorMessage("Please enter your email address and password to log in.");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        setErrorMessage("Please verify your email address before logging in.");
      } else {
        setErrorMessage(error.message);
      }
      setLoading(false);
    } else {
      triggerSuccessSequence("login");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage("Password reset email sent! Check your inbox.");
    }
    setLoading(false);
  };

  // --- SUCCESS COOKING SCREEN ---
  if (authSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF8F5] dark:bg-[#121110] w-full fixed inset-0 z-50">
        <style>{`
          @keyframes heartbeat {
            0% { transform: scale(1); }
            14% { transform: scale(1.15); }
            28% { transform: scale(1); }
            42% { transform: scale(1.15); }
            70% { transform: scale(1); }
            100% { transform: scale(1); }
          }
          .animate-heartbeat {
            animation: heartbeat 1.5s infinite ease-in-out;
          }
        `}</style>
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <div className="w-32 h-32 relative mb-8 animate-heartbeat drop-shadow-2xl">
            <Image src="/logo.png" alt="Kitchen OS Icon" fill className="object-contain" priority />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#1C1917] dark:text-[#F5F2EB] animate-in slide-in-from-bottom-2 fade-in duration-500">
            {loadingText}
          </h2>
        </div>
      </div>
    );
  }

  // --- STANDARD LOGIN / OTP FORM ---
  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FAF8F5] dark:bg-[#121110] p-6 w-full transition-colors duration-200 overflow-y-auto">
      <div className="w-full max-w-sm bg-white dark:bg-[#1C1A18] p-8 rounded-xl shadow-sm border border-[#E6E1DA] dark:border-[#2E2B28] transition-colors duration-200">
        <h1 className="text-2xl font-bold text-[#1C1917] dark:text-[#F5F2EB] text-center mb-6">
          {showOTP ? "Verify Your Email" : "Welcome to Kitchen OS"}
        </h1>
        
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-transparent dark:border-red-800/50 p-3 rounded-md text-sm mb-4 transition-colors">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="bg-[#EAF4EF] dark:bg-[#192E25] text-[#2D6A4F] dark:text-[#6FCF97] border border-transparent dark:border-[#315B45] p-3 rounded-md text-sm mb-4 transition-colors">
            {successMessage}
          </div>
        )}

        {/* CONDITIONALLY RENDER: OTP Form OR Standard Form */}
        {showOTP ? (
          <form className="flex flex-col gap-4" onSubmit={handleVerifyOTP}>
            <p className="text-sm text-[#44403C] dark:text-[#A8A29E] text-center mb-2">
              Enter the 6-digit code sent to <br/><span className="font-bold text-[#1C1917] dark:text-[#F5F2EB]">{email}</span>
            </p>
            <div>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} // only allow numbers
                className="w-full p-3 text-center text-2xl tracking-[0.5em] font-mono border border-[#D6D1C7] dark:border-[#2E2B28] rounded-md bg-white dark:bg-[#121110] text-[#1C1917] dark:text-[#F5F2EB] focus:outline-none focus:ring-2 focus:ring-[#C84B31] transition-colors"
                placeholder="000000"
                required
              />
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full bg-[#C84B31] text-white p-2 rounded-md font-medium hover:bg-[#B03E26] disabled:opacity-50 transition-colors"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <button
                type="button"
                onClick={() => setShowOTP(false)}
                className="w-full text-sm text-[#78716C] hover:text-[#1C1917] dark:hover:text-white transition-colors mt-2"
              >
                Back to login
              </button>
            </div>
          </form>
        ) : (
          <form className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-[#44403C] dark:text-[#D6D1C7] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border border-[#D6D1C7] dark:border-[#2E2B28] rounded-md bg-white dark:bg-[#121110] text-[#1C1917] dark:text-[#F5F2EB] placeholder:text-[#8C857B] dark:placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#C84B31] transition-colors"
                placeholder="chef@example.com"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-[#44403C] dark:text-[#D6D1C7]">Password</label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs text-[#C84B31] dark:text-[#E07A5F] hover:underline focus:outline-none"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border border-[#D6D1C7] dark:border-[#2E2B28] rounded-md bg-white dark:bg-[#121110] text-[#1C1917] dark:text-[#F5F2EB] placeholder:text-[#8C857B] dark:placeholder:text-[#78716C] focus:outline-none focus:ring-2 focus:ring-[#C84B31] transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-[#C84B31] text-white p-2 rounded-md font-medium hover:bg-[#B03E26] disabled:opacity-50 transition-colors"
              >
                {loading ? "Loading..." : "Log In"}
              </button>
              
              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="w-full bg-[#F3EFEA] dark:bg-[#262320] text-[#1C1917] dark:text-[#F5F2EB] p-2 rounded-md font-medium hover:bg-[#E6E1DA] dark:hover:bg-[#302D29] disabled:opacity-50 transition-colors"
              >
                Create Account
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}