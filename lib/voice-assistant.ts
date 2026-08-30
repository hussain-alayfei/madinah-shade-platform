import type { PreferenceId } from "@/lib/data";

export type VoiceAssistantAction =
  | {
      type: "navigate";
      href: string;
      label: string;
    }
  | {
      type: "plan_destination";
      destination: string;
      needs: PreferenceId[];
    };

export type VoiceAssistantResponse = {
  reply: string;
  action?: VoiceAssistantAction;
};

const destinationAliases = [
  { label: "المسجد النبوي", aliases: ["المسجد النبوي", "الحرم", "الحرم النبوي"] },
  { label: "مسجد قباء", aliases: ["مسجد قباء", "قباء"] },
  { label: "مسجد القبلتين", aliases: ["مسجد القبلتين", "القبلتين"] },
  { label: "جبل أحد", aliases: ["جبل احد", "جبل أحد", "احد", "أحد"] },
  {
    label: "محطة قطار الحرمين المدينة المنورة",
    aliases: ["محطة القطار", "قطار الحرمين", "محطة قطار الحرمين"],
  },
] as const;

function normalizeArabic(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/ـ/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ");
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(normalizeArabic(term)));
}

function extractKnownDestination(message: string) {
  const normalized = normalizeArabic(message);
  for (const destination of destinationAliases) {
    if (destination.aliases.some((alias) => normalized.includes(normalizeArabic(alias)))) {
      return destination.label;
    }
  }
  return "";
}

function extractGenericDestination(message: string) {
  const patterns = [
    /(?:ود(?:ن|ّن)ي|وصلني|خذني|وجهني)\s*(?:الى|إلى|لـ|ل)?\s+(.+)/i,
    /(?:ابي|أبي|ابغى|أبغى|ابغا|أبغا)\s+(?:اروح|أروح|اذهب|أذهب)\s+(?:الى|إلى|لـ|ل)?\s*(.+)/i,
    /(?:ابي|أبي|ابغى|أبغى)\s+(?:طريق|مسار)\s+(?:الى|إلى|لـ|ل)?\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.trim().match(pattern);
    if (match?.[1]) return match[1].replace(/[؟?!.،]+$/g, "").trim();
  }
  return "";
}

function tripNeeds(message: string): PreferenceId[] {
  const normalized = normalizeArabic(message);
  const needs = new Set<PreferenceId>(["shade", "rest", "lowCrowd"]);

  if (includesAny(normalized, ["كبير سن", "كبار السن", "والدي", "والدتي", "مسن", "مسنة"])) {
    needs.add("senior");
  }
  if (includesAny(normalized, ["كرسي متحرك", "ويل تشير", "منحدر", "ذوي الاعاقة", "ذوي الإعاقة"])) {
    needs.add("wheelchair");
  }

  return [...needs];
}

export function buildVoiceAssistantResponse(message: string): VoiceAssistantResponse {
  const normalized = normalizeArabic(message);

  if (!normalized) {
    return { reply: "ما سمعت طلب واضح. قل لي وجهتك، أو قل: افتح البلاغ، المجتمع، أو لوحة المدينة." };
  }

  if (includesAny(normalized, ["السلام عليكم", "هلا", "مرحبا", "اهلين", "أهلين"])) {
    return {
      reply: "وعليكم السلام، حياك. أنا مساعد ظل المدينة. قل لي وين تبي تروح، أو وش تبي أفتح لك.",
    };
  }

  if (includesAny(normalized, ["وش تقدر", "ساعدني", "مساعدة", "وش اسوي", "وش أسوي", "كيف استخدم"])) {
    return {
      reply:
        "أبشر. أقدر أجهز لك مشوار لمكان داخل المدينة، أو أفتح البلاغ، المجتمع، أو لوحة المدينة. جرب تقول: ودني للمسجد النبوي.",
    };
  }

  if (includesAny(normalized, ["بلاغ", "ابلغ", "أبلغ", "بلغ عن", "مشكلة في الطريق"])) {
    return {
      reply: "أبشر، بفتح لك صفحة البلاغ عشان تسجل الملاحظة بسهولة.",
      action: { type: "navigate", href: "/report", label: "البلاغ" },
    };
  }

  if (includesAny(normalized, ["المجتمع", "مساهمات", "مشاركة المجتمع"])) {
    return {
      reply: "تم، بفتح لك صفحة المجتمع والمساهمات.",
      action: { type: "navigate", href: "/community", label: "المجتمع" },
    };
  }

  if (includesAny(normalized, ["لوحة المدينة", "المدينة", "ازدحام", "حرارة", "اجهاد حراري", "إجهاد حراري"])) {
    return {
      reply: "أبشر، بفتح لك لوحة المدينة. تذكر إن بيانات الحرارة والازدحام فيها تجريبية حاليًا لين يتم ربط المصادر الحية.",
      action: { type: "navigate", href: "/city", label: "لوحة المدينة" },
    };
  }

  if (includesAny(normalized, ["الرئيسية", "مشواري", "ابدأ مشوار", "أبدأ مشوار", "رحلة جديدة"])) {
    return {
      reply: "تم، برجعك لمشواري عشان تبدأ رحلة جديدة.",
      action: { type: "navigate", href: "/", label: "مشواري" },
    };
  }

  const destination = extractKnownDestination(message) || extractGenericDestination(message);
  if (destination) {
    return {
      reply: `أبشر. بجهز لك طريق مريح إلى ${destination}، وبراعي الظل والاستراحة وتقليل الزحمة قدر الإمكان.`,
      action: {
        type: "plan_destination",
        destination,
        needs: tripNeeds(message),
      },
    };
  }

  return {
    reply:
      "حاليًا أقدر أساعدك داخل ظل المدينة: تخطيط مشوار، فتح بلاغ، المجتمع، أو لوحة المدينة. إذا ربطنا الـAPI لاحقًا أقدر أجاوبك بشكل أوسع.",
  };
}
