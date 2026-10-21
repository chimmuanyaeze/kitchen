"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  return (
    <>
      {/* Conditionally render Desktop Navbar */}
      {!isAuthPage && <Navbar />}

      {/* Conditionally apply the navbar spacing paddings */}
      <div 
        className={`min-h-screen flex flex-col w-full ${
          !isAuthPage ? "pt-0 md:pt-20 pb-20 md:pb-0" : ""
        }`}
      >
        <main className="grow w-full">
          {children}
        </main>
      </div>

      {/* Conditionally render Mobile Bottom Nav */}
      {!isAuthPage && <BottomNav />}
    </>
  );
}