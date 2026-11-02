"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Play, Trash2, ChefHat, ChevronRight } from "lucide-react";
import { Recipe, ActiveSessionWithRecipe } from "@/lib/types";
import Link from "next/link";
import RecipeCard from "@/components/RecipeCard";
import SkeletonLoader from "@/components/SkeletonLoader";
import SmartSearchBar from "@/components/SmartSearchBar";

function getChefNickname(email?: string | null): string {
  if (!email) return "";
  const localPart = email.split("@")[0];
  const firstSegment =
    localPart.split(/[._\-0-9]+/).filter(Boolean)[0] || localPart;
  const lettersOnly = firstSegment.replace(/[^a-zA-Z]/g, "");
  if (!lettersOnly) return "";
  const shortName =
    lettersOnly.length > 7 ? lettersOnly.slice(0, 5) : lettersOnly;
  return shortName.charAt(0).toUpperCase() + shortName.slice(1).toLowerCase();
}

// Helper: Normalize category (defaults existing recipes to 'nigerian')
function getRecipeCategory(recipe: Recipe): "nigerian" | "african" | "foreign" {
  const raw = (recipe.category || "nigerian").toLowerCase().trim();
  if (raw === "foreign" || raw === "international" || raw === "continental") {
    return "foreign";
  }
  if (raw === "african") {
    return "african";
  }
  return "nigerian";
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeSessions, setActiveSessions] = useState<
    ActiveSessionWithRecipe[]
  >([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cookCounts, setCookCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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

      // 1. Fetch current user's active cooking sessions
      const { data: sessionData } = await supabase
        .from("cooking_sessions")
        .select("*, recipes(title, prep_time_mins, cook_time_mins)")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .order("current_step", { ascending: false });

      // 2. Fetch all recipes so we can properly categorize & rank them
      const { data: recipeData } = await supabase
        .from("recipes")
        .select("*")
        .order("created_at", { ascending: false });

      // 3. Fetch cooking session recipe_ids to count how many times each meal was cooked
      const { data: allCookedSessions } = await supabase
        .from("cooking_sessions")
        .select("recipe_id");

      if (allCookedSessions) {
        const counts: Record<string, number> = {};
        allCookedSessions.forEach((row: { recipe_id: string | null }) => {
          if (row.recipe_id) {
            counts[row.recipe_id] = (counts[row.recipe_id] || 0) + 1;
          }
        });
        setCookCounts(counts);
      }

      if (sessionData) {
        setActiveSessions(sessionData as unknown as ActiveSessionWithRecipe[]);
      }
      if (recipeData) {
        setRecipes(recipeData);
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, [router]);

  const handleRemoveSession = async (sessionId: string) => {
    await supabase
      .from("cooking_sessions")
      .update({ status: "abandoned" })
      .eq("id", sessionId);
    setActiveSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleRecipeDeleted = (deletedId: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== deletedId));
    setActiveSessions((prev) =>
      prev.filter((s) => s.recipe_id !== deletedId)
    );
  };

  // --- Categorize & Rank Recipes ---
  const { popularRecipes, nigerianRecipes, africanRecipes, foreignRecipes } =
    useMemo(() => {
      // Popular = Top 5 Most Cooked + Liked meals
      const sortedByPopularity = [...recipes]
        .sort((a, b) => {
          const scoreA = (a.likes_count || 0) + (cookCounts[a.id] || 0);
          const scoreB = (b.likes_count || 0) + (cookCounts[b.id] || 0);
          return scoreB - scoreA;
        })
        .slice(0, 5);

      // Nigerian = category is 'nigerian'
      const nigerian = recipes.filter(
        (r) => getRecipeCategory(r) === "nigerian"
      );

      // African = all Nigerian dishes + any other African dishes
      const african = recipes.filter((r) => {
        const cat = getRecipeCategory(r);
        return cat === "nigerian" || cat === "african";
      });

      // Foreign = category is 'foreign'
      const foreign = recipes.filter(
        (r) => getRecipeCategory(r) === "foreign"
      );

      return {
        popularRecipes: sortedByPopularity,
        nigerianRecipes: nigerian,
        africanRecipes: african,
        foreignRecipes: foreign,
      };
    }, [recipes, cookCounts]);

  if (loading) return <SkeletonLoader />;

  const chefNickname = getChefNickname(user?.email);

  // Dynamic category sections (any category with 0 recipes is automatically filtered out!)
  const categorySections = [
    {
      slug: "popular",
      title: "Popular Recipes",
      subtitle: "Top 5 most cooked & liked dishes",
      items: popularRecipes,
    },
    {
      slug: "nigerian",
      title: "Nigerian Dishes",
      subtitle: "Authentic local classics",
      items: nigerianRecipes,
    },
    {
      slug: "african",
      title: "African Dishes",
      subtitle: "Continental favorites including Nigerian staples",
      items: africanRecipes,
    },
    {
      slug: "foreign",
      title: "Foreign Dishes",
      subtitle: "Global & intercontinental cuisine",
      items: foreignRecipes,
    },
  ].filter((section) => section.items.length > 0);

  return (
    <main className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 overflow-x-hidden w-full transition-colors duration-200">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6 w-full">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hello, Chef{chefNickname ? ` ${chefNickname}` : ""} 👋
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            What are we cooking today?
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Smart Dual-Mode Search Bar */}
      <SmartSearchBar />

      {/* Continue Cooking */}
      {activeSessions.length > 0 && (
        <div className="mb-8 w-full">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Continue Cooking
          </h2>
          <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
            {activeSessions.map((activeSession) => (
              <div
                key={activeSession.id}
                className="relative w-[260px] sm:w-[280px] md:w-[320px] lg:w-[340px] shrink-0 bg-gray-900 dark:bg-gray-800 border border-transparent dark:border-gray-700 text-white p-4 sm:p-5 rounded-2xl shadow-md snap-start flex flex-col justify-between transition-all duration-200"
              >
                <button
                  type="button"
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
                  <h3 className="text-base sm:text-lg font-bold leading-tight line-clamp-2">
                    {activeSession.recipes?.title}
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

      {/* Render Only Non-Empty Categories */}
      {categorySections.map((section) => (
        <div key={section.slug} className="mb-8 w-full">
          {/* Clickable Category Header -> Opens Paginated Category Page */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href={`/category/${section.slug}`}
              className="group flex flex-col"
            >
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {section.title}
                </h2>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {section.subtitle}
              </span>
            </Link>

            <Link
              href={`/category/${section.slug}`}
              className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0"
            >
              View All ({section.items.length})
            </Link>
          </div>

          <div className="flex items-stretch overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
            {section.items.slice(0, 10).map((recipe) => (
              <div
                key={`${section.slug}-${recipe.id}`}
                className="w-[260px] sm:w-[280px] md:w-[320px] lg:w-[340px] shrink-0 snap-start flex transition-all duration-200"
              >
                <RecipeCard
                  recipe={recipe}
                  currentUserId={user?.id}
                  isAdmin={userRole === "admin"}
                  onDeleteSuccess={handleRecipeDeleted}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}