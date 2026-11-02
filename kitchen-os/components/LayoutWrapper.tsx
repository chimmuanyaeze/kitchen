"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  return (
    <>
      {/* Render Top Navbar on both mobile (Logo only) and desktop (Logo + Links) */}
      {!isAuthPage && <Navbar />}

      {/* Added pt-16 on mobile so the fixed top navbar doesn't overlap page content */}
      <div
        className={`min-h-screen flex flex-col w-full ${
          !isAuthPage ? "pt-16 md:pt-20 pb-20 md:pb-0" : ""
        }`}
      >
        <main className="grow w-full">{children}</main>
      </div>

      {/* Render Mobile Bottom Nav */}
      {!isAuthPage && <BottomNav />}
    </>
  );
}