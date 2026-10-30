"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Clock,
  Users,
  ArrowLeft,
  Heart,
  BookmarkPlus,
  Play,
  Star,
  ChefHat,
  Sparkles,
  CheckCircle2,
  Scale,
  Utensils,
  Info,
  Loader2,
} from "lucide-react";
import { RecipeDetail, RecipeStep, Review } from "@/lib/types";
import SkeletonLoader from "@/components/SkeletonLoader";
import Image from "next/image";

type ScalingCategory =
  | "structural"
  | "spice_75"
  | "thickener_70"
  | "fat_surface";

interface ScaledIngredientResult {
  scaledQty: number;
  formattedQty: string;
  category: ScalingCategory;
  badgeText: string;
}

// --- Helper: Format scaled numbers cleanly (e.g., 3.5 instead of 3.5000002) ---
function formatQuantity(val: number): string {
  if (!val || isNaN(val)) return "0";
  if (val >= 10) return String(Math.round(val * 2) / 2); // Snap large numbers to 0.5
  const rounded = Math.round(val * 4) / 4; // Snap smaller numbers to nearest 0.25
  if (Number.isInteger(rounded)) return String(rounded);
  return String(Number(rounded.toFixed(2)));
}

// --- 1. Classify Ingredient into one of the 4 Culinary Science Tracks ---
function classifyIngredientCategory(name: string): ScalingCategory {
  const n = name.toLowerCase().trim();

  // Track 4: Frying / Greasing Fats (Surface-bound)
  if (
    n.includes("oil") ||
    n.includes("butter") ||
    n.includes("margarine") ||
    n.includes("ghee") ||
    n.includes("lard") ||
    n.includes("shortening")
  ) {
    return "fat_surface";
  }

  // Track 3: Leavening & Thickeners (60%-80% scale)
  if (
    n.includes("baking powder") ||
    n.includes("baking soda") ||
    n.includes("bicarbonate") ||
    n.includes("yeast") ||
    n.includes("cornstarch") ||
    n.includes("corn flour") ||
    n.includes("gelatin") ||
    n.includes("xanthan")
  ) {
    return "thickener_70";
  }

  // Track 2: Spices, Seasonings, Hot Peppers & Concentrates (75% Rule)
  if (
    n.includes("salt") ||
    n.includes("pepper") ||
    n.includes("scotch bonnet") ||
    n.includes("ata rodo") ||
    n.includes("chili") ||
    n.includes("cayenne") ||
    n.includes("maggi") ||
    n.includes("knorr") ||
    n.includes("seasoning") ||
    n.includes("bouillon") ||
    n.includes("stock cube") ||
    n.includes("curry") ||
    n.includes("thyme") ||
    n.includes("cumin") ||
    n.includes("nutmeg") ||
    n.includes("garlic") ||
    n.includes("ginger") ||
    n.includes("spice") ||
    n.includes("bay leaf") ||
    n.includes("bay leaves") ||
    n.includes("tomato paste") ||
    n.includes("purée") ||
    n.includes("puree") ||
    n.includes("crayfish") ||
    n.includes("iru") ||
    n.includes("ogiri")
  ) {
    return "spice_75";
  }

  // Track 1: Structural Base (100% Linear)
  return "structural";
}

// --- 2. Non-Linear Culinary Science Calculation Engine ---
function calculateScientificQuantity(
  baseQty: number,
  sf: number,
  ingredientName: string,
  isSelectedMainItem: boolean
): ScaledIngredientResult {
  if (!baseQty || sf === 1) {
    return {
      scaledQty: baseQty,
      formattedQty: formatQuantity(baseQty),
      category: "structural",
      badgeText: "Base recipe amount",
    };
  }

  // The user's chosen main anchor item always matches what they typed
  if (isSelectedMainItem) {
    const val = baseQty * sf;
    return {
      scaledQty: val,
      formattedQty: formatQuantity(val),
      category: "structural",
      badgeText: "100% Linear (Main Base)",
    };
  }

  const category = classifyIngredientCategory(ingredientName);

  // If scaling DOWN (sf < 1), keep things proportional so small batches still work
  if (sf < 1) {
    const downVal = baseQty * sf;
    return {
      scaledQty: downVal,
      formattedQty: formatQuantity(downVal),
      category,
      badgeText: "Scaled down proportionally",
    };
  }

  switch (category) {
    case "spice_75": {
      // 75% Rule: Safe Starting Spice Amount = (Original * SF) * 0.75
      // For huge batches (e.g., SF > 5 like 100 cups of rice), dampen further so it never ruins the pot
      const effectiveSF = sf <= 5 ? sf * 0.75 : (5 * 0.75) + Math.pow(sf - 5, 0.65) * 0.75;
      const val = Math.max(baseQty, baseQty * effectiveSF);
      return {
        scaledQty: val,
        formattedQty: formatQuantity(val),
        category: "spice_75",
        badgeText: "75% Spice Rule (Taste & Adjust)",
      };
    }

    case "thickener_70": {
      // Diminishing 70% scale: (Original * SF) * 0.70
      const val = Math.max(baseQty, baseQty * sf * 0.7);
      return {
        scaledQty: val,
        formattedQty: formatQuantity(val),
        category: "thickener_70",
        badgeText: "70% Thickener/Leavening Rule",
      };
    }

    case "fat_surface": {
      // Surface-Area Bound: Pan surface grows by Area (~SF^0.65), not Volume (SF^1)
      const surfaceFactor = sf <= 3 ? 1 + (sf - 1) * 0.6 : Math.pow(sf, 0.65);
      const val = Math.max(baseQty, baseQty * surfaceFactor);
      return {
        scaledQty: val,
        formattedQty: formatQuantity(val),
        category: "fat_surface",
        badgeText: "Surface-Area Oil Scaling",
      };
    }

    case "structural":
    default: {
      const val = baseQty * sf;
      return {
        scaledQty: val,
        formattedQty: formatQuantity(val),
        category: "structural",
        badgeText: "100% Linear Base",
      };
    }
  }
}

// --- 3. Fixed Pre-Prep Generator (Never tells users to pluck leaves from Vegetable Oil!) ---
function generatePrePrepChecklist(
  ingredients: RecipeDetail["recipe_ingredients"]
): { item: string; action: string }[] {
  const prepTasks: { item: string; action: string }[] = [];

  ingredients.forEach((ri) => {
    const rawName = ri.ingredients?.name || "";
    const n = rawName.toLowerCase().trim();

    // 1. SKIP items that need zero physical prep (oils, salt, water, sugar, seasoning cubes, sachet paste)
    if (
      n.includes("oil") ||
      n.includes("butter") ||
      n.includes("margarine") ||
      n === "salt" ||
      n === "water" ||
      n === "sugar" ||
      n.includes("maggi") ||
      n.includes("knorr") ||
      n.includes("seasoning cube") ||
      n.includes("stock cube") ||
      n.includes("curry") ||
      n.includes("thyme") ||
      n.includes("baking powder")
    ) {
      return;
    }

    if (n.includes("tomato paste") || n.includes("tin tomato")) {
      prepTasks.push({
        item: rawName,
        action:
          "Cut open the sachet or tin before turning on the stove and scoop into a small bowl so you don't burn your oil while struggling with packaging.",
      });
    } else if (n.includes("onion")) {
      prepTasks.push({
        item: rawName,
        action:
          "Peel off the dry papery skin, slice off the root and tip, rinse under cool water, and dice or slice evenly on a chopping board.",
      });
    } else if (n.includes("cabbage")) {
      prepTasks.push({
        item: rawName,
        action:
          "Remove tough outer leaves, cut into quarters, wash thoroughly in salted water BEFORE shredding thinly, and drain in a colander.",
      });
    } else if (
      n.includes("pepper") ||
      n.includes("scotch bonnet") ||
      n.includes("ata rodo") ||
      n.includes("chili") ||
      n.includes("tatashe")
    ) {
      prepTasks.push({
        item: rawName,
        action:
          "Pluck off the green stems, wash thoroughly in clean water, and either blend into a paste or finely chop depending on texture preference (wash hands after handling!).",
      });
    } else if (n.includes("tomato")) {
      prepTasks.push({
        item: rawName,
        action:
          "Wash in clean water, remove the stem core, and slice or blend smoothly with your peppers and half an onion.",
      });
    } else if (n.includes("rice")) {
      prepTasks.push({
        item: rawName,
        action:
          "Pour into a bowl and rinse 3–4 times with cool water, gently rubbing the grains until the cloudy surface starch clears, then drain in a sieve.",
      });
    } else if (n.includes("beans") || n.includes("ewa")) {
      prepTasks.push({
        item: rawName,
        action:
          "Spread on a flat tray to pick out any small stones, chaff, or broken grains, then rinse thoroughly in a bowl of water before boiling.",
      });
    } else if (
      n.includes("spaghetti") ||
      n.includes("pasta") ||
      n.includes("macaroni")
    ) {
      prepTasks.push({
        item: rawName,
        action:
          "Set a pot of water on medium-high heat with a pinch of salt and a drop of oil so it is ready to boil the pasta without sticking.",
      });
    } else if (n.includes("garlic") || n.includes("ginger")) {
      prepTasks.push({
        item: rawName,
        action:
          "Peel off the outer skin, rinse, and finely grate, crush, or mince so it releases its aroma evenly without leaving bitter chunks.",
      });
    } else if (
      n.includes("spinach") ||
      n.includes("ugwu") ||
      n.includes("efo") ||
      n.includes("bitterleaf") ||
      n.includes("uziza") ||
      n.includes("scent leaf") ||
      n.includes("waterleaf") ||
      n.includes("kale") ||
      n.includes("lettuce")
    ) {
      prepTasks.push({
        item: rawName,
        action:
          "Pluck the tender leaves from tough stems, wash 2–3 times in a large bowl of salted water to remove all sand/grit BEFORE slicing.",
      });
    } else if (n.includes("plantain")) {
      prepTasks.push({
        item: rawName,
        action:
          "Wash the outer skin, slice off both ends, slit the peel lengthwise with a knife, peel off the skin, and slice diagonally or into cubes.",
      });
    } else if (
      n.includes("yam") ||
      n.includes("potato") ||
      n.includes("cocoyam")
    ) {
      prepTasks.push({
        item: rawName,
        action:
          "Peel off the brown skin carefully with a knife, cut into even-sized chunks, and rinse immediately in clean water so it doesn't brown.",
      });
    } else if (
      n.includes("chicken") ||
      n.includes("beef") ||
      n.includes("meat") ||
      n.includes("goat") ||
      n.includes("turkey") ||
      n.includes("fish")
    ) {
      prepTasks.push({
        item: rawName,
        action:
          "Defrost if frozen, cut into bite-sized portions, rinse cleanly in cool water, and drain before seasoning.",
      });
    } else if (
      n.includes("carrot") ||
      n.includes("green beans") ||
      n.includes("sweet corn") ||
      n.includes("peas")
    ) {
      prepTasks.push({
        item: rawName,
        action:
          "Wash thoroughly, peel or trim the ends, and dice into small uniform cubes so they cook evenly.",
      });
    } else if (n.includes("egg")) {
      prepTasks.push({
        item: rawName,
        action:
          "Crack each egg into a separate small bowl first to check for freshness and prevent shells from falling into your pot.",
      });
    }
  });

  if (prepTasks.length === 0 && ingredients.length > 0) {
    prepTasks.push({
      item: "Countertop Mise en Place",
      action:
        "Measure out your dry spices into small bowls and keep a clean chopping board, knife, and cooking spoon within reach.",
    });
  }

  return prepTasks;
}

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- LIKE BUTTON STATE ---
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // --- INTERACTIVE PRE-PREP & INGREDIENT CHECKBOXES ---
  const [checkedIngredients, setCheckedIngredients] = useState<
    Record<string, boolean>
  >({});
  const [checkedPrepTasks, setCheckedPrepTasks] = useState<
    Record<number, boolean>
  >({});

  // --- SMART PORTION & RATIO CALCULATOR STATE ---
  const [scaleMode, setScaleMode] = useState<"main_item" | "servings">(
    "main_item"
  );
  const [selectedMainIndex, setSelectedMainIndex] = useState<number>(0);
  const [customMainQty, setCustomMainQty] = useState<string>("");
  const [customServings, setCustomServings] = useState<string>("");

  // --- AI OVERRIDE STATE FOR SCALING & PREP ---
  const [aiOverrides, setAiOverrides] = useState<
    Record<string, { qty: number; reason: string }>
  >({});
  const [aiChefNote, setAiChefNote] = useState<string | null>(null);
  const [aiPrepTasks, setAiPrepTasks] = useState<
    { item: string; action: string }[] | null
  >(null);
  const [isCalculatingAI, setIsCalculatingAI] = useState(false);

  // --- REVIEWS STATE ---
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    async function fetchRecipeDetails() {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (authSession) {
        setCurrentUserId(authSession.user.id);
        const { data: savedData } = await supabase
          .from("saved_recipes")
          .select("id")
          .eq("user_id", authSession.user.id)
          .eq("recipe_id", params.id)
          .maybeSingle();

        if (savedData) {
          setIsSaved(true);
        }
      }

      const { data, error } = await supabase
        .from("recipes")
        .select(
          `
          *,
          recipe_ingredients (
            quantity,
            unit,
            is_core,
            ingredients (name)
          ),
          recipe_steps (
            step_number,
            instruction
          )
        `
        )
        .eq("id", params.id)
        .single();

      if (error) {
        console.error("Error fetching recipe:", error.message);
      } else {
        if (data.recipe_steps) {
          data.recipe_steps.sort(
            (a: RecipeStep, b: RecipeStep) => a.step_number - b.step_number
          );
        }
        setRecipe(data);

        const defaultServ = data.default_servings || 4;
        setCustomServings(String(defaultServ));

        if (data.recipe_ingredients && data.recipe_ingredients.length > 0) {
          const stapleKeywords = [
            "rice",
            "beans",
            "spaghetti",
            "pasta",
            "macaroni",
            "yam",
            "plantain",
            "egg",
            "flour",
            "semo",
            "garri",
            "oats",
            "potato",
            "chicken",
            "beef",
            "fish",
          ];
          const foundIdx = data.recipe_ingredients.findIndex(
            (ri: RecipeDetail["recipe_ingredients"][number]) =>
              stapleKeywords.some((kw) =>
                ri.ingredients?.name?.toLowerCase().includes(kw)
              )
          );
          const initialIdx = foundIdx >= 0 ? foundIdx : 0;
          setSelectedMainIndex(initialIdx);
          setCustomMainQty(
            String(data.recipe_ingredients[initialIdx]?.quantity || 1)
          );
        }
      }
      setLoading(false);
    }

    if (params.id) {
      fetchRecipeDetails();
    }
  }, [params.id]);

  useEffect(() => {
    const fetchLikeStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);

        if (recipe?.id) {
          setLikeCount(recipe.likes_count || 0);

          const { data } = await supabase
            .from("user_likes")
            .select("id")
            .eq("user_id", session.user.id)
            .eq("recipe_id", recipe.id)
            .maybeSingle();

          if (data) setIsLiked(true);
        }
      }
    };
    fetchLikeStatus();
  }, [recipe?.id, recipe?.likes_count]);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!recipe?.id) return;
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("recipe_id", recipe.id)
        .order("created_at", { ascending: false });

      if (data && !error) setReviews(data);
    };
    fetchReviews();
  }, [recipe?.id]);

  // --- Linear Scale Factor (SF = New Base / Original Base) ---
  const scaleMultiplier = useMemo(() => {
    if (!recipe || !recipe.recipe_ingredients.length) return 1;

    if (scaleMode === "main_item") {
      const mainIng = recipe.recipe_ingredients[selectedMainIndex];
      const baseQty = Number(mainIng?.quantity) || 1;
      const userQty = parseFloat(customMainQty);
      if (!userQty || userQty <= 0) return 1;
      return userQty / baseQty;
    } else {
      const baseServings = Number(recipe.default_servings) || 4;
      const userServings = parseFloat(customServings);
      if (!userServings || userServings <= 0) return 1;
      return userServings / baseServings;
    }
  }, [recipe, scaleMode, selectedMainIndex, customMainQty, customServings]);


  // Helper to get the final displayed quantity for any ingredient (AI Override OR Culinary Formula)
  const getIngredientDisplay = (
    item: RecipeDetail["recipe_ingredients"][number]
  ) => {
    const nameKey = item.ingredients.name.toLowerCase();
    const isMain =
      scaleMode === "main_item" &&
      recipe?.recipe_ingredients[selectedMainIndex]?.ingredients.name ===
        item.ingredients.name;

    if (aiOverrides[nameKey] && !isMain) {
      return {
        formattedQty: formatQuantity(aiOverrides[nameKey].qty),
        badgeText: `✨ AI: ${aiOverrides[nameKey].reason}`,
        isSubLinear: true,
      };
    }

    const calc = calculateScientificQuantity(
      Number(item.quantity) || 0,
      scaleMultiplier,
      item.ingredients.name,
      isMain
    );

    return {
      formattedQty: calc.formattedQty,
      badgeText: calc.badgeText,
      isSubLinear: calc.category !== "structural",
    };
  };

  // --- Trigger AI Culinary Scientist Optimization ---
  const handleAskAIToOptimize = async () => {
    if (!recipe) return;
    setIsCalculatingAI(true);
    try {
      const targetServ = Math.max(
        1,
        Math.round((recipe.default_servings || 4) * scaleMultiplier)
      );
      const res = await fetch("/api/scale-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeTitle: recipe.title,
          baseServings: recipe.default_servings || 4,
          targetServings: targetServ,
          scaleFactor: scaleMultiplier,
          ingredients: recipe.recipe_ingredients.map((ri) => ({
            name: ri.ingredients.name,
            base_quantity: ri.quantity,
            unit: ri.unit,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.scaled_ingredients && Array.isArray(data.scaled_ingredients)) {
          const map: Record<string, { qty: number; reason: string }> = {};
          data.scaled_ingredients.forEach(
            (item: {
              name: string;
              suggested_quantity: number;
              reason: string;
            }) => {
              if (item.name) {
                map[item.name.toLowerCase()] = {
                  qty: Number(item.suggested_quantity) || 0,
                  reason: item.reason || "Chef-balanced ratio",
                };
              }
            }
          );
          setAiOverrides(map);
        }
        if (data.chef_note) setAiChefNote(data.chef_note);
        if (data.pre_prep_tasks && data.pre_prep_tasks.length > 0) {
          setAiPrepTasks(data.pre_prep_tasks);
        }
      }
    } catch (err) {
      console.error("AI ratio optimization failed:", err);
    } finally {
      setIsCalculatingAI(false);
    }
  };

  // Separate Must-Have (Core) vs Optional Flavor Enhancers
  const { coreIngredients, optionalIngredients, prePrepTasks } = useMemo(() => {
    if (!recipe) {
      return { coreIngredients: [], optionalIngredients: [], prePrepTasks: [] };
    }
    const core = recipe.recipe_ingredients.filter((i) => i.is_core !== false);
    const optional = recipe.recipe_ingredients.filter(
      (i) => i.is_core === false
    );
    const prep =
      aiPrepTasks || generatePrePrepChecklist(recipe.recipe_ingredients);
    return {
      coreIngredients: core,
      optionalIngredients: optional,
      prePrepTasks: prep,
    };
  }, [recipe, aiPrepTasks]);

  const handleMainIngredientSelect = (newIndex: number) => {
    setSelectedMainIndex(newIndex);
    setAiOverrides({}); // Clear AI overrides
    setAiChefNote(null);
    if (recipe && recipe.recipe_ingredients[newIndex]) {
      const baseQty = Number(recipe.recipe_ingredients[newIndex].quantity) || 1;
      setCustomMainQty(formatQuantity(baseQty * scaleMultiplier));
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      alert("You must be logged in to leave a review.");
      return;
    }
    if (rating < 1 || rating > 5) return;

    setIsSubmittingReview(true);

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        user_id: currentUserId,
        recipe_id: recipe!.id,
        rating,
        comment: comment.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to post review:", error);
      alert("There was an error saving your review.");
    } else {
      setReviews([data, ...reviews]);
      setComment("");
      setRating(5);
    }
    setIsSubmittingReview(false);
  };

  const handleLikeToggle = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    if (!currentUserId) {
      alert("Please log in to like recipes!");
      return;
    }
    if (isLiking || !recipe) return;

    setIsLiking(true);

    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);

    setIsLiked(newIsLiked);
    setLikeCount(newCount);

    try {
      if (newIsLiked) {
        const { error: likeErr } = await supabase
          .from("user_likes")
          .insert({ user_id: currentUserId, recipe_id: recipe.id });
        if (likeErr) throw likeErr;

        const { error: recErr } = await supabase
          .from("recipes")
          .update({ likes_count: newCount })
          .eq("id", recipe.id);
        if (recErr) throw recErr;
      } else {
        const { error: unlikeErr } = await supabase
          .from("user_likes")
          .delete()
          .eq("user_id", currentUserId)
          .eq("recipe_id", recipe.id);
        if (unlikeErr) throw unlikeErr;

        const { error: recErr } = await supabase
          .from("recipes")
          .update({ likes_count: newCount })
          .eq("id", recipe.id);
        if (recErr) throw recErr;
      }
    } catch (error) {
      setIsLiked(!newIsLiked);
      setLikeCount(newIsLiked ? Math.max(0, newCount - 1) : newCount + 1);
      console.error("Database rejected the like:", error);
    } finally {
      setIsLiking(false);
    }
  };

  const triggerPreflight = () => {
    setShowPreflight(true);
  };

  const confirmAndStartCooking = async () => {
    setStartingSession(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const initialScratchpad: string[] = [];
    if (Math.abs(scaleMultiplier - 1) > 0.05 && recipe) {
      const scaledSummary = recipe.recipe_ingredients
        .map((ri) => {
          const disp = getIngredientDisplay(ri);
          return `${disp.formattedQty} ${ri.unit} ${ri.ingredients.name}`;
        })
        .join(", ");
      initialScratchpad.push(
        `User scaled the base recipe by ${formatQuantity(
          scaleMultiplier
        )}x using non-linear spice/oil rules (75% rule for spices, surface-area scaling for oil). Suggested quantities: ${scaledSummary}. Remind user to taste and adjust final 25% of seasoning.`
      );
    }

    const { data: newSession, error } = await supabase
      .from("cooking_sessions")
      .insert({
        user_id: session.user.id,
        recipe_id: recipe?.id,
        current_step: 1,
        status: "active",
        modifications:
          initialScratchpad.length > 0
            ? { scratchpad: initialScratchpad, ai_steps: {} }
            : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to start session:", error.message);
      setStartingSession(false);
    } else {
      router.push(`/cook/${newSession.id}`);
    }
  };

  const toggleSaveRecipe = async () => {
    setIsSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    if (isSaved) {
      await supabase
        .from("saved_recipes")
        .delete()
        .eq("user_id", session.user.id)
        .eq("recipe_id", recipe?.id);
      setIsSaved(false);
    } else {
      await supabase.from("saved_recipes").insert({
        user_id: session.user.id,
        recipe_id: recipe?.id,
      });
      setIsSaved(true);
    }
    setIsSaving(false);
  };

  if (loading) return <SkeletonLoader type="recipe" />;

  if (!recipe) {
    return (
      <div className="p-6 text-center text-red-500">Recipe not found.</div>
    );
  }

  const estimatedServings = Math.max(
    1,
    Math.round((recipe.default_servings || 4) * scaleMultiplier)
  );
  const mainIngredientObj = recipe.recipe_ingredients[selectedMainIndex];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 w-full transition-colors duration-200">
      {/* --- HERO IMAGE BANNER --- */}
      <div className="w-full relative aspect-video md:h-[400px] md:aspect-auto bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <button
          type="button"
          title="Go back"
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-20 p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
        </button>

        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
            <ChefHat className="w-16 h-16 sm:w-24 sm:h-24" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30 pointer-events-none z-10" />
      </div>

      {/* Main Content Layout Block */}
      <div className="p-6 -mt-6 relative bg-gray-50 dark:bg-gray-900 rounded-t-2xl w-full max-w-4xl mx-auto transition-colors duration-200">
        {/* Title Block Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 w-full">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
              {recipe.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              {recipe.overview || "A delicious recipe curated by Kitchen OS."}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleLikeToggle}
              aria-label={isLiked ? "Unlike recipe" : "Like recipe"}
              className={`p-3 bg-white dark:bg-gray-800 rounded-full shadow-sm transition-all hover:scale-110 active:scale-95 border ${
                isLiked
                  ? "border-red-100 dark:border-red-900/50"
                  : "border-gray-100 dark:border-gray-700"
              }`}
              title={isLiked ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isLiked
                    ? "fill-red-500 text-red-500"
                    : "text-gray-400 dark:text-gray-500 hover:text-red-500"
                }`}
                aria-hidden="true"
              />
            </button>

            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 transition-colors">
              {likeCount} {likeCount === 1 ? "Like" : "Likes"}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap gap-6 mb-8 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 pb-6 w-full transition-colors">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>
              {recipe.prep_time_mins + recipe.cook_time_mins} mins total (
              {recipe.prep_time_mins}m prep / {recipe.cook_time_mins}m cook)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-500" />
            <span>
              {estimatedServings} servings{" "}
              {Math.abs(scaleMultiplier - 1) > 0.05 &&
                `(${formatQuantity(scaleMultiplier)}x base batch)`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Utensils className="w-4 h-4 text-blue-500" />
            <span>{recipe.recipe_steps.length} guided voice steps</span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-3 mb-8 w-full">
          <button
            type="button"
            onClick={triggerPreflight}
            disabled={startingSession}
            className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Play className="w-5 h-5" />
            {startingSession ? "Starting..." : "Pre-Flight & Cook Now"}
          </button>

          <button
            type="button"
            onClick={toggleSaveRecipe}
            disabled={isSaving}
            className={`flex-1 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm border ${
              isSaved
                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 hover:bg-blue-100"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <BookmarkPlus
              className={`w-5 h-5 ${
                isSaved
                  ? "text-blue-600 dark:text-blue-400 fill-current"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            />
            {isSaving ? "Saving..." : isSaved ? "Saved" : "Bookmark"}
          </button>
        </div>

        {/* =================================================================
            1. NON-LINEAR CULINARY SCIENCE & AI PORTION CALCULATOR
           ================================================================= */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Smart Portion & Non-Linear Ratio Calculator
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Structural food scales 100% linearly, while spices (75% rule), thickeners (70%), and cooking oils (surface-area bound) scale sub-linearly so large batches never get over-seasoned or greasy.
              </p>
            </div>

            <div className="inline-flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl shrink-0 self-start">
              <button
                type="button"
                onClick={() => {
                  setScaleMode("main_item");
                  setAiOverrides({});
                  setAiChefNote(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scaleMode === "main_item"
                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                By Main Food
              </button>
              <button
                type="button"
                onClick={() => {
                  setScaleMode("servings");
                  setAiOverrides({});
                  setAiChefNote(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scaleMode === "servings"
                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                By Servings
              </button>
            </div>
          </div>

          {scaleMode === "main_item" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  1. Choose Your Main Staple
                </label>
                <select
                  value={selectedMainIndex}
                  onChange={(e) =>
                    handleMainIngredientSelect(Number(e.target.value))
                  }
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {recipe.recipe_ingredients.map((ri, idx) => (
                    <option key={idx} value={idx}>
                      {ri.ingredients.name} (Base: {ri.quantity} {ri.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  2. How many {mainIngredientObj?.unit || "units"} of{" "}
                  {mainIngredientObj?.ingredients.name} are you cooking?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.25"
                    step="any"
                    value={customMainQty}
                    onChange={(e) => {
                      setCustomMainQty(e.target.value);
                      setAiOverrides({});
                      setAiChefNote(null);
                    }}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={String(mainIngredientObj?.quantity || 1)}
                  />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 shrink-0 px-2">
                    {mainIngredientObj?.unit || "units"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  How many servings / people are you cooking for?
                </label>
                <div className="flex items-center gap-2 max-w-xs">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customServings}
                    onChange={(e) => {
                      setCustomServings(e.target.value);
                      setAiOverrides({});
                      setAiChefNote(null);
                    }}
                    className="w-28 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    servings (Base: {recipe.default_servings})
                  </span>
                </div>
              </div>

              {mainIngredientObj && (
                <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                    Suggested Main Staple Amount
                  </span>
                  <span className="text-base font-extrabold text-gray-900 dark:text-white">
                    {formatQuantity(
                      (Number(mainIngredientObj.quantity) || 1) * scaleMultiplier
                    )}{" "}
                    {mainIngredientObj.unit} of{" "}
                    {mainIngredientObj.ingredients.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Optional AI Deep Research Optimization Button */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>
                Spices use the <strong>75% safe baseline floor</strong>—taste near the end and add the remaining 25% only if needed.
              </span>
            </p>

            <button
              type="button"
              onClick={handleAskAIToOptimize}
              disabled={isCalculatingAI}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-60"
            >
              {isCalculatingAI ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI Calculating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI Chef to Refine Batch Ratios</span>
                </>
              )}
            </button>
          </div>

          {aiChefNote && (
            <div className="mt-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200">
              <strong>🤖 AI Chef Ratio Note:</strong> {aiChefNote}
            </div>
          )}
        </div>

        {/* =================================================================
            2. CATEGORIZED INGREDIENTS (Must-Haves vs. Flavor Enhancers)
           ================================================================= */}
        <div className="mb-8 space-y-6 w-full">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Must-Have Ingredients (Essential Base)
              </h2>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                Required for this meal
              </span>
            </div>

            <ul className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden w-full divide-y divide-gray-50 dark:divide-gray-700/50">
              {coreIngredients.map((item, idx: number) => {
                const key = `core-${idx}`;
                const disp = getIngredientDisplay(item);
                const isChecked = !!checkedIngredients[key];

                return (
                  <li
                    key={key}
                    onClick={() =>
                      setCheckedIngredients((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }))
                    }
                    className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span
                          className={`font-medium capitalize block transition-colors ${
                            isChecked
                              ? "line-through text-gray-400 dark:text-gray-500"
                              : "text-gray-900 dark:text-gray-200"
                          }`}
                        >
                          {item.ingredients.name}
                        </span>
                        {Math.abs(scaleMultiplier - 1) > 0.05 && (
                          <span
                            className={`text-[11px] font-medium ${
                              disp.isSubLinear
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-gray-400"
                            }`}
                          >
                            {disp.badgeText}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {disp.formattedQty} {item.unit}
                      </span>
                      {Math.abs(scaleMultiplier - 1) > 0.05 && (
                        <span className="block text-[11px] text-gray-400">
                          (Base: {item.quantity} {item.unit})
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {optionalIngredients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Flavor Enhancers (Optional / Good to Have)
                </h2>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full">
                  Elevates taste, not strictly required
                </span>
              </div>

              <ul className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden w-full divide-y divide-gray-50 dark:divide-gray-700/50">
                {optionalIngredients.map((item, idx: number) => {
                  const key = `opt-${idx}`;
                  const disp = getIngredientDisplay(item);
                  const isChecked = !!checkedIngredients[key];

                  return (
                    <li
                      key={key}
                      onClick={() =>
                        setCheckedIngredients((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                      className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                        <div>
                          <span
                            className={`font-medium capitalize block transition-colors ${
                              isChecked
                                ? "line-through text-gray-400 dark:text-gray-500"
                                : "text-gray-900 dark:text-gray-200"
                            }`}
                          >
                            {item.ingredients.name}
                          </span>
                          {Math.abs(scaleMultiplier - 1) > 0.05 && (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400">
                              {disp.badgeText}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                          {disp.formattedQty} {item.unit}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* =================================================================
            3. BEFORE YOU TURN ON THE STOVE (Pre-Prep / Mise en Place Guide)
           ================================================================= */}
        <div className="mb-8 w-full bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
              Step 0 • Mise en Place
            </span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Ingredient Preparation (Before You Start Cooking)
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Complete these physical prep tasks (washing, peeling, slicing, blending) before turning on the heat so your hands-free cooking session flows smoothly:
            </p>
          </div>

          <div className="space-y-3">
            {prePrepTasks.map((task, idx) => {
              const done = !!checkedPrepTasks[idx];
              return (
                <div
                  key={idx}
                  onClick={() =>
                    setCheckedPrepTasks((prev) => ({
                      ...prev,
                      [idx]: !prev[idx],
                    }))
                  }
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    done
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40"
                      : "bg-gray-50 dark:bg-gray-900/60 border-gray-100 dark:border-gray-700/60 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => {}}
                    className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <div className="text-sm">
                    <span
                      className={`font-bold capitalize block mb-0.5 ${
                        done
                          ? "line-through text-gray-400 dark:text-gray-500"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      Prep {task.item}
                    </span>
                    <p
                      className={`leading-relaxed ${
                        done
                          ? "line-through text-gray-400 dark:text-gray-500"
                          : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {task.action}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Once your ingredients are prepped on the counter, launch the interactive voice guide for all{" "}
              <strong>{recipe.recipe_steps.length} cooking steps</strong>.
            </div>
            <button
              type="button"
              onClick={triggerPreflight}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shrink-0 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Open Pre-Flight Checklist
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================
          INTERACTIVE PRE-FLIGHT CHECKLIST & PORTION MODAL OVERLAY
         ================================================================= */}
      {showPreflight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-gray-950/80 backdrop-blur-sm transition-opacity overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-transparent dark:border-gray-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 transition-colors my-8 max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              Pre-Flight Counter & Portion Check
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-4">
              Spices and oils are scaled using the <strong>75% sub-linear rule</strong> and surface-area dynamics so your dish stays balanced.
            </p>

            {/* Quick Portion Controls Inside Modal */}
            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-3.5 mb-4">
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setScaleMode("main_item")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    scaleMode === "main_item"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  Measure by Main Food
                </button>
                <button
                  type="button"
                  onClick={() => setScaleMode("servings")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    scaleMode === "servings"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  Measure by Servings
                </button>
              </div>

              {scaleMode === "main_item" ? (
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  <select
                    value={selectedMainIndex}
                    onChange={(e) =>
                      handleMainIngredientSelect(Number(e.target.value))
                    }
                    className="w-full sm:w-1/2 p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-900 dark:text-white"
                  >
                    {recipe.recipe_ingredients.map((ri, idx) => (
                      <option key={idx} value={idx}>
                        {ri.ingredients.name} ({ri.unit})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5 w-full sm:w-1/2">
                    <input
                      type="number"
                      min="0.25"
                      step="any"
                      value={customMainQty}
                      onChange={(e) => {
                        setCustomMainQty(e.target.value);
                        setAiOverrides({});
                        setAiChefNote(null);
                      }}
                      className="w-full p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-900 dark:text-white"
                    />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0">
                      {mainIngredientObj?.unit}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Number of Servings:
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customServings}
                    onChange={(e) => setCustomServings(e.target.value)}
                    className="w-24 p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-center text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-5 overflow-y-auto border border-gray-100 dark:border-gray-700 text-sm space-y-4 flex-1">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                  Must-Have Ingredients (Non-Linear Balanced)
                </h4>
                <ul className="space-y-2">
                  {coreIngredients.map((item, idx) => {
                    const disp = getIngredientDisplay(item);
                    return (
                      <li
                        key={idx}
                        className="flex justify-between items-center text-gray-800 dark:text-gray-200 text-xs sm:text-sm"
                      >
                        <div>
                          <span className="font-medium capitalize">
                            • {item.ingredients.name}
                          </span>
                          {Math.abs(scaleMultiplier - 1) > 0.05 && (
                            <span className="block text-[10px] text-gray-400 pl-2.5">
                              {disp.badgeText}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {disp.formattedQty} {item.unit}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {optionalIngredients.length > 0 && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                    Optional Flavor Enhancers
                  </h4>
                  <ul className="space-y-1.5">
                    {optionalIngredients.map((item, idx) => {
                      const disp = getIngredientDisplay(item);
                      return (
                        <li
                          key={idx}
                          className="flex justify-between text-gray-600 dark:text-gray-400 text-xs sm:text-sm"
                        >
                          <span className="capitalize">
                            • {item.ingredients.name}
                          </span>
                          <span>
                            {disp.formattedQty} {item.unit}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPreflight(false)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Still Prepping
              </button>
              <button
                type="button"
                onClick={confirmAndStartCooking}
                disabled={startingSession}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm text-center"
              >
                {startingSession ? "Starting..." : "Let's Cook"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- REVIEWS SECTION --- */}
      <div className="max-w-4xl mx-auto px-6 pb-24 w-full">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 mt-8 transition-colors duration-200 w-full">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400 fill-current" />
            Chef Reviews ({reviews.length})
          </h2>

          {currentUserId ? (
            <form
              onSubmit={handleSubmitReview}
              className="mb-10 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 transition-colors w-full"
            >
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                Leave a Review
              </h3>

              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    title="rating"
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        star <= (hoveredStar || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300 dark:text-gray-600"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you think of this recipe? (Optional)"
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24 mb-4 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmittingReview ? "Posting..." : "Post Review"}
              </button>
            </form>
          ) : (
            <div className="mb-10 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 text-center transition-colors w-full">
              <p className="text-gray-500 dark:text-gray-400">
                Please log in to share your thoughts.
              </p>
            </div>
          )}

          <div className="space-y-6 divide-y divide-gray-100 dark:divide-gray-700 w-full">
            {reviews.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center italic py-4">
                No reviews yet. Be the first to rate this recipe!
              </p>
            ) : (
              reviews.map((review) => (
                <div
                  key={review.id}
                  className="border-b border-gray-100 dark:border-gray-700/50 pb-6 last:border-0 last:pb-0 pt-6 first:pt-0 w-full transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2 w-full">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-200 dark:text-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white ml-2">
                      A Fellow Chef
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-2">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}