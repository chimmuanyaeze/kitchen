import { NextRequest, NextResponse } from "next/server";

// Proxies to your self-hosted faster-whisper server. See inference-server/
// for the Python service this talks to.
//
// Env vars required: INFERENCE_SERVER_URL, INFERENCE_API_KEY

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    const proxyForm = new FormData();
    proxyForm.append("audio", audioFile, "command.wav");

    const res = await fetch(`${process.env.INFERENCE_SERVER_URL}/transcribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.INFERENCE_API_KEY}`,
      },
      body: proxyForm,
    });

    if (!res.ok) {
      console.error("Self-hosted transcription failed:", await res.text());
      return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }

    const data = await res.json();
    const transcript: string = (data.transcript || "").trim();

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("Transcribe route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}