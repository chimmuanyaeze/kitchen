"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ChefHat, Clock } from "lucide-react";
import { RecipeWithIngredients } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<RecipeWithIngredients[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      
      if (!query) {
        setResults([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("recipes")
        .select("*, recipe_ingredients(ingredients(name))");

      if (data) {
        const searchTerms = query.toLowerCase().split(",").map(t => t.trim());
        
        const filtered = data.filter((recipe: RecipeWithIngredients) => {
          const titleMatch = recipe.title.toLowerCase().includes(searchTerms[0]);
          
          const ingredientMatch = recipe.recipe_ingredients?.some((ri) => 
            searchTerms.some(term => ri.ingredients?.name.toLowerCase().includes(term))
          );

          return titleMatch || ingredientMatch;
        });

        setResults(filtered);
      }
      
      setLoading(false);
    };

    fetchResults();
  }, [query]);

  return (
    // Added dark:bg-gray-900, w-full, and transition smoothers
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 w-full transition-colors duration-200 pb-24">
      {/* Top Header */}
      {/* Added dark:bg-gray-800, dark:border-gray-700 */}
      <div className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700 w-full transition-colors">
        {/* Added dark:bg-gray-700, dark:hover:bg-gray-600 */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          aria-label="Go back"
        >
          {/* Added dark:text-gray-300 */}
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <div>
          {/* Added dark:text-white */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Search Results</h1>
          {/* Added dark:text-gray-400 */}
          <p className="text-sm text-gray-500 dark:text-gray-400">Showing results for &quot;{query}&quot;</p>
        </div>
      </div>

      {/* Results Feed */}
      <div className="p-6 grow flex w-full">
        {loading ? (
          // Added dark:text-gray-400
          <div className="text-center text-gray-500 dark:text-gray-400 mt-10 animate-pulse mx-auto">Searching the pantry...</div>
        ) : results.length === 0 ? (
          <div className="text-center mt-20 mx-auto w-full max-w-sm">
            {/* Added dark:bg-gray-800, dark:text-gray-600 */}
            <div className="bg-gray-100 dark:bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-600 transition-colors">
              <ChefHat className="w-10 h-10" />
            </div>
            {/* Added dark:text-white */}
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No recipes found</h2>
            {/* Added dark:text-gray-400 */}
            <p className="text-gray-500 dark:text-gray-400 text-sm">Try searching for different ingredients like &quot;eggs&quot; or &quot;rice&quot;.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-fit">
            {results.map((recipe) => (
              <Link 
                href={`/recipes/${recipe.id}`}
                key={recipe.id} 
                // Added dark:bg-gray-800, dark:border-gray-700
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex items-center h-28 w-full"
              >
                {/* Added dark:bg-slate-800 */}
                <div className="w-28 h-full bg-slate-100 dark:bg-slate-800 relative shrink-0 transition-colors">
                  {recipe.image_url ? (
                    <Image 
                      src={recipe.image_url} 
                      alt={recipe.title}
                      fill
                      sizes="112px"
                      priority
                      className="object-cover"
                    />
                  ) : (
                    // Added dark:text-slate-600
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                      <ChefHat className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-4 grow flex flex-col justify-center min-w-0 h-full">
                  {/* Added dark:text-white */}
                  <h3 className="text-md font-bold text-gray-900 dark:text-white truncate mb-1">{recipe.title}</h3>
                  {/* Added dark:text-gray-400 */}
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span>{recipe.prep_time_mins + recipe.cook_time_mins} mins</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    // Added dark:bg-gray-900, dark:text-gray-400
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors">Loading...</div>}>
      <SearchResults />
    </Suspense>
  );
}