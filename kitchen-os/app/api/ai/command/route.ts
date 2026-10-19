import { NextResponse } from "next/server";
import { processKitchenCommand } from "@/modules/ai/OpenAIAdapter";

// This handles POST requests sent from the kitchen screen
export async function POST(request: Request) {
  try {
    // 1. Unpack the data sent from the frontend
    const body = await request.json();

    const { command, currentStep, dietaryProfile, scratchpad } = body;

    if (!command || !currentStep) {
      return NextResponse.json(
        { error: "Missing command or step context." }, 
        { status: 400 }
      );
    }

    // 2. Send it to our OpenAI Adapter
    const aiResponse = await processKitchenCommand(command, currentStep, dietaryProfile, scratchpad);

    // 3. Send the AI's intelligent response back to the frontend
    return NextResponse.json(aiResponse);

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { error: "Internal server error." }, 
      { status: 500 }
    );
  }
}