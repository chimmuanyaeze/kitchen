"use client";

import { useEffect, useState, useSyncExternalStore, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  ChefHat,
  Clock,
  Users,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Repeat,
  Volume2,
  Flame,
} from "lucide-react";
import { RecipeWithIngredients } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import SmartSearchBar, { AIGeneratedRecipe } from "@/components/SmartSearchBar";

// Safe subscription helpers for sessionStorage that satisfy both SSR Hydration & React Compiler
const subscribeToStorage = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getClientSnapshot = (): string | null => {
  return sessionStorage.getItem("kitchen_os_ai_recipe");
};

const getServerSnapshot = (): string | null => {
  return null; // Guarantees Server HTML and Initial Client Hydration match 100%
};

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query: string = searchParams.get("q") || "";
  const mode: string | null = searchParams.get("mode");

  const [results, setResults] = useState<RecipeWithIngredients[]>([]);
  const [loading, setLoading] = useState(false);

  // Read sessionStorage safely after hydration without useEffect setState
  const rawStoredRecipe = useSyncExternalStore(
    subscribeToStorage,
    getClientSnapshot,
    getServerSnapshot
  );

  // Allow instant override when clicking "Cook with AI" while already on /search
  const [manualAiRecipe, setManualAiRecipe] = useState<AIGeneratedRecipe | null>(null);

  const aiRecipe: AIGeneratedRecipe | null = (() => {
    if (manualAiRecipe) return manualAiRecipe;
    if (!rawStoredRecipe) return null;
    try {
      return JSON.parse(rawStoredRecipe) as AIGeneratedRecipe;
    } catch {
      return null;
    }
  })();

  const [currentStepPage, setCurrentStepPage] = useState(0);
  const [isSpeakingStep, setIsSpeakingStep] = useState(false);

  // Strict Database-Only Query when not in AI mode
  useEffect(() => {
    if (mode === "ai") return;

    let isMounted = true;

    const fetchDatabaseResults = async () => {
      if (!query.trim()) {
        if (isMounted) {
          setResults([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const { data } = await supabase
        .from("recipes")
        .select("*, recipe_ingredients(ingredients(name))");

      if (!isMounted) return;

      if (data) {
        const searchTerms: string[] = query
          .toLowerCase()
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean);

        const filtered = data.filter((recipe: RecipeWithIngredients) => {
          const titleMatch = searchTerms.some((term: string) =>
            recipe.title.toLowerCase().includes(term)
          );

          const ingredientMatch = recipe.recipe_ingredients?.some((ri) =>
            searchTerms.some((term: string) =>
              ri.ingredients?.name.toLowerCase().includes(term)
            )
          );

          return titleMatch || ingredientMatch;
        });

        setResults(filtered);
      } else {
        setResults([]);
      }

      setLoading(false);
    };

    fetchDatabaseResults();

    return () => {
      isMounted = false;
    };
  }, [query, mode]);

  // Optional Kokoro TTS read-aloud for the active AI step
  const speakStepInstruction = async (text: string) => {
    if (isSpeakingStep) return;
    setIsSpeakingStep(true);
    try {
      const inferenceUrl =
        process.env.NEXT_PUBLIC_INFERENCE_URL || "http://localhost:8000";
      const res = await fetch(`${inferenceUrl}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceGender: "female" }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => setIsSpeakingStep(false);
        await audio.play();
      } else {
        setIsSpeakingStep(false);
      }
    } catch {
      setIsSpeakingStep(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF8F5] dark:bg-[#121110] w-full transition-colors duration-200 pb-24">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#1C1A18] px-6 py-4 flex items-center gap-4 sticky top-0 z-20 border-b border-[#E6E1DA] dark:border-[#2E2B28] w-full transition-colors">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="p-2 bg-[#FAF8F5] dark:bg-[#262320] rounded-full hover:bg-[#F3EFEA] dark:hover:bg-[#302D29] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-[#44403C] dark:text-[#D6D1C7]" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#1C1917] dark:text-[#F5F2EB]">
            {mode === "ai"
              ? "AI-Assisted Cooking Guidance"
              : "Database Search Results"}
          </h1>
          <p className="text-sm text-[#78716C] dark:text-[#A8A29E]">
            {mode === "ai"
              ? "Custom culinary guidance generated from your input"
              : `Showing database matches for "${query}"`}
          </p>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto w-full grow">
        {/* Dual-Mode Smart Search Bar */}
        <SmartSearchBar
          initialQuery={query}
          onAIResult={(recipe: AIGeneratedRecipe) => {
            setManualAiRecipe(recipe);
            setCurrentStepPage(0);
            router.push("/search?mode=ai");
          }}
        />

        {/* =========================================================
            VIEW 2: AI-ASSISTED COOKING GUIDANCE SCREEN
           ========================================================= */}
        {mode === "ai" && aiRecipe ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* a) Dish Name, Description & d) Metadata Badges */}
            <div className="bg-white dark:bg-[#1C1A18] p-6 rounded-3xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#C84B31] dark:text-[#E07A5F] bg-[#F9EBE8] dark:bg-[#3A201A] px-3 py-1 rounded-full mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                AI-Assisted Cooking Guidance
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917] dark:text-[#F5F2EB] mb-2">
                {aiRecipe.dish_name}
              </h2>
              <p className="text-[#44403C] dark:text-[#D6D1C7] text-sm sm:text-base leading-relaxed mb-5">
                {aiRecipe.short_description}
              </p>

              {/* Cooking time, servings, difficulty */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-[#E6E1DA] dark:border-[#2E2B28]">
                <div className="flex items-center gap-2 bg-[#FAF8F5] dark:bg-[#121110] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#44403C] dark:text-[#D6D1C7]">
                  <Clock className="w-4 h-4 text-[#C84B31]" />
                  <span>
                    {aiRecipe.prep_time_mins + aiRecipe.cook_time_mins} mins total (
                    {aiRecipe.prep_time_mins}m prep / {aiRecipe.cook_time_mins}m cook)
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[#FAF8F5] dark:bg-[#121110] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#44403C] dark:text-[#D6D1C7]">
                  <Users className="w-4 h-4 text-[#2D6A4F]" />
                  <span>{aiRecipe.servings} Servings</span>
                </div>
                <div className="flex items-center gap-2 bg-[#FAF8F5] dark:bg-[#121110] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#44403C] dark:text-[#D6D1C7]">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>Difficulty: {aiRecipe.difficulty}</span>
                </div>
              </div>
            </div>

            {/* b) Ingredients List + Missing Items Highlight */}
            <div className="bg-white dark:bg-[#1C1A18] p-6 rounded-3xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm">
              <h3 className="text-lg font-bold text-[#1C1917] dark:text-[#F5F2EB] mb-4">
                Ingredients & Availability Check
              </h3>

              {aiRecipe.missing_from_user.length > 0 && (
                <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                    <span className="font-bold">Missing from your list: </span>
                    {aiRecipe.missing_from_user.join(", ")}
                  </div>
                </div>
              )}

              <ul className="divide-y divide-[#E6E1DA] dark:divide-[#2E2B28]/60">
                {aiRecipe.ingredients.map((ing, idx: number) => (
                  <li
                    key={idx}
                    className="py-3 flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      {ing.is_missing ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                      )}
                      <span className="font-medium text-[#1C1917] dark:text-[#F5F2EB]">
                        {ing.name}
                      </span>
                      {ing.is_missing && (
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          Missing
                        </span>
                      )}
                    </div>
                    <span className="text-[#78716C] dark:text-[#A8A29E] font-medium">
                      {ing.quantity} {ing.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* c) Paginated Step-by-Step Instructions */}
            {aiRecipe.steps.length > 0 && (
              <div className="bg-white dark:bg-[#1C1A18] p-6 rounded-3xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C84B31] dark:text-[#E07A5F]">
                    Step {currentStepPage + 1} of {aiRecipe.steps.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      speakStepInstruction(
                        aiRecipe.steps[currentStepPage].instruction
                      )
                    }
                    disabled={isSpeakingStep}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#F9EBE8] dark:bg-[#3A201A] text-[#C84B31] dark:text-[#E07A5F] hover:bg-[#F9EBE8] transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    {isSpeakingStep ? "Speaking..." : "Read Step Aloud"}
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-[#F3EFEA] dark:bg-[#262320] rounded-full overflow-hidden mb-6">
                  <div
                    className="h-full bg-[#C84B31] transition-all duration-300"
                    style={{
                      width: `${
                        ((currentStepPage + 1) / aiRecipe.steps.length) * 100
                      }%`,
                    }}
                  />
                </div>

                {/* Active Step Card */}
                <div className="min-h-[140px] flex flex-col justify-center mb-6">
                  <h4 className="text-lg sm:text-xl font-bold text-[#1C1917] dark:text-[#F5F2EB] mb-2">
                    {aiRecipe.steps[currentStepPage].title}
                  </h4>
                  <p className="text-[#44403C] dark:text-[#D6D1C7] text-base sm:text-lg leading-relaxed">
                    {aiRecipe.steps[currentStepPage].instruction}
                  </p>
                  {aiRecipe.steps[currentStepPage].tip && (
                    <p className="mt-3 text-xs sm:text-sm text-[#C84B31] dark:text-[#E07A5F] bg-[#F9EBE8]/70 dark:bg-[#3A201A]/40 p-3 rounded-xl">
                      💡 <strong>Chef Tip:</strong>{" "}
                      {aiRecipe.steps[currentStepPage].tip}
                    </p>
                  )}
                </div>

                {/* Step Pagination Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-[#E6E1DA] dark:border-[#2E2B28]">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentStepPage((p: number) => Math.max(0, p - 1))
                    }
                    disabled={currentStepPage === 0}
                    className="px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 bg-[#F3EFEA] dark:bg-[#262320] text-[#44403C] dark:text-[#D6D1C7] disabled:opacity-40 hover:bg-[#E6E1DA] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous Step
                  </button>

                  <div className="flex gap-1.5">
                    {aiRecipe.steps.map((_, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentStepPage(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                          idx === currentStepPage
                            ? "bg-[#C84B31] w-6"
                            : "bg-[#D6D1C7] dark:bg-[#302D29]"
                        }`}
                        aria-label={`Go to step ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentStepPage((p: number) =>
                        Math.min(aiRecipe.steps.length - 1, p + 1)
                      )
                    }
                    disabled={currentStepPage === aiRecipe.steps.length - 1}
                    className="px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 bg-[#C84B31] text-white disabled:opacity-40 hover:bg-[#B03E26] transition-colors"
                  >
                    Next Step
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* e) Tips & Possible Substitutions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Culinary Tips */}
              <div className="bg-white dark:bg-[#1C1A18] p-6 rounded-3xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm">
                <h3 className="text-lg font-bold text-[#1C1917] dark:text-[#F5F2EB] mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Chef Tips
                </h3>
                <ul className="space-y-2.5 text-sm text-[#44403C] dark:text-[#D6D1C7]">
                  {aiRecipe.tips.map((tip: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#C84B31] font-bold">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Substitutions */}
              <div className="bg-white dark:bg-[#1C1A18] p-6 rounded-3xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm">
                <h3 className="text-lg font-bold text-[#1C1917] dark:text-[#F5F2EB] mb-4 flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-[#2D6A4F]" />
                  Possible Substitutions
                </h3>
                <div className="space-y-3 text-sm">
                  {aiRecipe.substitutions.map((sub, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-[#FAF8F5] dark:bg-[#121110] border border-[#E6E1DA] dark:border-[#2E2B28]/60"
                    >
                      <p className="font-bold text-[#1C1917] dark:text-[#F5F2EB]">
                        {sub.original} →{" "}
                        <span className="text-[#2D6A4F] dark:text-[#6FCF97]">
                          {sub.substitute}
                        </span>
                      </p>
                      <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
                        {sub.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
              VIEW 1: NORMAL DATABASE SEARCH RESULTS (NO AI GENERATION)
             ========================================================= */
          <div className="w-full">
            {loading ? (
              <div className="text-center text-[#78716C] dark:text-[#A8A29E] mt-10 animate-pulse mx-auto">
                Searching the Kitchen OS database...
              </div>
            ) : results.length === 0 ? (
              <div className="text-center mt-16 mx-auto w-full max-w-sm bg-white dark:bg-[#1C1A18] p-8 rounded-3xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm">
                <div className="bg-[#F3EFEA] dark:bg-[#262320] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-[#78716C] dark:text-[#A8A29E]">
                  <ChefHat className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-bold text-[#1C1917] dark:text-[#F5F2EB] mb-2">
                  No results found in the database.
                </h2>
                <p className="text-[#78716C] dark:text-[#A8A29E] text-sm">
                  We couldn&apos;t find a matching recipe in our curated vault. Try
                  clicking <strong>Cook with AI</strong> above to generate a custom
                  guide from your ingredients or photo!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-fit">
                {results.map((recipe) => (
                  <Link
                    href={`/recipes/${recipe.id}`}
                    key={recipe.id}
                    className="bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm hover:shadow-md transition-shadow overflow-hidden flex items-center h-28 w-full"
                  >
                    <div className="w-28 h-full bg-[#F3EFEA] dark:bg-[#1C1A18] relative shrink-0">
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
                        <div className="w-full h-full flex items-center justify-center text-[#A8A29E] dark:text-[#78716C]">
                          <ChefHat className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 grow flex flex-col justify-center min-w-0 h-full">
                      <h3 className="text-base font-bold text-[#1C1917] dark:text-[#F5F2EB] truncate mb-1">
                        {recipe.title}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-[#78716C] dark:text-[#A8A29E]">
                        <Clock className="w-3.5 h-3.5 text-[#C84B31]" />
                        <span>
                          {recipe.prep_time_mins + recipe.cook_time_mins} mins
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#121110] flex items-center justify-center text-[#78716C] dark:text-[#A8A29E]">
          Loading...
        </div>
      }
    >
      <SearchResultsContent />
    </Suspense>
  );
}