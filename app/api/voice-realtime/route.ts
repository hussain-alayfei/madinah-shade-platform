import { NextRequest, NextResponse } from "next/server";

const SAUDI_VOICE_INSTRUCTIONS = `
أنت المساعد الصوتي لتطبيق "ظل المدينة" في المدينة المنورة.
المستخدمون الأساسيون يشملون كبار السن والمكفوفين وضعاف البصر، لذلك تكلم بوضوح وبهدوء وبجمل قصيرة.
استخدم لهجة سعودية طبيعية ومحترمة وبسيطة، مثل: أبشر، حياك، تم، وين تبي تروح، لكن بدون مبالغة أو تصنع.
لا تستخدم لهجات عربية أخرى إذا كان بإمكانك التعبير باللهجة السعودية.
إذا لم تفهم اسم مكان، اسأل سؤال توضيحي واحد فقط ولا تخمن.
إذا كان المستخدم يطلب مسار مشي، ذكّره أن ظل المدينة يوازن بين الظل والحرارة والازدحام والإتاحة والخدمات، ولا تدّع أن بيانات الحرارة أو الازدحام حية إذا لم تكن موصولة.
لا تعطِ تعليمات ملاحية خطرة أو تدّعي معرفة موقع المستخدم ما لم يذكره أو يشاركه التطبيق.
اجعل الرد الصوتي غالبًا من جملة إلى ثلاث جمل، وابدأ بالمعلومة الأهم.
`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { code: "VOICE_API_NOT_CONFIGURED", error: "المحادثة الحية جاهزة وتحتاج فقط مفتاح الـAPI على السيرفر." },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/sdp")) {
    return NextResponse.json({ error: "نوع طلب الصوت غير صحيح." }, { status: 415 });
  }

  const sdp = await request.text();
  if (!sdp || sdp.length > 200_000) {
    return NextResponse.json({ error: "بيانات الاتصال الصوتي غير صالحة." }, { status: 400 });
  }

  const session = {
    type: "realtime",
    model: "gpt-realtime-2.1",
    instructions: SAUDI_VOICE_INSTRUCTIONS,
    reasoning: { effort: "low" },
    audio: {
      output: { voice: "marin" },
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
      console.error("Realtime voice session failed", response.status, body.slice(0, 500));
      return NextResponse.json(
        { error: "تعذر بدء المحادثة الصوتية الحية الآن." },
        { status: response.status >= 500 ? 502 : 400 },
      );
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Realtime voice bridge error", error);
    return NextResponse.json({ error: "تعذر الاتصال بخدمة الصوت الآن." }, { status: 502 });
  }
}
