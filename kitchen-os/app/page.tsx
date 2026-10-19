"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Search, Play, Trash2, ChefHat} from "lucide-react"; 
import { Recipe, ActiveSessionWithRecipe } from "@/lib/types";
import Link from "next/link";
import RecipeCard from "@/components/RecipeCard";
import SkeletonLoader from "@/components/SkeletonLoader";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionWithRecipe[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile) {
        setUserRole(profile.role);
      }

      const { data: sessionData } = await supabase
        .from("cooking_sessions")
        .select("*, recipes(title, prep_time_mins, cook_time_mins)")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .order("current_step", { ascending: false });

      const { data: recipeData } = await supabase
        .from("recipes")
        .select("*")
        .order("likes_count", { ascending: false }) 
        .limit(10);

      if (sessionData) setActiveSessions(sessionData as unknown as ActiveSessionWithRecipe[]);
      if (recipeData) setRecipes(recipeData);
      
      setLoading(false);
    };
    
    fetchDashboardData();
  }, [router]);

 

  const handleRemoveSession = async (sessionId: string) => {
    await supabase.from("cooking_sessions").update({ status: "abandoned" }).eq("id", sessionId);
    setActiveSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (loading) return <SkeletonLoader />;

  return (
    // Added dark:bg-gray-900, w-full, and transition classes
    <main className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 overflow-x-hidden w-full transition-colors duration-200">
      
     {/* Header Section */}
      <div className="flex justify-between items-center mb-6 w-full">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hello, Chef 👋</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 👑 MASTER CHEF SECRET ENTRY (Only renders if user is an admin) */}
          {userRole === "admin" && (
            <Link 
              href="/create" 
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-sm"
              title="Open Master Kitchen Vault"
            >
              <ChefHat className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

        </div>
      </div>

      {/* Ingredient Search Bar */}
      <form onSubmit={handleSearch} className="relative mb-8 w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {/* Added dark:text-gray-400 */}
          <Search className="h-5 w-5 text-gray-700 dark:text-gray-400" />
        </div>
        {/* Added dark:bg-gray-800, dark:border-gray-700, dark:text-white, dark:placeholder-gray-500 */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-colors duration-200"
          placeholder="What's in your kitchen? (e.g., eggs, rice)"
        />
        <button type="submit" className="hidden">Search</button>
      </form>

      {/* Continue Cooking */}
      {activeSessions.length > 0 && (
        <div className="mb-8 w-full">
          {/* Added dark:text-white */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Continue Cooking</h2>
          <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
            {activeSessions.map((activeSession) => (
              <div 
                key={activeSession.id} 
                className="relative w-[70vw] sm:w-[280px] md:w-[320px] lg:w-[340px] shrink-0 bg-gray-900 dark:bg-gray-800 border border-transparent dark:border-gray-700 text-white p-4 sm:p-5 rounded-2xl shadow-md snap-start flex flex-col justify-between transition-all duration-200"
              >
                <button 
                  onClick={() => handleRemoveSession(activeSession.id)}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 p-1.5 bg-gray-800 dark:bg-gray-700 rounded-full hover:bg-red-500 dark:hover:bg-red-600 transition-colors text-gray-400 hover:text-white"
                  title="Remove Session"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                <div className="mb-4 sm:mb-6 pr-8">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-400 mb-1 block">
                    Step {activeSession.current_step}
                  </span>
                  {/* line-clamp-2 prevents long titles from stretching the card vertically */}
                  <h3 className="text-base sm:text-lg font-bold leading-tight line-clamp-2">
                    {activeSession.recipes.title}
                  </h3>
                </div>

                <Link 
                  href={`/cook/${activeSession.id}`}
                  className="w-full bg-blue-600 text-white py-2 sm:py-2.5 rounded-xl text-sm sm:text-base font-medium flex items-center justify-center gap-2 hover:bg-blue-500 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Resume
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/*Popular Recipes */}
      <div className="mb-8 w-full">
        {/* Added dark:text-white */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Popular Recipes</h2>
        <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="w-[70vw] sm:w-[280px] md:w-[320px] lg:w-[340px] shrink-0 snap-start transition-all duration-200">
              <RecipeCard recipe={recipe} currentUserId={user?.id} />
            </div>
          ))}
        </div>
      </div>

      {/*  African Dishes */}
      <div className="mb-8 w-full">
        {/* Added dark:text-white */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">African Dishes</h2>
        <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
          {recipes.map((recipe) => (
            <div key={`african-${recipe.id}`} className="w-[70vw] sm:w-[280px] md:w-[320px] lg:w-[340px] shrink-0 snap-start transition-all duration-200">
              <RecipeCard recipe={recipe} currentUserId={user?.id} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}