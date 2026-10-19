"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Recipe } from "@/lib/types";
import RecipeCard from "@/components/RecipeCard";
import SkeletonLoader from "@/components/SkeletonLoader";

export default function ExplorePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function fetchPageData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUser(session.user);

      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching recipes:", error.message);
      } else {
        setRecipes(data || []);
      }
      setLoading(false);
    }

    fetchPageData();
  }, []);

  return (
    // Added dark:bg-gray-900, w-full, and transition smoothers
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 w-full transition-colors duration-200">
      {/* Added dark:text-white */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Explore Recipes</h1>
      {/* Added dark:text-gray-400 */}
      <p className="text-gray-600 dark:text-gray-400 mb-6">Find your next meal from our database.</p>

      {loading ? (
    <SkeletonLoader type="explore" />
  ) : (
        // Added w-full
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          
          {recipes.map((recipe) => (
            <RecipeCard 
              key={recipe.id} 
              recipe={recipe} 
              currentUserId={user?.id} 
            />
          ))}
          
        </div>
      )}
    </main>
  );
}