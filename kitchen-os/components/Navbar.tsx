"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Compass, Bookmark, User } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Explore", path: "/explore", icon: Compass },
    // { name: "Pantry", path: "/pantry", icon: Refrigerator },
    { name: "Cook Later", path: "/cook-later", icon: Bookmark },
    { name: "Profile", path: "/profile", icon: User },
  ];

  return (
    <nav className="block fixed top-0 left-0 right-0 w-full bg-white dark:bg-[#121110] border-b border-[#E6E1DA] dark:border-[#2E2B28] px-6 py-3.5 md:py-4 z-[100] shadow-sm transition-colors duration-200">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        {/* Logo + Brand Name (Visible on ALL screen sizes, including mobile) */}
        <Link
          href="/"
          className="flex items-center gap-2 font-black text-lg md:text-xl text-[#1C1917] dark:text-[#F5F2EB]"
        >
          <Image
            src="/logo.png"
            alt="Kitchen OS Logo"
            width={24}
            height={24}
            className="object-contain"
            priority
          />
          <span>Kitchen OS</span>
        </Link>

        {/* Navigation Tabs (Hidden on mobile/small screens, visible on md+ desktops) */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center gap-1.5 font-medium transition-colors ${
                  isActive
                    ? "text-[#C84B31] dark:text-[#E07A5F]"
                    : "text-[#44403C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}