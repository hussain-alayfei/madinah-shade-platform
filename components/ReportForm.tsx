"use client";

import { Camera, CheckCircle2, LocateFixed, MapPin, Send } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { getBrowserLocation, reverseGeocode } from "@/lib/maps";
import { fileToDataUrl, saveStoredReport } from "@/lib/storage";

const categoryLabels: Record<string, string> = {
  accessibility: "الإتاحة", shade: "الظل والحرارة", crowd: "الازدحام", sidewalk: "الرصيف والعوائق", services: "المياه والخدمات", other: "أخرى",
};

export function ReportForm() {
  const [submitted, setSubmitted] = useState(false);
  const [locationText, setLocationText] = useState("موقعي الحالي");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [error, setError] = useState("");

  async function locate() {
    setLocating(true); setError("");
    try {
      const fix = await getBrowserLocation();
      setCoords({ lat: fix.lat, lon: fix.lon });
      const result = await reverseGeocode(fix.lat, fix.lon);
      setLocationText(result.label);
    } catch (locationError) { setError((locationError as Error).message); }
    finally { setLocating(false); }
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { setPhoto(null); return; }
    setError("");
    try { setPhoto({ name: file.name, dataUrl: await fileToDataUrl(file) }); }
    catch (photoError) { event.target.value = ""; setPhoto(null); setError((photoError as Error).message); }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = new FormData(event.currentTarget);
    const category = String(data.get("category") || "other");
    const title = String(data.get("title") || "").trim();
    const details = String(data.get("details") || "").trim();
    if (!title || !details) { setError("اكتب وصفًا مختصرًا وتفاصيل البلاغ."); return; }
    saveStoredReport({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, category: categoryLabels[category] || "أخرى", title, details, location: locationText.trim() || "موقع غير محدد", lat: coords?.lat ?? null, lon: coords?.lon ?? null, createdAt: new Date().toISOString(), photoName: photo?.name || null, photoDataUrl: photo?.dataUrl || null });
    setSubmitted(true);
  }

  if (submitted) return <div className="success-box" role="status"><CheckCircle2 size={24} /><h2>تم حفظ البلاغ</h2><p>البلاغ محفوظ على هذا الجهاز ويظهر الآن في صفحة المجتمع. الربط المشترك بين جميع المستخدمين يحتاج قاعدة بيانات خاصة بالمشروع.</p></div>;

  return <form className="form-card" onSubmit={handleSubmit}>
    <div className="form-grid">
      <div className="form-field"><label htmlFor="category">نوع الملاحظة</label><select id="category" name="category" defaultValue="accessibility"><option value="accessibility">الإتاحة</option><option value="shade">الظل والحرارة</option><option value="crowd">الازدحام</option><option value="sidewalk">الرصيف والعوائق</option><option value="services">المياه والخدمات</option><option value="other">أخرى</option></select></div>
      <div className="form-field"><div className="planner-label-row"><label htmlFor="location">الموقع</label><button type="button" className="inline-location-action" onClick={locate} disabled={locating}><LocateFixed size={14} /> {locating ? "جاري التحديد…" : coords ? "GPS محدد" : "تحديد GPS"}</button></div><div style={{ position: "relative" }}><MapPin size={18} style={{ position: "absolute", right: 12, top: 15, color: "#0f6b54" }} /><input id="location" name="location" value={locationText} onChange={(event) => { setLocationText(event.target.value); setCoords(null); }} style={{ paddingRight: 39 }} /></div>{coords && <small className="field-help">{coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}</small>}</div>
      <div className="form-field form-field--full"><label htmlFor="title">وصف مختصر</label><input id="title" name="title" placeholder="مثال: المنحدر غير صالح للاستخدام" required /></div>
      <div className="form-field form-field--full"><label htmlFor="details">التفاصيل</label><textarea id="details" name="details" placeholder="اكتب ما لاحظته بشكل واضح ليسهل على الآخرين التحقق منه." required /></div>
      <div className="form-field form-field--full"><label htmlFor="photo">صورة اختيارية</label><div className="planner-input"><Camera size={18} /><input id="photo" name="photo" type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ padding: 0 }} /></div>{photo && <small className="field-help">تم تجهيز الصورة محليًا: {photo.name}</small>}</div>
    </div>
    {error && <div className="planner-status is-error" role="alert">{error}</div>}
    <div className="form-actions"><button type="submit" className="primary-action"><Send size={18} />إرسال البلاغ</button><span className="muted" style={{ fontSize: 12 }}>لا تنشر معلومات شخصية أو صورًا واضحة للأشخاص.</span></div>
  </form>;
}
