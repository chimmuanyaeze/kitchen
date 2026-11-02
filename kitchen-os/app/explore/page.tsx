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
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPageData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setUser(session.user);

        // Check if the logged-in user is an admin
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile) {
          setUserRole(profile.role);
        }
      }

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

  const handleRecipeDeleted = (deletedId: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== deletedId));
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 w-full transition-colors duration-200">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Explore Recipes
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Find your next meal from our database.
      </p>

      {loading ? (
        <SkeletonLoader type="explore" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full items-stretch">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="flex h-full">
              <RecipeCard
                recipe={recipe}
                currentUserId={user?.id}
                isAdmin={userRole === "admin"}
                onDeleteSuccess={handleRecipeDeleted}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}