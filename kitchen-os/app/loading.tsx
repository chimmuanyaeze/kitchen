export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 w-full flex flex-col gap-8 transition-colors duration-200">
      
      {/* Header Shimmer */}
      <div className="flex justify-between items-center w-full">
        <div className="space-y-3">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Search Bar Shimmer */}
      <div className="h-14 w-full bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>

      {/* Content Grid Shimmer */}
      <div className="space-y-4 w-full">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 h-72 w-full flex flex-col overflow-hidden shadow-sm">
              <div className="h-44 w-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
              <div className="p-5 flex flex-col gap-3">
                <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}