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
    // Added dark:bg-gray-900 and w-full
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 w-full transition-colors duration-200">
      
      {/* Top Header */}
      {/* Added dark:bg-gray-800 and dark:border-gray-700 */}
      <div className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200 w-full">
        <button 
          onClick={() => router.push("/")}
          // Added dark:bg-gray-700 and dark:hover:bg-gray-600
          className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          aria-label="Go back"
          title="Go back"
        >
          {/* Added dark:text-gray-300 */}
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <div>
          {/* Added dark:text-white */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cook Later</h1>
          {/* Added dark:text-gray-400 */}
          <p className="text-sm text-gray-500 dark:text-gray-400">Your personal recipe vault</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 grow flex w-full">
        {loading ? (
              <SkeletonLoader />
            ) : savedItems.length === 0 ? (
          <div className="text-center mt-24 mx-auto w-full max-w-sm">
            {/* Added dark:bg-blue-900/20 and dark:text-blue-500/40 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-200 shadow-inner">
              {/* Added dark:text-blue-500 */}
              <Bookmark className="w-10 h-10 text-blue-400 dark:text-blue-500" />
            </div>
            {/* Added dark:text-white */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Your vault is empty</h2>
            {/* Added dark:text-gray-400 */}
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 px-4 leading-relaxed">
              When you find a recipe you want to try, tap the bookmark icon to save it here for later.
            </p>
            <button 
              onClick={() => router.push("/explore")}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-md"
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
                // Added dark:bg-gray-800 and dark:border-gray-700
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all overflow-hidden flex items-center h-28 group w-full"
              >
                {/* Recipe Image */}
                {/* Added dark:bg-slate-800 */}
                <div className="w-28 h-full bg-slate-100 dark:bg-slate-800 relative shrink-0">
                  {item.recipes.image_url ? (
                    <Image 
                      src={item.recipes.image_url} 
                      alt={item.recipes.title}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  ) : (
                    // Added dark:text-slate-600
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                      <ChefHat className="w-8 h-8" />
                    </div>
                  )}
                </div>
                
                {/* Recipe Info */}
                <div className="p-4 grow flex flex-col min-w-0 justify-between h-full">
                  <div className="min-w-0 pr-4">
                    {/* Added dark:text-white */}
                    <h3 className="text-md font-bold text-gray-900 dark:text-white truncate mb-1">{item.recipes.title}</h3>
                    {/* Added dark:text-gray-400 */}
                    <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span>{item.recipes.prep_time_mins + item.recipes.cook_time_mins} mins</span>
                    </div>
                  </div>
                  
                  {/* Quick Delete Button */}
                  {/* Added dark:text-gray-500, dark:hover:text-red-400, and dark:hover:bg-red-950/30 */}
                  <button 
                    onClick={(e) => handleRemoveBookmark(e, item.id)}
                    className="p-2 text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors opacity-100 md:opacity-0 group-hover:opacity-100 shrink-0 self-end"
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