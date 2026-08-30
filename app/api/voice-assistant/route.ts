import { NextRequest, NextResponse } from "next/server";
import { buildVoiceAssistantResponse } from "@/lib/voice-assistant";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "اكتب أو قل طلبك أولًا." }, { status: 400 });
  }

  if (message.length > 500) {
    return NextResponse.json({ error: "خل طلبك أقصر شوي عشان أقدر أساعدك بسرعة." }, { status: 400 });
  }

  // Stable adapter seam for the future AI provider:
  // replace this local intent engine with STT/LLM/TTS-backed logic while keeping
  // the same { reply, action } response contract consumed by the UI.
  const response = buildVoiceAssistantResponse(message);
  return NextResponse.json(response);
}
