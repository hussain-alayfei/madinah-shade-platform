export type CityPeriod = "today" | "week" | "month";
export type CityLayerId =
  | "overview"
  | "map"
  | "heat"
  | "crowding"
  | "accessibility"
  | "services"
  | "reports"
  | "interventions";

export type CitySignalCategory = "heat" | "crowding" | "accessibility" | "services";
export type InterventionStatus = "not_started" | "planned" | "in_progress" | "completed";

export type CitySignal = {
  id: string;
  title: string;
  location: string;
  category: CitySignalCategory;
  coordinates: [number, number];
  radiusMeters: number;
  priorityScore: number;
  reports: Record<CityPeriod, number>;
  verifiedRate: number;
  updatedMinutes: number;
  detail: string;
  recommendedAction: string;
  interventionStatus: InterventionStatus;
};

export type CityMetrics = {
  reportCount: number;
  highPriorityCount: number;
  activeInterventions: number;
  verifiedRate: number;
};

export type CityDashboardSnapshot = {
  period: CityPeriod;
  layer: CityLayerId;
  signals: CitySignal[];
  metrics: CityMetrics;
  generatedAt: string;
};

export const cityPeriods: { id: CityPeriod; label: string }[] = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "آخر 7 أيام" },
  { id: "month", label: "آخر 30 يومًا" },
];

export const cityLayers: { id: CityLayerId; label: string; description: string }[] = [
  { id: "overview", label: "نظرة عامة", description: "أهم الإشارات والأولويات التي تحتاج قرارًا أو متابعة." },
  { id: "map", label: "الخريطة", description: "كل نقاط المتابعة الحالية في النطاق التجريبي." },
  { id: "heat", label: "الإجهاد الحراري", description: "المواضع التي تحتاج معالجة للتعرض الحراري والراحة." },
  { id: "crowding", label: "الازدحام", description: "المواضع ذات كثافة المشاة أو الحركة المرتفعة." },
  { id: "accessibility", label: "الإتاحة", description: "ملاحظات الأرصفة والمنحدرات وسهولة الوصول." },
  { id: "services", label: "الخدمات", description: "المياه والاستراحات والخدمات الداعمة للمشاة." },
  { id: "reports", label: "البلاغات", description: "الإشارات التي وصلت بشأنها ملاحظات وتحتاج تحققًا أو متابعة." },
  { id: "interventions", label: "التدخلات", description: "الإجراءات المخططة أو الجاري تنفيذها أو المكتملة." },
];

const demoCitySignals: CitySignal[] = [
  {
    id: "salam-east-heat",
    title: "تعرض حراري مرتفع",
    location: "ممر السلام الشرقي",
    category: "heat",
    coordinates: [24.4706, 39.6121],
    radiusMeters: 95,
    priorityScore: 94,
    reports: { today: 18, week: 63, month: 211 },
    verifiedRate: 82,
    updatedMinutes: 12,
    detail: "تكررت الملاحظات في فترة الظهيرة مع انخفاض التغطية المريحة على جزء من الممر.",
    recommendedAction: "مراجعة مواقع التظليل ونقاط الاستراحة على المقطع الأكثر تعرضًا.",
    interventionStatus: "planned",
  },
  {
    id: "king-faisal-crowding",
    title: "كثافة مشاة مرتفعة",
    location: "تقاطع الملك فيصل",
    category: "crowding",
    coordinates: [24.4693, 39.6146],
    radiusMeters: 80,
    priorityScore: 88,
    reports: { today: 14, week: 41, month: 136 },
    verifiedRate: 86,
    updatedMinutes: 8,
    detail: "ترتفع كثافة الحركة في أوقات متقاربة وتؤثر على انسيابية المشاة عند التقاطع.",
    recommendedAction: "مراجعة تنظيم التدفق ومساحة الانتظار واتجاهات الحركة في ساعات الذروة.",
    interventionStatus: "in_progress",
  },
  {
    id: "south-accessibility",
    title: "ملاحظة إتاحة متكررة",
    location: "الممر الجنوبي",
    category: "accessibility",
    coordinates: [24.4682, 39.6118],
    radiusMeters: 65,
    priorityScore: 81,
    reports: { today: 7, week: 27, month: 89 },
    verifiedRate: 74,
    updatedMinutes: 31,
    detail: "توجد ملاحظات متكررة على سهولة الانتقال عند أحد المنحدرات ونقطة عبور الرصيف.",
    recommendedAction: "فحص المنحدر ميدانيًا وإغلاق الملاحظة بعد التحقق من المعالجة.",
    interventionStatus: "not_started",
  },
  {
    id: "bus-stop-services",
    title: "نقص خدمات على المسار",
    location: "محيط محطة الحافلات",
    category: "services",
    coordinates: [24.4715, 39.6151],
    radiusMeters: 60,
    priorityScore: 74,
    reports: { today: 5, week: 22, month: 71 },
    verifiedRate: 69,
    updatedMinutes: 44,
    detail: "الملاحظات تشير إلى حاجة أوضح لنقطة مياه أو استراحة قريبة من مسار المشاة.",
    recommendedAction: "تقييم موقع خدمة قريب وربطه بالمسار الأكثر استخدامًا.",
    interventionStatus: "not_started",
  },
  {
    id: "north-crowding",
    title: "تكدس متقطع عند نقطة عبور",
    location: "الممر الشمالي",
    category: "crowding",
    coordinates: [24.4721, 39.6109],
    radiusMeters: 55,
    priorityScore: 67,
    reports: { today: 3, week: 16, month: 54 },
    verifiedRate: 63,
    updatedMinutes: 57,
    detail: "الحالة ليست مستمرة، لكنها تظهر خلال فترات قصيرة وتحتاج متابعة قبل رفع الأولوية.",
    recommendedAction: "متابعة النمط خلال فترات مختلفة قبل اعتماد تدخل دائم.",
    interventionStatus: "not_started",
  },
  {
    id: "west-services",
    title: "خدمة تمت معالجتها",
    location: "الممر الغربي",
    category: "services",
    coordinates: [24.4697, 39.6098],
    radiusMeters: 48,
    priorityScore: 39,
    reports: { today: 1, week: 8, month: 33 },
    verifiedRate: 91,
    updatedMinutes: 95,
    detail: "تم تنفيذ الإجراء التجريبي وتبقى متابعة أثره على تجربة المشاة.",
    recommendedAction: "قياس الأثر ومقارنة الملاحظات قبل وبعد الإجراء.",
    interventionStatus: "completed",
  },
];

export const cityReadiness = [
  { label: "مسارات المشي", state: "متصل", note: "متاح للاستخدام في تجربة الرحلات." },
  { label: "موقع المستخدم أثناء الملاحة", state: "متاح", note: "يعمل بعد موافقة المستخدم على مشاركة الموقع." },
  { label: "الظل والحرارة والازدحام", state: "بانتظار الربط", note: "البيانات المعروضة في اللوحة تجريبية حاليًا." },
  { label: "بلاغات المجتمع المشتركة", state: "بانتظار قاعدة البيانات", note: "التخزين الحالي محلي على جهاز المستخدم." },
] as const;

export function isCityPeriod(value: string | null): value is CityPeriod {
  return value === "today" || value === "week" || value === "month";
}

export function isCityLayer(value: string | null): value is CityLayerId {
  return cityLayers.some((layer) => layer.id === value);
}

export function filterCitySignals(signals: CitySignal[], layer: CityLayerId) {
  if (layer === "overview" || layer === "map" || layer === "reports") return signals;
  if (layer === "interventions") return signals.filter((signal) => signal.interventionStatus !== "not_started");
  return signals.filter((signal) => signal.category === layer);
}

export function calculateCityMetrics(signals: CitySignal[], period: CityPeriod): CityMetrics {
  const reportCount = signals.reduce((sum, signal) => sum + signal.reports[period], 0);
  const highPriorityCount = signals.filter((signal) => signal.priorityScore >= 80).length;
  const activeInterventions = signals.filter(
    (signal) => signal.interventionStatus === "planned" || signal.interventionStatus === "in_progress",
  ).length;
  const weightedReports = Math.max(1, reportCount);
  const verifiedRate = Math.round(
    signals.reduce((sum, signal) => sum + signal.verifiedRate * signal.reports[period], 0) / weightedReports,
  );

  return { reportCount, highPriorityCount, activeInterventions, verifiedRate };
}

export function buildCityDashboardSnapshot(period: CityPeriod, layer: CityLayerId): CityDashboardSnapshot {
  const signals = filterCitySignals(demoCitySignals, layer).sort((a, b) => b.priorityScore - a.priorityScore);
  return {
    period,
    layer,
    signals,
    metrics: calculateCityMetrics(signals, period),
    generatedAt: new Date().toISOString(),
  };
}

export function interventionStatusLabel(status: InterventionStatus) {
  if (status === "planned") return "مخطط";
  if (status === "in_progress") return "جارٍ التنفيذ";
  if (status === "completed") return "مكتمل";
  return "لم يبدأ";
}

export function categoryLabel(category: CitySignalCategory) {
  if (category === "heat") return "الإجهاد الحراري";
  if (category === "crowding") return "الازدحام";
  if (category === "accessibility") return "الإتاحة";
  return "الخدمات";
}
