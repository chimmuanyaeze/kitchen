"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, Compass, Refrigerator, Bookmark, User } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Explore", path: "/explore", icon: Compass },
    { name: "Pantry", path: "/pantry", icon: Refrigerator },
    { name: "Cook Later", path: "/cook-later", icon: Bookmark },
    { name: "Profile", path: "/profile", icon: User },
  ];

  return (
    // Added 'w-full' and boosted to z-[100]
    <nav className="hidden md:block fixed top-0 left-0 right-0 w-full bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 z-[100] shadow-sm transition-colors duration-200">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-black text-xl text-gray-900 dark:text-white">
          <ChefHat className="w-6 h-6 text-blue-600 dark:text-blue-500" />
          <span>Kitchen OS</span>
        </Link>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;

            return (
              <Link 
                key={item.name}
                href={item.path} 
                className={`flex items-center gap-1.5 font-medium transition-colors ${
                  isActive 
                    ? "text-blue-600 dark:text-blue-500" 
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
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