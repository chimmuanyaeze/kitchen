"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save, Plus, Trash2, ChefHat, Star } from "lucide-react";

interface StructuredIngredient {
  quantity: string;
  unit: string;
  name: string;
  is_core: boolean;
}

interface JoinedRecipeIngredientRow {
  quantity: number | string | null;
  unit: string | null;
  is_core: boolean | null;
  ingredients: { name: string } | { name: string }[] | null;
}

function CreateOrEditRecipeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRecipeId = searchParams.get("edit");
  const isEditing = Boolean(editRecipeId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(isEditing);

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("4");

  const [ingredients, setIngredients] = useState<StructuredIngredient[]>([
    { quantity: "", unit: "", name: "", is_core: true },
  ]);
  const [steps, setSteps] = useState([""]);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const initPage = async () => {
      // 1. Enforce Admin Security
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error || profile?.role !== "admin") {
        alert("Security Alert: Only Master Chefs can access the Kitchen Vault.");
        router.push("/");
        return;
      }

      // 2. If in Edit Mode, fetch existing Recipe, Ingredients, and Steps
      if (editRecipeId) {
        setIsLoadingRecipe(true);
        try {
          const { data: recipe, error: recErr } = await supabase
            .from("recipes")
            .select("*")
            .eq("id", editRecipeId)
            .single();

          if (recErr) throw recErr;

          if (recipe) {
            setTitle(recipe.title || "");
            setOverview(recipe.overview || "");
            setImageUrl(recipe.image_url || "");
            setPrepTime(String(recipe.prep_time_mins ?? ""));
            setCookTime(String(recipe.cook_time_mins ?? ""));
            setServings(String(recipe.default_servings ?? "4"));
          }

          // Load existing steps
          const { data: stepData } = await supabase
            .from("recipe_steps")
            .select("instruction, step_number")
            .eq("recipe_id", editRecipeId)
            .order("step_number", { ascending: true });

          if (stepData && stepData.length > 0) {
            setSteps(stepData.map((s) => s.instruction));
          }

          // Load existing ingredients joined with ingredient names
          const { data: ingData } = await supabase
            .from("recipe_ingredients")
            .select("quantity, unit, is_core, ingredients(name)")
            .eq("recipe_id", editRecipeId);

          if (ingData && ingData.length > 0) {
            const typedIngData = ingData as unknown as JoinedRecipeIngredientRow[];
            const formattedIngs: StructuredIngredient[] = typedIngData.map(
              (item) => ({
                quantity: String(item.quantity ?? ""),
                unit: item.unit || "",
                name: Array.isArray(item.ingredients)
                  ? item.ingredients[0]?.name || ""
                  : item.ingredients?.name || "",
                is_core: item.is_core ?? true,
              })
            );
            setIngredients(formattedIngs);
          }
        } catch (err) {
          console.error("Failed to load recipe for editing:", err);
          alert("Could not load the recipe details.");
          router.push("/");
        } finally {
          setIsLoadingRecipe(false);
        }
      }
    };

    initPage();
  }, [router, editRecipeId]);

  const updateIngredient = (
    index: number,
    field: keyof StructuredIngredient,
    value: string | boolean
  ) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const ALLOWED_IMAGE_DOMAINS = [
    "encrypted-tbn0.gstatic.com",
    "i.imgur.com",
    "images.unsplash.com",
    "images.pexels.com",
    "cdn.pixabay.com",
    "upload.wikimedia.org",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (imageUrl.trim() !== "") {
      try {
        const parsedUrl = new URL(imageUrl);
        if (!ALLOWED_IMAGE_DOMAINS.includes(parsedUrl.hostname)) {
          setErrorMessage(
            `For security, Kitchen OS only allows images from these sites:\n\n${ALLOWED_IMAGE_DOMAINS.join(
              "\n"
            )}\n\nPlease host your image on one of these platforms or add the new domain to next.config.ts first.`
          );
          setShowErrorModal(true);
          return;
        }
      } catch {
        setErrorMessage(
          "Please enter a valid, complete image URL starting with https://"
        );
        setShowErrorModal(true);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let recipeId = editRecipeId;

      if (isEditing && editRecipeId) {
        // --- UPDATE EXISTING RECIPE ---
        const { error: updateError } = await supabase
          .from("recipes")
          .update({
            title,
            overview,
            image_url: imageUrl,
            prep_time_mins: parseInt(prepTime) || 0,
            cook_time_mins: parseInt(cookTime) || 0,
            default_servings: parseInt(servings) || 2,
          })
          .eq("id", editRecipeId);

        if (updateError) throw updateError;

        // Clear old steps and ingredients before inserting the updated lists
        await supabase
          .from("recipe_steps")
          .delete()
          .eq("recipe_id", editRecipeId);
        await supabase
          .from("recipe_ingredients")
          .delete()
          .eq("recipe_id", editRecipeId);
      } else {
        // --- CREATE NEW RECIPE ---
        const { data: recipeData, error: recipeError } = await supabase
          .from("recipes")
          .insert({
            title,
            overview,
            image_url: imageUrl,
            prep_time_mins: parseInt(prepTime) || 0,
            cook_time_mins: parseInt(cookTime) || 0,
            default_servings: parseInt(servings) || 2,
          })
          .select()
          .single();

        if (recipeError) throw recipeError;
        recipeId = recipeData.id;
      }

      // Insert Steps
      const validSteps = steps.filter((s) => s.trim() !== "");
      if (validSteps.length > 0 && recipeId) {
        const stepsToInsert = validSteps.map((instruction, index) => ({
          recipe_id: recipeId,
          step_number: index + 1,
          instruction,
        }));
        await supabase.from("recipe_steps").insert(stepsToInsert);
      }

      // Insert Ingredients
      const validIngredients = ingredients.filter(
        (i) => i.name.trim() !== ""
      );

      for (const ing of validIngredients) {
        let ingredientId;
        const cleanName = ing.name.trim().toLowerCase();

        const { data: existingIng, error: searchError } = await supabase
          .from("ingredients")
          .select("id")
          .ilike("name", cleanName)
          .maybeSingle();

        if (searchError) throw searchError;

        if (existingIng) {
          ingredientId = existingIng.id;
        } else {
          const { data: newIng, error: ingError } = await supabase
            .from("ingredients")
            .insert({ name: cleanName })
            .select()
            .single();

          if (ingError) throw ingError;
          ingredientId = newIng.id;
        }

        await supabase.from("recipe_ingredients").insert({
          recipe_id: recipeId,
          ingredient_id: ingredientId,
          quantity: parseFloat(ing.quantity) || 0,
          unit: ing.unit.trim().toLowerCase(),
          is_core: ing.is_core,
        });
      }

      // --- KOKORO TTS PREWARM ---
      if (validSteps.length > 0) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        fetch("/api/prewarm", {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({
            phrases: validSteps.map((step) => ({
              text: step,
              voiceGender: "female",
            })),
          }),
        }).catch((err) => console.warn("Background prewarm skipped:", err));
      }

      alert(
        isEditing
          ? "Recipe updated in the Kitchen OS Vault!"
          : "Structured Recipe safely added to the Kitchen OS Vault!"
      );
      router.push("/");
    } catch (error) {
      console.error("Failed to save recipe:", error);
      alert("Error saving recipe. Check the console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingRecipe) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-medium">
        Loading recipe from the Kitchen Vault...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 w-full transition-colors duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors duration-200 w-full">
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Go back"
            title="Go back"
            onClick={() => router.push("/")}
            className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditing ? "Edit Recipe" : "Add New Recipe"}
          </h1>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" />
          {isSubmitting
            ? "Saving..."
            : isEditing
            ? "Update Recipe"
            : "Save Recipe"}
        </button>
      </div>

      <div className="p-6 max-w-3xl mx-auto mt-4 space-y-8 w-full">
        {/* Section 1: Basic Info */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-blue-600" /> Basic Information
          </h2>
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row gap-4 w-full">
              <div className="flex-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Recipe Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="e.g., Authentic Nigerian Jollof"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Default Servings
                </label>
                <input
                  type="number"
                  min="0"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="4"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Short Overview
              </label>
              <textarea
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="A rich, smoky party Jollof that brings the heat..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Image URL
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="https://images.unsplash.com/..."
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Prep Time (mins)
                </label>
                <input
                  type="number"
                  min="0"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="15"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Cook Time (mins)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder="45"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Structured Ingredients */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
            Ingredients (Database Ready)
          </h2>
          <div className="space-y-4">
            <div className="flex gap-2 px-1 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div className="w-20">Qty</div>
              <div className="w-28">Unit</div>
              <div className="flex-1">Pure Ingredient Name</div>
              <div className="w-16 text-center">Core?</div>
              <div className="w-10"></div>
            </div>

            {ingredients.map((ing, index) => (
              <div
                key={index}
                className="flex gap-2 items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors"
              >
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={ing.quantity}
                  onChange={(e) =>
                    updateIngredient(index, "quantity", e.target.value)
                  }
                  className="w-20 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-colors"
                  placeholder="2"
                />
                <input
                  type="text"
                  value={ing.unit}
                  onChange={(e) =>
                    updateIngredient(index, "unit", e.target.value)
                  }
                  className="w-28 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-colors"
                  placeholder="cups"
                />
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) =>
                    updateIngredient(index, "name", e.target.value)
                  }
                  className="flex-1 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-colors"
                  placeholder="long grain rice"
                />

                <button
                  type="button"
                  onClick={() =>
                    updateIngredient(index, "is_core", !ing.is_core)
                  }
                  className={`w-12 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                    ing.is_core
                      ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-500 dark:text-amber-400"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600"
                  }`}
                  title={
                    ing.is_core
                      ? "Core Ingredient (Required)"
                      : "Optional/Garnish"
                  }
                >
                  <Star
                    className={`w-5 h-5 ${ing.is_core ? "fill-current" : ""}`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setIngredients(ingredients.filter((_, i) => i !== index))
                  }
                  className="p-3 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  title="Remove ingredient"
                  aria-label="Remove ingredient"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() =>
                setIngredients([
                  ...ingredients,
                  { quantity: "", unit: "", name: "", is_core: true },
                ])
              }
              className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
        </div>

        {/* Section 3: Instructions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
            Cooking Steps
          </h2>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-1 transition-colors">
                  {index + 1}
                </div>
                <textarea
                  value={step}
                  onChange={(e) => handleStepChange(index, e.target.value)}
                  className="flex-1 p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-28 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  placeholder={`Describe step ${index + 1}...`}
                />
                <button
                  type="button"
                  onClick={() => setSteps(steps.filter((_, i) => i !== index))}
                  className="p-3.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors mt-1"
                  title={`Remove step ${index + 1}`}
                  aria-label={`Remove step ${index + 1}`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setSteps([...steps, ""])}
              className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Step
            </button>
          </div>
        </div>
      </div>

      {/* --- ERROR MODAL --- */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span className="text-red-500">⚠️</span> Invalid Image Source
            </h3>

            <div className="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-line mb-6 leading-relaxed">
              {errorMessage}
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setShowErrorModal(false)}
                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateRecipePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
          Loading Kitchen Vault...
        </div>
      }
    >
      <CreateOrEditRecipeForm />
    </Suspense>
  );
}