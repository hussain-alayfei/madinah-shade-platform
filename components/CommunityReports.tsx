"use client";

import { Check, Image as ImageIcon, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { communityReports } from "@/lib/data";
import { readStoredReports, readVerifiedReports, saveVerifiedReports, type StoredReport } from "@/lib/storage";

function localTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "حديثًا";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${Math.round(hours / 24)} يوم`;
}

export function CommunityReports() {
  const [localReports, setLocalReports] = useState<StoredReport[]>([]);
  const [verified, setVerified] = useState<string[]>([]);
  useEffect(() => {
    const load = () => setLocalReports(readStoredReports());
    load(); setVerified(readVerifiedReports());
    window.addEventListener("madinah-shade:reports-updated", load); window.addEventListener("storage", load);
    return () => { window.removeEventListener("madinah-shade:reports-updated", load); window.removeEventListener("storage", load); };
  }, []);
  const reports = useMemo(() => {
    const locals = localReports.map((report) => ({ id: report.id, category: report.category, title: report.title, location: report.location, time: localTime(report.createdAt), confirmations: 0, status: "من هذا الجهاز", local: true, photoDataUrl: report.photoDataUrl || null }));
    const demo = communityReports.map((report) => ({ ...report, id: `demo-${report.id}`, local: false, photoDataUrl: null as string | null }));
    return [...locals, ...demo];
  }, [localReports]);
  function toggle(id: string) { setVerified((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; saveVerifiedReports(next); return next; }); }
  return <div className="report-list">
    {reports.length === 0 && <div className="empty-state">لا توجد بلاغات على هذا الجهاز حتى الآن.</div>}
    {reports.map((report) => { const isVerified = verified.includes(String(report.id)); const confirmations = report.confirmations + (isVerified ? 1 : 0); return <article className="report-row" key={report.id}><div><div className="report-row__meta"><span className="status-tag">{report.category}</span><span>{report.status}</span><span>·</span><span>{report.time}</span></div><h3>{report.title}</h3><p><MapPin size={14} style={{ verticalAlign: "middle", marginLeft: 5 }} />{report.location}</p>{report.photoDataUrl && <a href={report.photoDataUrl} target="_blank" rel="noreferrer" className="report-photo-link"><ImageIcon size={14} /> عرض الصورة المرفقة</a>}</div><button type="button" className={`verify-button ${isVerified ? "is-verified" : ""}`} onClick={() => toggle(String(report.id))} aria-pressed={isVerified}>{isVerified ? <><Check size={15} /> تم التأكيد · {confirmations}</> : `أؤكد · ${confirmations}`}</button></article>; })}
    <p className="community-storage-note">البلاغات الجديدة والتأكيدات في هذه النسخة تُحفظ على جهازك فقط. البيانات التجريبية المسبقة مميزة عن بلاغاتك المحلية.</p>
  </div>;
}
