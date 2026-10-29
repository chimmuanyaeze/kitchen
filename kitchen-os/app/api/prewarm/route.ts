import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  // 1. Only logged-in admins may trigger prewarm
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Relay to the inference server, adding the secret key server-side
  const body = await req.json();
  try {
    const res = await fetch(
      `${process.env.INFERENCE_URL || "http://localhost:8000"}/prewarm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.INFERENCE_API_KEY && {
            Authorization: `Bearer ${process.env.INFERENCE_API_KEY}`,
          }),
        },
        body: JSON.stringify(body),
      }
    );
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "inference server unreachable" },
      { status: 502 }
    );
  }
}