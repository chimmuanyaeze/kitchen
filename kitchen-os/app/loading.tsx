export default function Loading() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#121110] p-6 pb-24 w-full flex flex-col gap-8 transition-colors duration-200">
      
      {/* Header Shimmer */}
      <div className="flex justify-between items-center w-full">
        <div className="space-y-3">
          <div className="h-8 w-48 bg-[#E6E1DA] dark:bg-[#1C1A18] rounded-xl animate-pulse"></div>
          <div className="h-4 w-32 bg-[#E6E1DA] dark:bg-[#1C1A18] rounded-xl animate-pulse"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-10 bg-[#E6E1DA] dark:bg-[#1C1A18] rounded-full animate-pulse"></div>
          <div className="h-10 w-10 bg-[#E6E1DA] dark:bg-[#1C1A18] rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Search Bar Shimmer */}
      <div className="h-14 w-full bg-[#E6E1DA] dark:bg-[#1C1A18] rounded-xl animate-pulse"></div>

      {/* Content Grid Shimmer */}
      <div className="space-y-4 w-full">
        <div className="h-6 w-40 bg-[#E6E1DA] dark:bg-[#1C1A18] rounded-xl animate-pulse mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1C1A18] rounded-3xl border border-[#E6E1DA] dark:border-[#2E2B28] h-72 w-full flex flex-col overflow-hidden shadow-sm">
              <div className="h-44 w-full bg-[#E6E1DA] dark:bg-[#262320] animate-pulse"></div>
              <div className="p-5 flex flex-col gap-3">
                <div className="h-6 w-3/4 bg-[#E6E1DA] dark:bg-[#262320] rounded-lg animate-pulse"></div>
                <div className="h-4 w-1/2 bg-[#E6E1DA] dark:bg-[#262320] rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}