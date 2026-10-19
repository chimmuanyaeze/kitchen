"use client";

interface SkeletonLoaderProps {
  type?: "home" | "recipe" | "create" | "explore";
}

export default function SkeletonLoader({ type = "home" }: SkeletonLoaderProps) {
  // ---------------------------------------------------------
  // 1. RECIPE DETAIL SKELETON
  // ---------------------------------------------------------
  if (type === "recipe") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 w-full transition-colors duration-200">
        {/* Hero Image Shimmer */}
        <div className="w-full aspect-video bg-gray-200 dark:bg-gray-800 animate-pulse md:h-[400px]"></div>
        
        <div className="p-6 max-w-4xl mx-auto space-y-8 -mt-6 relative z-10">
          {/* Title & Metadata Block */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
            <div className="flex gap-3">
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            </div>
            <div className="h-16 w-full bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mt-4"></div>
          </div>

          {/* Ingredients & Steps */}
          <div className="space-y-4">
            <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 w-full bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 2. CREATE RECIPE SKELETON
  // ---------------------------------------------------------
  if (type === "create") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 w-full transition-colors duration-200">
        {/* Sticky Header Shimmer */}
        <div className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
          <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
          <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
        </div>

        <div className="p-6 max-w-3xl mx-auto mt-4 space-y-8 w-full">
          {/* Form Blocks */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-5">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
              <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
              <div className="h-24 w-full bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 3. EXPLORE PAGE SKELETON
  // ---------------------------------------------------------
  if (type === "explore") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 w-full transition-colors duration-200">
        {/* Header Text Shimmer */}
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse mb-3"></div>
        <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse mb-8"></div>

        {/* Grid Shimmer */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {[1, 2, 3, 4, 5, 6].map((card) => (
            <div 
              key={card} 
              className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-700 w-full flex flex-col overflow-hidden shadow-sm"
            >
              <div className="aspect-video w-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
              <div className="p-3.5 sm:p-5 flex flex-col gap-3">
                <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mt-1"></div>
                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // 4. HOME / DASHBOARD SKELETON (Default)
  // ---------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 w-full flex flex-col gap-8 transition-colors duration-200">
      
      {/* Header Shimmer */}
      <div className="flex justify-between items-center w-full">
        <div className="space-y-3">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
        </div>
        <div className="h-10 w-24 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
      </div>

      {/* Search Bar Shimmer */}
      <div className="h-12 w-full bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>

      {/* Content Rows Shimmer (Horizontal scroll layout) */}
      {[1, 2].map((section) => (
        <div key={section} className="space-y-4 w-full">
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse mb-2"></div>
          
          <div className="flex overflow-hidden gap-4 w-full">
            {[1, 2, 3].map((card) => (
              <div 
                key={card} 
                className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-700 w-[70vw] sm:w-[280px] md:w-[320px] lg:w-[340px] shrink-0 flex flex-col overflow-hidden shadow-sm"
              >
                <div className="aspect-video w-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                <div className="p-3.5 sm:p-5 flex flex-col gap-3">
                  <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                  <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mt-1"></div>
                  <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}