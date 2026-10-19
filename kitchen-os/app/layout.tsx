import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import OfflineIndicator from "@/components/OfflineIndicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kitchen OS",
  description: "Your intelligent cooking companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      
      {/* 🚀 FIXED: The body tag is now a clean base shell. It does not compete with page content layout */}
      <body className="h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        
        {/* Drops down globally if the user loses Wi-Fi */}
        <OfflineIndicator />
      
        {/* Desktop Navbar (Hidden on mobile) */}
        <Navbar />

        {/* 🚀 FIXED Master Content Container:
            - md:pt-20 pushes the page down on desktop so it never hides behind the Top Nav.
            - pb-20 pushes the page up on mobile devices so it never hides behind the Bottom Nav. */}
        <div className="min-h-screen flex flex-col pt-0 md:pt-20 pb-20 md:pb-0 w-full">
          <main className="flex-grow w-full">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation (Hidden on desktop) */}
        <BottomNav />

      </body>
    </html>
  );
}