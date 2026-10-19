"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

 useEffect(() => {
    // Push the initial check to the next browser tick to satisfy React's Strict Mode linter
    setTimeout(() => {
      if (typeof window !== "undefined") {
        setIsOffline(!navigator.onLine);
      }
    }, 0);

    // Set up event listeners
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);
  
  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-3 flex items-center justify-center gap-3 shadow-lg animate-in slide-in-from-top duration-300">
      <WifiOff className="w-5 h-5 animate-pulse" />
      <p className="text-sm font-medium tracking-wide">
        You are offline. Please go online to continue cooking.
      </p>
    </div>
  );
}