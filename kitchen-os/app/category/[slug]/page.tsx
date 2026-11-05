"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Recipe } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Clock,
  Heart,
  ChefHat,
  Edit3,
  Trash2,
  Flame,
} from "lucide-react";
import SkeletonLoader from "@/components/SkeletonLoader";

const ITEMS_PER_PAGE = 20;

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

const CATEGORY_META: Record<
  string,
  { title: string; description: string }
> = {
  popular: {
    title: "Popular Recipes",
    description: "Top 5 most cooked and liked meals in Kitchen OS.",
  },
  nigerian: {
    title: "Nigerian Dishes",
    description: "Authentic Nigerian staples and local delicacies.",
  },
  african: {
    title: "African Dishes",
    description: "All African dishes, including Nigerian classics.",
  },
  foreign: {
    title: "Foreign Dishes",
    description: "International and continental meals from around the globe.",
  },
};

export default function CategoryListPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug || "nigerian").toLowerCase();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cookCounts, setCookCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCategoryData() {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile) setUserRole(profile.role);
      }

      const { data: recipeData } = await supabase
        .from("recipes")
        .select("*")
        .order("created_at", { ascending: false });

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

      if (recipeData) {
        setRecipes(recipeData);
      }
      setLoading(false);
    }

    fetchCategoryData();
  }, [slug]);

  const filteredRecipes = useMemo(() => {
    if (slug === "popular") {
      return [...recipes]
        .sort((a, b) => {
          const scoreA = (a.likes_count || 0) + (cookCounts[a.id] || 0);
          const scoreB = (b.likes_count || 0) + (cookCounts[b.id] || 0);
          return scoreB - scoreA;
        })
        .slice(0, 5);
    }

    if (slug === "nigerian") {
      return recipes.filter((r) => getRecipeCategory(r) === "nigerian");
    }

    if (slug === "african") {
      return recipes.filter((r) => {
        const cat = getRecipeCategory(r);
        return cat === "nigerian" || cat === "african";
      });
    }

    if (slug === "foreign") {
      return recipes.filter((r) => getRecipeCategory(r) === "foreign");
    }

    return recipes;
  }, [recipes, cookCounts, slug]);

  // Pagination Math (20 items per page)
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecipes.length / ITEMS_PER_PAGE)
  );
  const paginatedRecipes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecipes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecipes, currentPage]);

  const isAdmin = userRole === "admin";

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/create?edit=${id}`);
  };

  const handleDelete = async (e: React.MouseEvent, recipe: Recipe) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${recipe.title}"?`
    );
    if (!confirmed) return;

    setDeletingId(recipe.id);
    try {
      await supabase.from("recipe_steps").delete().eq("recipe_id", recipe.id);
      await supabase
        .from("recipe_ingredients")
        .delete()
        .eq("recipe_id", recipe.id);
      await supabase.from("user_likes").delete().eq("recipe_id", recipe.id);
      await supabase
        .from("cooking_sessions")
        .delete()
        .eq("recipe_id", recipe.id);

      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipe.id);

      if (error) throw error;
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    } catch (err) {
      console.error("Failed to delete recipe:", err);
      alert("Error deleting recipe.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <SkeletonLoader type="explore" />;

  const meta = CATEGORY_META[slug] || {
    title: "Category Recipes",
    description: "Browse meals in this category.",
  };

  return (
    <main className="min-h-screen bg-[#FAF8F5] dark:bg-[#121110] p-6 pb-24 w-full transition-colors duration-200">
      <div className="max-w-4xl mx-auto w-full">
        {/* Top Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="p-2.5 bg-white dark:bg-[#1C1A18] border border-[#E6E1DA] dark:border-[#2E2B28] rounded-full hover:bg-[#F3EFEA] dark:hover:bg-[#262320] transition-colors shadow-sm"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-[#44403C] dark:text-[#F5F2EB]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1C1917] dark:text-[#F5F2EB]">
              {meta.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E]">
              {meta.description} ({filteredRecipes.length}{" "}
              {filteredRecipes.length === 1 ? "meal" : "meals"})
            </p>
          </div>
        </div>

        {/* List View of Meals */}
        {paginatedRecipes.length === 0 ? (
          <div className="bg-white dark:bg-[#1C1A18] rounded-3xl p-10 text-center border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm">
            <ChefHat className="w-12 h-12 mx-auto text-[#78716C] mb-3" />
            <h2 className="text-lg font-bold text-[#1C1917] dark:text-[#F5F2EB] mb-1">
              No meals in this category yet
            </h2>
            <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">
              Check back soon or explore another category.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 w-full">
            {paginatedRecipes.map((recipe, index) => {
              const rankNumber = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
              const timesCooked = cookCounts[recipe.id] || 0;

              return (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  className={`group flex items-center gap-4 bg-white dark:bg-[#1C1A18] p-3 sm:p-4 rounded-2xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm hover:shadow-md transition-all w-full ${
                    deletingId === recipe.id
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }`}
                >
                  {/* Rank Number */}
                  <div className="w-7 text-center font-black text-sm text-[#78716C] dark:text-[#A8A29E] shrink-0">
                    #{rankNumber}
                  </div>

                  {/* Fixed Thumbnail */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#F3EFEA] dark:bg-[#262320] relative shrink-0">
                    {recipe.image_url ? (
                      <Image
                        src={recipe.image_url}
                        alt={recipe.title}
                        fill
                        sizes="96px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#A8A29E] dark:text-[#A8A29E]">
                        <ChefHat className="w-7 h-7" />
                      </div>
                    )}
                  </div>

                  {/* Meal Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-[#1C1917] dark:text-[#F5F2EB] group-hover:text-[#C84B31] dark:group-hover:text-[#E07A5F] transition-colors truncate">
                      {recipe.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E] line-clamp-1 mt-0.5">
                      {recipe.overview ||
                        "A delicious Kitchen OS recipe ready to cook."}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#78716C] dark:text-[#A8A29E] font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#C84B31]" />
                        {recipe.prep_time_mins + recipe.cook_time_mins} mins
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        {recipe.likes_count || 0} likes
                      </span>
                      {timesCooked > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          {timesCooked} cooked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Admin Quick Edit & Delete Buttons */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleEdit(e, recipe.id)}
                        title="Edit Recipe"
                        className="p-2 bg-[#F9EBE8] dark:bg-[#3A201A] text-[#C84B31] dark:text-[#E07A5F] hover:bg-[#B03E26] hover:text-white rounded-xl transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, recipe)}
                        title="Delete Recipe"
                        className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Numbered Pagination Controls: 1 2 3 >> (Only shown when > 20 items) */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {currentPage > 1 && (
              <button
                type="button"
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="px-3 py-2 rounded-xl text-sm font-bold bg-white dark:bg-[#1C1A18] border border-[#E6E1DA] dark:border-[#2E2B28] text-[#44403C] dark:text-[#D6D1C7] hover:bg-[#F3EFEA] dark:hover:bg-[#262320] transition-colors"
              >
                &lt;&lt;
              </button>
            )}

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                  page === currentPage
                    ? "bg-[#C84B31] text-white shadow-sm"
                    : "bg-white dark:bg-[#1C1A18] border border-[#E6E1DA] dark:border-[#2E2B28] text-[#44403C] dark:text-[#D6D1C7] hover:bg-[#F3EFEA] dark:hover:bg-[#262320]"
                }`}
              >
                {page}
              </button>
            ))}

            {currentPage < totalPages && (
              <button
                type="button"
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="px-3 py-2 rounded-xl text-sm font-bold bg-white dark:bg-[#1C1A18] border border-[#E6E1DA] dark:border-[#2E2B28] text-[#44403C] dark:text-[#D6D1C7] hover:bg-[#F3EFEA] dark:hover:bg-[#262320] transition-colors"
              >
                &gt;&gt;
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}