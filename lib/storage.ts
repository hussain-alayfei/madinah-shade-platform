export type StoredReport = {
  id: string;
  category: string;
  title: string;
  details: string;
  location: string;
  lat?: number | null;
  lon?: number | null;
  createdAt: string;
  photoName?: string | null;
  photoDataUrl?: string | null;
};

const REPORTS_KEY = "madinah-shade:reports:v1";
const VERIFIED_KEY = "madinah-shade:verified:v1";

export function readStoredReports(): StoredReport[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(REPORTS_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveStoredReport(report: StoredReport) {
  if (typeof window === "undefined") return;
  const reports = readStoredReports();
  window.localStorage.setItem(REPORTS_KEY, JSON.stringify([report, ...reports].slice(0, 30)));
  window.dispatchEvent(new Event("madinah-shade:reports-updated"));
}

export function readVerifiedReports(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(VERIFIED_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
}

export function saveVerifiedReports(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VERIFIED_KEY, JSON.stringify(ids));
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 1_500_000) {
      reject(new Error("الصورة أكبر من 1.5MB. اختر صورة أصغر في هذه النسخة المحلية."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));
    reader.readAsDataURL(file);
  });
}
