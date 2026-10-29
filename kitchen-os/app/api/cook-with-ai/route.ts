import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are the Master AI Chef for Kitchen OS, an AI-Assisted Cooking Guidance System specializing in both Nigerian/African dishes and global cuisine.

The user will provide:
1. A photo (of a prepared dish OR raw ingredients),
2. A typed list of ingredients / dish request, OR
3. Both.

First, evaluate the input for edge cases:
- If an image is provided but is too blurry, dark, or unclear to identify any food or ingredients, return:
  {"status": "unclear_photo", "error_message": "The photo is too blurry or dark to recognize the ingredients. Please snap a clearer, well-lit photo."}
- If the image or text contains NO recognizable food items or edible ingredients (e.g., a photo of a laptop, furniture, or gibberish text), return:
  {"status": "no_ingredients", "error_message": "We couldn't detect any food or cooking ingredients in your input. Please provide valid ingredients or a food photo."}

Otherwise, return {"status": "ok", ...} with the following strict JSON structure:
{
  "status": "ok",
  "dish_name": "Name of the identified or recommended dish",
  "short_description": "2-sentence appetizing overview of the dish",
  "prep_time_mins": 15,
  "cook_time_mins": 35,
  "servings": 4,
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "ingredients": [
    {
      "name": "Ingredient name",
      "quantity": "2",
      "unit": "cups",
      "is_missing": false
    }
  ],
  "missing_from_user": ["List of essential ingredients required for this dish that the user did NOT mention or show in their photo"],
  "steps": [
    {
      "step_number": 1,
      "title": "Short title for the step",
      "instruction": "Clear, micro-stepped culinary instruction suitable for reading aloud.",
      "tip": "Optional quick safety or flavor tip for this step"
    }
  ],
  "tips": [
    "Helpful chef tip 1",
    "Helpful chef tip 2"
  ],
  "substitutions": [
    {
      "original": "Ingredient name",
      "substitute": "Alternative ingredient",
      "note": "How it changes flavor or texture"
    }
  ]
}
Always return valid JSON only.`;

export async function POST(req: NextRequest) {
  try {
    const { ingredientsText, imageBase64 } = await req.json();

    if (!ingredientsText && !imageBase64) {
      return NextResponse.json(
        { error: "Please provide ingredients text or a photo." },
        { status: 400 }
      );
    }

    const userContent: Array<Record<string, unknown>> = [];

    if (ingredientsText) {
      userContent.push({
        type: "text",
        text: `User's typed ingredients or dish request: "${ingredientsText}"`,
      });
    } else {
      userContent.push({
        type: "text",
        text: "Identify the dish or ingredients in this photo and generate a complete step-by-step cooking guide.",
      });
    }

    if (imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: imageBase64,
          detail: "low",
        },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "The AI Chef service is temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }

    const completion = await response.json();
    const rawJson = completion.choices?.[0]?.message?.content;
    const parsed = JSON.parse(rawJson);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Cook with AI Error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI cooking guidance. Please try again." },
      { status: 500 }
    );
  }
}