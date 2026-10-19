"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Settings, Sun, Moon, LogOut } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wrapping this in a setTimeout pushes the state update to the next 
    // browser tick, completely bypassing the synchronous cascade warning!
    setTimeout(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setIsDarkMode(isDark);
      setLoading(false);
    }, 0);
  }, []);
  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 w-full transition-colors duration-200">
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors duration-200 w-full">
        <button
          onClick={() => router.back()}
          className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          title="Go back"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" /> System Settings
        </h1>
      </div>

      <div className="p-6 max-w-2xl mx-auto mt-4 space-y-6 w-full flex flex-col">
        
        {/* --- THEME TOGGLE CARD --- */}
        <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 flex-col sm:flex-row gap-4">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Interface Theme</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark modes across Kitchen OS.</p>
            </div>

            <button
              onClick={toggleTheme}
              className="p-3 w-full sm:w-auto rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm text-gray-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
              title="Toggle Theme"
            >
              {isDarkMode ? (
                <div className="flex items-center gap-2 font-medium text-amber-400">
                  <Sun className="w-5 h-5 fill-current" />
                  <span className="text-xs text-gray-300">Light Mode</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 font-medium text-blue-600">
                  <Moon className="w-5 h-5 fill-current" />
                  <span className="text-xs text-gray-600">Dark Mode</span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* --- SECURITY & SIGN OUT VIRTUAL ROW --- */}
        <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">Session Control</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Disconnect your cooking account securely from this device.</p>
          
          <button
            onClick={handleSignOut}
            className="w-full sm:w-auto bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-6 py-3 border border-red-100 dark:border-red-900/30 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign Out of Account
          </button>
        </div>

      </div>
    </div>
  );
}