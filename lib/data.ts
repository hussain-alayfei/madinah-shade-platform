export const departureOptions = ["الآن", "5:00 م", "6:00 م"] as const;
export type DepartureTime = (typeof departureOptions)[number];

export type PreferenceId = "wheelchair" | "senior" | "shade" | "lowCrowd" | "rest";

export const travelPreferences: { id: PreferenceId; label: string; description: string }[] = [
  { id: "wheelchair", label: "مسار مهيأ للكرسي المتحرك", description: "تجنب المسارات ذات الإتاحة المحدودة." },
  { id: "senior", label: "مناسب لكبار السن", description: "أفضلية للظل والاستراحات والإجهاد الأقل." },
  { id: "shade", label: "أفضل ظل ممكن", description: "رفع أولوية المسارات ذات التغطية الأعلى." },
  { id: "lowCrowd", label: "تجنب الازدحام", description: "رفع أولوية المسارات الأقل كثافة." },
  { id: "rest", label: "استراحات وخدمات أكثر", description: "أفضلية للمياه ومواقع الاستراحة." },
];

export type RouteOption = {
  id: string;
  name: string;
  description: string;
  duration: number;
  distance: number;
  comfort: number;
  shade: number;
  heat: "منخفض" | "متوسط" | "مرتفع";
  crowd: "منخفض" | "متوسط" | "مرتفع";
  accessible: boolean;
  waterStops: number;
  restStops: number;
  tone: "comfort" | "balanced" | "fast" | "heritage";
  timeComfort: Record<DepartureTime, number>;
};

export const routeOptions: RouteOption[] = [
  {
    id: "comfortable",
    name: "المسار الأريح",
    description: "ظل أكثر وازدحام أقل مع خدمات قريبة على امتداد الطريق.",
    duration: 14,
    distance: 980,
    comfort: 92,
    shade: 86,
    heat: "منخفض",
    crowd: "منخفض",
    accessible: true,
    waterStops: 2,
    restStops: 2,
    tone: "comfort",
    timeComfort: { "الآن": 82, "5:00 م": 92, "6:00 م": 89 },
  },
  {
    id: "balanced",
    name: "المسار المتوازن",
    description: "توازن بين زمن الوصول والراحة مع تغطية ظل جيدة.",
    duration: 12,
    distance: 860,
    comfort: 83,
    shade: 72,
    heat: "متوسط",
    crowd: "متوسط",
    accessible: true,
    waterStops: 1,
    restStops: 1,
    tone: "balanced",
    timeComfort: { "الآن": 74, "5:00 م": 86, "6:00 م": 83 },
  },
  {
    id: "fastest",
    name: "المسار الأسرع",
    description: "أقصر زمن وصول، لكنه أكثر تعرضًا للشمس والحركة.",
    duration: 10,
    distance: 760,
    comfort: 66,
    shade: 44,
    heat: "مرتفع",
    crowd: "متوسط",
    accessible: false,
    waterStops: 1,
    restStops: 0,
    tone: "fast",
    timeComfort: { "الآن": 58, "5:00 م": 72, "6:00 م": 69 },
  },
  {
    id: "heritage",
    name: "المسار الأثرى",
    description: "يمر بنقاط ذات قيمة تاريخية وحضرية مع وقت رحلة أطول قليلًا.",
    duration: 18,
    distance: 1220,
    comfort: 80,
    shade: 69,
    heat: "متوسط",
    crowd: "منخفض",
    accessible: true,
    waterStops: 2,
    restStops: 2,
    tone: "heritage",
    timeComfort: { "الآن": 70, "5:00 م": 84, "6:00 م": 80 },
  },
];

export function parseDepartureTime(value: string | null): DepartureTime {
  return departureOptions.includes(value as DepartureTime) ? (value as DepartureTime) : "الآن";
}

export function parsePreferences(value: string | null): PreferenceId[] {
  if (!value) return [];
  const allowed = new Set(travelPreferences.map((item) => item.id));
  return value.split(",").filter((item): item is PreferenceId => allowed.has(item as PreferenceId));
}

export function routeScore(route: RouteOption, needs: PreferenceId[], time: DepartureTime) {
  let score = route.timeComfort[time];

  if (needs.includes("wheelchair")) score += route.accessible ? 18 : -70;
  if (needs.includes("senior")) {
    score += route.restStops * 5 + route.waterStops * 2 + route.shade * 0.05;
    if (route.heat === "مرتفع") score -= 14;
  }
  if (needs.includes("shade")) score += route.shade * 0.12;
  if (needs.includes("lowCrowd")) score += route.crowd === "منخفض" ? 12 : route.crowd === "متوسط" ? 2 : -14;
  if (needs.includes("rest")) score += route.restStops * 7 + route.waterStops * 3;

  return Math.round(score * 10) / 10;
}

export function recommendationReasons(route: RouteOption, needs: PreferenceId[]) {
  const reasons: string[] = [];

  if (needs.includes("wheelchair") && route.accessible) reasons.push("إتاحة مناسبة");
  if (needs.includes("senior") && route.restStops > 0) reasons.push(`${route.restStops} استراحة`);
  if (needs.includes("shade")) reasons.push(`ظل ${route.shade}%`);
  if (needs.includes("lowCrowd") && route.crowd === "منخفض") reasons.push("ازدحام منخفض");
  if (needs.includes("rest") && route.waterStops > 0) reasons.push(`${route.waterStops} مياه`);

  if (reasons.length === 0) {
    if (route.shade >= 80) reasons.push(`ظل ${route.shade}%`);
    if (route.crowd === "منخفض") reasons.push("ازدحام منخفض");
    if (route.accessible) reasons.push("إتاحة جيدة");
  }

  return reasons.slice(0, 2);
}

export function bestDeparture(route: RouteOption): { time: DepartureTime; score: number } {
  return departureOptions
    .map((time) => ({ time, score: route.timeComfort[time] }))
    .sort((a, b) => b.score - a.score)[0];
}

export const medinaRoutes = {
  comfortable: [
    [24.47085, 39.61015],
    [24.46995, 39.6116],
    [24.46925, 39.6131],
    [24.46855, 39.61485],
    [24.46775, 39.61645],
  ] as [number, number][],
  balanced: [
    [24.47085, 39.61015],
    [24.4701, 39.61215],
    [24.4691, 39.6141],
    [24.46775, 39.61645],
  ] as [number, number][],
  fastest: [
    [24.47085, 39.61015],
    [24.46965, 39.6129],
    [24.46875, 39.61455],
    [24.46775, 39.61645],
  ] as [number, number][],
  heritage: [
    [24.47085, 39.61015],
    [24.47135, 39.6124],
    [24.4704, 39.6148],
    [24.46935, 39.61655],
    [24.46775, 39.61645],
  ] as [number, number][],
};

export const communityReports = [
  {
    id: 1,
    category: "الإتاحة",
    title: "منحدر الرصيف يحتاج صيانة",
    location: "طريق الملك فيصل",
    time: "منذ 24 دقيقة",
    confirmations: 18,
    status: "قيد التحقق",
  },
  {
    id: 2,
    category: "الخدمات",
    title: "نقطة مياه غير متاحة حاليًا",
    location: "قرب الساحة الجنوبية",
    time: "منذ 51 دقيقة",
    confirmations: 11,
    status: "مؤكد",
  },
  {
    id: 3,
    category: "الازدحام",
    title: "كثافة مشاة مرتفعة عند التقاطع",
    location: "شارع السلام",
    time: "منذ ساعة",
    confirmations: 31,
    status: "مؤكد",
  },
];

export const cityPriorities = [
  { name: "ممر السلام الشرقي", issue: "تعرض حراري", score: 94, reports: 63 },
  { name: "تقاطع الملك فيصل", issue: "ازدحام", score: 88, reports: 41 },
  { name: "الممر الجنوبي", issue: "إتاحة", score: 81, reports: 27 },
  { name: "محيط محطة الحافلات", issue: "نقص خدمات", score: 74, reports: 22 },
];
