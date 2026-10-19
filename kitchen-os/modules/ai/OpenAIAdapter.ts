import OpenAI from "openai";

// Initialize the OpenAI client securely
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function processKitchenCommand(
  userCommand: string, 
  currentStepInstruction: string,
  dietaryProfile?: string | null,
  scratchpad?: string[]
) {
  const systemPrompt = `
    You are the brain of Kitchen OS, an intelligent cooking assistant (like JARVIS for the kitchen).
    
    CRITICAL SAFETY RULE: The user has the following strict dietary restrictions and allergies:
    "${dietaryProfile || 'None'}"

    ACTIVE SESSION MEMORY:
    ${scratchpad?.length ? scratchpad.join(' | ') : 'No session modifications yet.'}
    
    YOU ARE A STRICT FILTER.You must strictly adhere to these restrictions. If the user's command or the current recipe step includes an ingredient that violates these rules, you MUST adapt the instruction to use a safe alternative, even if the user didn't explicitly ask you to.
    If the session memory says an ingredient was removed, NEVER suggest it again.
    
    The user is currently on this step of a recipe: "${currentStepInstruction}"
    The user just said: "${userCommand}"
    
    Your job is to adapt the recipe based on what they said AND their dietary profile if any. 
    You must preserve the identity of the dish, but accommodate their changes.
    
    You must respond in strict JSON format with exactly these three fields:
    1. "action": Either "adapt_step", "next_step", or "safety_check".
    2. "speech": What you, the voice assistant, will say out loud to the user (keep it brief, friendly, and practical).
    3. "updated_instruction": The new, modified text for the current recipe step.
    4. "new_scratchpad_note": If the user makes a new global change (e.g., "I don't have onions", "Make it spicy"), write a short note here (e.g., "Onions removed", "Added extra chili"). If there is no global change, return null.
  
    `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4-mini", // Fast, cheap, very smart and up to date
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userCommand }
      ],
      response_format: { type: "json_object" }, // This forces OpenAI to return perfect JSON
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;

  } catch (error) {
    console.error("OpenAI Adapter Error:", error);
    throw new Error("Failed to process command with AI.");
  }
}