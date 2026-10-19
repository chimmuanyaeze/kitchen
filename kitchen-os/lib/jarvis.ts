import { supabase } from "@/lib/supabase";

type JoinedIngredient = { name: string } | { name: string }[] | null;

interface DeductionResult {
  success: boolean;
  message: string;
  shortages?: { name: string; needed: number; have: number; unit: string }[];
}

export async function jarvisAutoDeduct(recipeId: string, userId: string): Promise<DeductionResult> {
  try {
    // 1. FETCH RECIPE REQUIREMENTS
    // Grab all ingredients and their exact quantities needed for this recipe
    const { data: recipeData, error: recipeError } = await supabase
      .from("recipe_ingredients")
      .select(`
        quantity, 
        unit,
        ingredient_id,
        ingredients ( name )
      `)
      .eq("recipe_id", recipeId);

    if (recipeError || !recipeData) throw new Error("Could not read recipe blueprint.");

    // 2. FETCH CURRENT PANTRY INVENTORY
    // Grab the user's current stock for only the ingredients needed in this recipe
    const requiredIngredientIds = recipeData.map(ri => ri.ingredient_id);
    
    const { data: pantryData, error: pantryError } = await supabase
      .from("pantry")
      .select("*")
      .eq("user_id", userId)
      .in("ingredient_id", requiredIngredientIds);

    if (pantryError) throw new Error("Could not access the pantry vault.");

    // 3. THE ANALYTICS ENGINE (Checking for shortages)
    const shortages = [];
    const updates = [];
    const deletions = [];

   for (const req of recipeData) {
      // Find the matching ingredient in the user's pantry
      const pantryItem = pantryData?.find(p => p.ingredient_id === req.ingredient_id);
      
      // 🚀 FIXED: Cast the relational join to 'any' to bypass TypeScript's 'never' panic
      const ingredientData = req.ingredients as JoinedIngredient;
      const ingredientName = Array.isArray(ingredientData) 
        ? ingredientData[0]?.name 
        : ingredientData?.name || "Unknown Item";

      // If they don't have it at all, or don't have enough
      if (!pantryItem || pantryItem.quantity < req.quantity) {
        shortages.push({
          name: ingredientName,
          needed: req.quantity,
          have: pantryItem ? pantryItem.quantity : 0,
          unit: req.unit
        });
      } else {
        // They have enough! Calculate the remaining balance
        const remainingBalance = pantryItem.quantity - req.quantity;

        if (remainingBalance <= 0) {
          // If it hits 0, queue it for deletion to keep the pantry clean
          deletions.push(pantryItem.id);
        } else {
          // Otherwise, queue the math update
          updates.push({
            id: pantryItem.id,
            user_id: userId,
            ingredient_id: req.ingredient_id,
            quantity: remainingBalance,
            unit: pantryItem.unit // Assuming units match for the MVP
          });
        }
      }
    }

    // 4. THE BLOCKER: If there are shortages, abort the deduction and warn the UI
    if (shortages.length > 0) {
      return {
        success: false,
        message: "Insufficient ingredients detected.",
        shortages
      };
    }

    // 5. THE EXECUTION: Fire all database updates simultaneously 
    const executionPromises = [];

    if (updates.length > 0) {
      // Supabase upsert requires the primary key (id) to overwrite existing rows
      executionPromises.push(supabase.from("pantry").upsert(updates));
    }

    if (deletions.length > 0) {
      executionPromises.push(supabase.from("pantry").delete().in("id", deletions));
    }

    await Promise.all(executionPromises);

    return {
      success: true,
      message: "Pantry updated. Ingredients safely deducted."
    };

  } catch (error: unknown) {
    console.error("Jarvis Engine Error:", error);
    // Safely check if the error is a standard Error object before extracting the message
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: errorMessage };
  }
}