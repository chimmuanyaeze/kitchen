import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a Master Culinary Scientist and Nigerian/Global Chef for Kitchen OS.
When a user scales a recipe (e.g. from 2 cups of rice to 5 cups or 100 cups), DO NOT scale all ingredients linearly.
Apply culinary surface-area-to-volume science:
1. Structural Base (rice, beans, pasta, meat, fresh veggies): Scale 100% linearly (Original * SF).
2. Spices, Salt, Seasoning Cubes, Hot Peppers, & Concentrates (like Tomato Paste sachets): Apply the 75% Sub-Linear Rule ((Original * SF) * 0.75) and round to practical kitchen numbers so the dish is not over-salted, overly spicy, or sour.
3. Leavening & Thickeners (yeast, baking powder, cornstarch): Scale at 65%-70% ((Original * SF) * 0.70).
4. Frying / Cooking Oils (vegetable oil, palm oil, butter): Scale by pan surface-area dynamics (~60-65% growth rate), NEVER 100% linearly.

Also generate a 'pre_prep_tasks' list ONLY for ingredients that genuinely require physical preparation BEFORE turning on the stove (e.g., washing/rinsing rice, picking beans, slicing onions, washing & blending peppers, defrosting/cutting meat). NEVER tell the user to wash or chop oil, salt, water, or sachet paste!

Return ONLY valid JSON matching this exact structure:
{
  "chef_note": "1-sentence explanation of how you balanced the oil, paste, and spices for this batch size.",
  "scaled_ingredients": [
    {
      "name": "exact ingredient name from input",
      "suggested_quantity": 3.5,
      "category": "structural" | "spice_75" | "thickener_70" | "fat_surface",
      "reason": "Short 4-word note e.g. '75% spice safety rule' or 'Surface-bound oil ratio'"
    }
  ],
  "pre_prep_tasks": [
    {
      "item": "Ingredient Name",
      "action": "Clear, beginner-friendly physical prep instruction before cooking starts."
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const {
      recipeTitle,
      baseServings,
      targetServings,
      scaleFactor,
      ingredients,
    } = await req.json();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              recipeTitle,
              baseServings,
              targetServings,
              linearScaleFactor: scaleFactor,
              baseIngredients: ingredients,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "AI scaling unavailable, using scientific formula fallback." },
        { status: 502 }
      );
    }

    const completion = await response.json();
    const parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("AI Scale Route Error:", error);
    return NextResponse.json(
      { error: "Failed to run AI scaling." },
      { status: 500 }
    );
  }
}