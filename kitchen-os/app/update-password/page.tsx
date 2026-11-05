"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; 

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      router.push("/");
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      router.push("/");
    }
    setLoading(false);
  };

  // --- NEW: The Password Reset Request ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage("Please enter your email address first.");
      return;
    }
    
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    // Tells Supabase to send the email and route them back to a new page we are about to make
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF8F5] dark:bg-[#121110] p-6 pb-24 w-full transition-colors duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-[#1C1A18] p-8 rounded-xl shadow-sm border border-[#E6E1DA] dark:border-[#2E2B28] transition-colors duration-200">
        <h1 className="text-2xl font-bold text-[#1C1917] dark:text-[#F5F2EB] text-center mb-6">
          Welcome to Kitchen OS
        </h1>
        
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-transparent dark:border-red-800/50 p-3 rounded-md text-sm mb-4 transition-colors">
            {errorMessage}
          </div>
        )}

        {/* NEW: Success Message UI */}
        {successMessage && (
          <div className="bg-[#EAF4EF] dark:bg-[#192E25] text-[#2D6A4F] dark:text-[#6FCF97] border border-transparent dark:border-[#315B45] p-3 rounded-md text-sm mb-4 transition-colors">
            {successMessage}
          </div>
        )}

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
              
              {/* NEW: Forgot Password Link */}
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
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-[#C84B31] text-white p-2 rounded-md font-medium hover:bg-[#B03E26] disabled:opacity-50 transition-colors"
            >
              {loading ? "Loading..." : "Log In"}
            </button>
            
            <button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full bg-[#F3EFEA] dark:bg-[#262320] text-[#1C1917] dark:text-[#F5F2EB] p-2 rounded-md font-medium hover:bg-[#E6E1DA] dark:hover:bg-[#302D29] disabled:opacity-50 transition-colors"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}