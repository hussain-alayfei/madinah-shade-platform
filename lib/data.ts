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
  },
];

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
