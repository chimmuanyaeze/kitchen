"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Recipe } from "@/lib/types";
import { ArrowLeft, ChefHat, Clock, Trash2, Bookmark } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import SkeletonLoader from "@/components/SkeletonLoader";

interface SavedRecipeItem {
  id: string; 
  recipes: Recipe; 
}

export default function CookLaterPage() {
  const router = useRouter();
  const [savedItems, setSavedItems] = useState<SavedRecipeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSavedRecipes = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("saved_recipes")
        .select(`
          id,
          recipes (*)
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching saved recipes:", error);
      } else if (data) {
        setSavedItems(data as unknown as SavedRecipeItem[]);
      }
      
      setLoading(false);
    };

    fetchSavedRecipes();
  }, [router]);
  

  const handleRemoveBookmark = async (e: React.MouseEvent, bookmarkId: string) => {
    e.preventDefault(); 
    setSavedItems((prev) => prev.filter((item) => item.id !== bookmarkId));
    await supabase.from("saved_recipes").delete().eq("id", bookmarkId);
  };

  return (
    // Added dark:bg-[#121110] and w-full
    <div className="flex flex-col min-h-screen bg-[#FAF8F5] dark:bg-[#121110] pb-24 w-full transition-colors duration-200">
      
      {/* Top Header */}
      {/* Added dark:bg-[#1C1A18] and dark:border-[#2E2B28] */}
      <div className="bg-white dark:bg-[#1C1A18] px-6 py-4 flex items-center gap-4 sticky top-0 z-10 border-b border-[#E6E1DA] dark:border-[#2E2B28] transition-colors duration-200 w-full">
        <button 
          onClick={() => router.push("/")}
          // Added dark:bg-[#262320] and dark:hover:bg-[#302D29]
          className="p-2 bg-[#FAF8F5] dark:bg-[#262320] rounded-full hover:bg-[#F3EFEA] dark:hover:bg-[#302D29] transition-colors"
          aria-label="Go back"
          title="Go back"
        >
          {/* Added dark:text-[#D6D1C7] */}
          <ArrowLeft className="w-5 h-5 text-[#44403C] dark:text-[#D6D1C7]" />
        </button>
        <div>
          {/* Added dark:text-[#F5F2EB] */}
          <h1 className="text-xl font-bold text-[#1C1917] dark:text-[#F5F2EB]">Cook Later</h1>
          {/* Added dark:text-[#A8A29E] */}
          <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">Your personal recipe vault</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 grow flex w-full">
        {loading ? (
              <SkeletonLoader />
            ) : savedItems.length === 0 ? (
          <div className="text-center mt-24 mx-auto w-full max-w-sm">
            <div className="bg-[#F9EBE8] dark:bg-[#3A201A] w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-[#C84B31] dark:text-[#F29C85] shadow-inner">
              <Bookmark className="w-10 h-10 text-[#C84B31] dark:text-[#E07A5F]" />
            </div>
            {/* Added dark:text-[#F5F2EB] */}
            <h2 className="text-xl font-bold text-[#1C1917] dark:text-[#F5F2EB] mb-2">Your vault is empty</h2>
            {/* Added dark:text-[#A8A29E] */}
            <p className="text-[#78716C] dark:text-[#A8A29E] text-sm mb-8 px-4 leading-relaxed">
              When you find a recipe you want to try, tap the bookmark icon to save it here for later.
            </p>
            <button 
              onClick={() => router.push("/explore")}
              className="bg-[#C84B31] text-white px-8 py-3 rounded-xl font-medium hover:bg-[#B03E26] transition-colors shadow-md"
            >
              Explore Recipes
            </button>
          </div>
        ) : (
          // Added w-full
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {savedItems.map((item) => (
              <Link 
                href={`/recipes/${item.recipes.id}`}
                key={item.id} 
                // Added dark:bg-[#1C1A18] and dark:border-[#2E2B28]
                className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm hover:shadow-md transition-all overflow-hidden flex items-center h-28 group w-full"
              >
                {/* Recipe Image */}
                {/* Added dark:bg-[#1C1A18] */}
                <div className="w-28 h-full bg-[#F3EFEA] dark:bg-[#1C1A18] relative shrink-0">
                  {item.recipes.image_url ? (
                    <Image 
                      src={item.recipes.image_url} 
                      alt={item.recipes.title}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  ) : (
                    // Added dark:text-[#78716C]
                    <div className="w-full h-full flex items-center justify-center text-[#A8A29E] dark:text-[#78716C]">
                      <ChefHat className="w-8 h-8" />
                    </div>
                  )}
                </div>
                
                {/* Recipe Info */}
                <div className="p-4 grow flex flex-col min-w-0 justify-between h-full">
                  <div className="min-w-0 pr-4">
                    {/* Added dark:text-[#F5F2EB] */}
                    <h3 className="text-md font-bold text-[#1C1917] dark:text-[#F5F2EB] truncate mb-1">{item.recipes.title}</h3>
                    {/* Added dark:text-[#A8A29E] */}
                    <div className="flex items-center gap-1 text-sm text-[#78716C] dark:text-[#A8A29E]">
                      <Clock className="w-3 h-3 text-[#C84B31]" />
                      <span>{item.recipes.prep_time_mins + item.recipes.cook_time_mins} mins</span>
                    </div>
                  </div>
                  
                  {/* Quick Delete Button */}
                  {/* Added dark:text-[#A8A29E], dark:hover:text-red-400, and dark:hover:bg-red-950/30 */}
                  <button 
                    onClick={(e) => handleRemoveBookmark(e, item.id)}
                    className="p-2 text-[#D6D1C7] dark:text-[#A8A29E] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors opacity-100 md:opacity-0 group-hover:opacity-100 shrink-0 self-end"
                    title="Remove from Cook Later"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}