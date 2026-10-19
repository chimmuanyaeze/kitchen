"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Bookmark, User, Refrigerator } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Home", path: "/", icon: Home },
    { name: "Explore", path: "/explore", icon: Compass },
    { name: "Pantry", path: "/pantry", icon: Refrigerator },
    { name: "Cook Later", path: "/cook-later", icon: Bookmark },
    { name: "Profile", path: "/profile", icon: User },
  ];

  return (
  // CHANGED: Added extreme z-index layer, forced it to sit strictly at the screen's viewport bottom
  <div className="block md:hidden fixed bottom-0 left-0 right-0 z-[9999] w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)] transition-all duration-200">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.name} 
              href={item.path}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive 
                  ? "text-blue-600 dark:text-blue-500" 
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium whitespace-nowrap">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}