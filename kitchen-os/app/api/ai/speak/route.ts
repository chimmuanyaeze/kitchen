import { NextRequest, NextResponse } from "next/server";

// Proxies to your self-hosted Kokoro-82M server. See inference-server/
// for the Python service this talks to.
//
// Env vars required: INFERENCE_SERVER_URL, INFERENCE_API_KEY

export async function POST(req: NextRequest) {
  try {
    const { text, voiceGender } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const res = await fetch(`${process.env.INFERENCE_SERVER_URL}/speak`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.INFERENCE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voiceGender }),
    });

    if (!res.ok) {
      console.error("Self-hosted TTS failed:", await res.text());
      return NextResponse.json({ error: "TTS generation failed" }, { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Speak route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}