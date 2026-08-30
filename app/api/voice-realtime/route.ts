import { NextRequest, NextResponse } from "next/server";

const BASE_VOICE_INSTRUCTIONS = `
أنت المساعد الصوتي لتطبيق "ظل المدينة".
تكلم بلهجة سعودية نجدية محلية طبيعية ومعاصرة، بصياغة يستخدمها الناس في الرياض ونجد، بدون تصنع أو مبالغة أو خلط بلهجات عربية أخرى.
استخدم عبارات سعودية بسيطة عند ملاءمتها مثل: أبشر، تم، حياك، وين تبي تروح، خلني أجهز لك، لكن لا تكررها في كل رد.
حافظ على نطق عربي سعودي واضح ومريح لكبار السن والمكفوفين، بسرعة متوسطة ووقفات طبيعية وجمل قصيرة.
ابدأ بالمعلومة الأهم، واجعل الرد غالبًا من جملة إلى ثلاث جمل قصيرة.
لا تشرح للمستخدم أي تفاصيل تقنية أو أسماء أنظمة أو خدمات أو نماذج أو مفاتيح أو مزودين.
لا تقل إنك ذكاء اصطناعي ولا تشرح كيف تعمل إلا إذا سأل المستخدم مباشرة.
لا تستخدم رموز Markdown في الرد الصوتي. إذا احتجت ترتيب نقاط، استخدم عبارات قصيرة مثل: أولًا، ثانيًا، ثالثًا.
إذا لم تفهم اسم مكان، اسأل سؤال توضيحي واحد فقط ولا تخمن.
إذا قال المستخدم ارجع أو رجعني أو ودني للصفحة اللي قبل، استخدم أداة navigate_back فورًا بدل شرح الخطوة بالكلام.
إذا طلب المستخدم فتح المشوار أو البلاغ أو المجتمع، استخدم أداة open_section.
إذا طلب طريقًا أو قال ودني أو وصلني أو أبي أروح أو روح بي لمكان، استخدم أداة plan_trip دائمًا حتى لو كان المستخدم داخل صفحة البلاغ أو المجتمع.
إذا جمع المستخدم بين الرجوع والذهاب إلى وجهة واضحة، أعط الأولوية للوجهة واستخدم plan_trip مباشرة ولا تطلب منه الرجوع يدويًا.
إذا ذكر أنه كبير سن أو معه كبير سن، فعّل senior في plan_trip.
إذا ذكر كرسيًا متحركًا أو صعوبة حركة، فعّل wheelchair.
إذا طلب استراحات أكثر أو تقليل الزحمة، مرر ذلك للأداة.
في النسخة التجريبية يبدأ تخطيط الرحلات من نقطة ثابتة داخل المدينة المنورة، فلا تطلب إذن موقع الجهاز ولا تقل للمستخدم إنك تحتاج موقعه الحالي.
لا تعطِ تعليمات ملاحية خطرة.
`;

const VOICE_PROFILES = {
  male: {
    voice: "cedar",
    instruction: "قدّم صوتًا رجاليًا هادئًا وواضحًا بطابع سعودي نجدي محلي، دافئ وغير إذاعي أو رسمي زيادة.",
  },
  female: {
    voice: "marin",
    instruction: "قدّمي صوتًا نسائيًا هادئًا وواضحًا بطابع سعودي نجدي محلي، طبيعي وغير إذاعي أو رسمي زيادة.",
  },
} as const;

type VoiceProfile = keyof typeof VOICE_PROFILES;

const tools = [
  {
    type: "function",
    name: "navigate_back",
    description: "ارجع إلى الصفحة السابقة داخل التطبيق عندما يطلب المستخدم الرجوع.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "open_section",
    description: "افتح قسمًا داخل التطبيق عندما يطلب المستخدم ذلك صراحة.",
    parameters: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["trip", "report", "community"],
        },
      },
      required: ["section"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "plan_trip",
    description: "جهز مشوار مشي إلى وجهة يذكرها المستخدم من نقطة التجربة داخل المدينة المنورة.",
    parameters: {
      type: "object",
      properties: {
        destination: { type: "string", description: "اسم الوجهة كما قالها المستخدم." },
        senior: { type: "boolean", description: "صحيح إذا كان المستخدم أو مرافقه كبير سن." },
        wheelchair: { type: "boolean", description: "صحيح إذا احتاج المستخدم مسارًا مناسبًا للكرسي المتحرك." },
        moreRest: { type: "boolean", description: "صحيح إذا طلب المستخدم استراحات أكثر." },
        avoidCrowds: { type: "boolean", description: "صحيح إذا طلب المستخدم تقليل الزحمة." },
      },
      required: ["destination", "senior", "wheelchair", "moreRest", "avoidCrowds"],
      additionalProperties: false,
    },
  },
] as const;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "المساعد الصوتي غير متاح الآن." }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/sdp")) {
    return NextResponse.json({ error: "تعذر بدء المحادثة." }, { status: 415 });
  }

  const sdp = await request.text();
  if (!sdp || sdp.length > 200_000) {
    return NextResponse.json({ error: "تعذر بدء المحادثة." }, { status: 400 });
  }

  const requestedProfile = request.nextUrl.searchParams.get("voice");
  const profileName: VoiceProfile = requestedProfile === "male" ? "male" : "female";
  const profile = VOICE_PROFILES[profileName];

  const session = {
    type: "realtime",
    model: "gpt-realtime-2.1",
    instructions: `${BASE_VOICE_INSTRUCTIONS}\n${profile.instruction}`,
    max_output_tokens: 220,
    output_modalities: ["audio"],
    tool_choice: "auto",
    tools,
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "ar",
          prompt: "لهجة سعودية نجدية محلية، مع أسماء أماكن المدينة المنورة مثل المسجد النبوي وقباء والقبلتين وأحد. حافظ على الكلمات العامية السعودية كما نطقها المتحدث.",
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: profile.voice,
      },
    },
  };

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(session));

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const body = await response.text();
    if (!response.ok) {
      console.error("Voice session failed", response.status, body.slice(0, 500));
      return NextResponse.json({ error: "تعذر بدء المحادثة الآن." }, { status: 502 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Voice connection error", error);
    return NextResponse.json({ error: "تعذر بدء المحادثة الآن." }, { status: 502 });
  }
}
