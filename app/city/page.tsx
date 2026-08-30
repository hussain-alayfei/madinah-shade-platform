"use client";

import {
  Accessibility,
  AlertTriangle,
  BarChart3,
  Droplets,
  Footprints,
  Layers3,
  Map,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CityMapView } from "@/components/CityMapView";
import {
  calculateCityMetrics,
  categoryLabel,
  cityLayers,
  cityPeriods,
  cityReadiness,
  interventionStatusLabel,
  type CityDashboardSnapshot,
  type CityLayerId,
  type CityPeriod,
  type InterventionStatus,
} from "@/lib/city-dashboard";
import styles from "./CityDashboard.module.css";

const INTERVENTIONS_KEY = "madinah-shade-city-interventions-v1";
const REPORTS_KEY = "madinah-shade-reports-v1";

const layerIcons: Record<CityLayerId, LucideIcon> = {
  overview: BarChart3,
  map: Map,
  heat: Footprints,
  crowding: UsersRound,
  accessibility: Accessibility,
  services: Droplets,
  reports: AlertTriangle,
  interventions: Layers3,
};

function formatUpdated(minutes: number) {
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.round(minutes / 60);
  return `منذ ${hours} س`;
}

export default function CityDashboardPage() {
  const [activeLayer, setActiveLayer] = useState<CityLayerId>("overview");
  const [period, setPeriod] = useState<CityPeriod>("today");
  const [snapshot, setSnapshot] = useState<CityDashboardSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [interventionOverrides, setInterventionOverrides] = useState<Record<string, InterventionStatus>>({});
  const [localReportCount, setLocalReportCount] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(INTERVENTIONS_KEY) || "{}") as Record<string, InterventionStatus>;
      setInterventionOverrides(saved);
    } catch {
      setInterventionOverrides({});
    }

    try {
      const reports = JSON.parse(window.localStorage.getItem(REPORTS_KEY) || "[]") as unknown[];
      setLocalReportCount(Array.isArray(reports) ? reports.length : 0);
    } catch {
      setLocalReportCount(0);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    // Until intervention state lives in the shared database, request the full
    // candidate set for this view and apply the locally saved status afterwards.
    const apiLayer = activeLayer === "interventions" ? "overview" : activeLayer;

    fetch(`/api/city?period=${period}&layer=${apiLayer}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("تعذر تحميل بيانات اللوحة الآن.");
        return (await response.json()) as { snapshot?: CityDashboardSnapshot };
      })
      .then((payload) => {
        if (!payload.snapshot) throw new Error("بيانات اللوحة غير مكتملة.");
        setSnapshot(payload.snapshot);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "تعذر تحميل بيانات اللوحة الآن.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [activeLayer, period, reloadToken]);

  const signals = useMemo(() => {
    const merged = (snapshot?.signals || []).map((signal) => ({
      ...signal,
      interventionStatus: interventionOverrides[signal.id] || signal.interventionStatus,
    }));

    return activeLayer === "interventions"
      ? merged.filter((signal) => signal.interventionStatus !== "not_started")
      : merged;
  }, [snapshot, interventionOverrides, activeLayer]);

  const metrics = useMemo(() => calculateCityMetrics(signals, period), [signals, period]);

  useEffect(() => {
    if (!signals.length) {
      setSelectedId(undefined);
      return;
    }
    if (!selectedId || !signals.some((signal) => signal.id === selectedId)) {
      setSelectedId(signals[0].id);
    }
  }, [selectedId, signals]);

  const selectedSignal = signals.find((signal) => signal.id === selectedId);
  const activeLayerMeta = cityLayers.find((layer) => layer.id === activeLayer) || cityLayers[0];

  function changeLayer(layer: CityLayerId) {
    setSelectedId(undefined);
    setActiveLayer(layer);
  }

  function updateIntervention(signalId: string, status: InterventionStatus) {
    setInterventionOverrides((current) => {
      const next = { ...current, [signalId]: status };
      try {
        window.localStorage.setItem(INTERVENTIONS_KEY, JSON.stringify(next));
      } catch {
        // The UI still updates for this session if local storage is unavailable.
      }
      return next;
    });
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <span>للجهات وصانع القرار</span>
          <h1>لوحة المدينة</h1>
          <p>من الخريطة إلى الأولوية ثم الإجراء، في شاشة واحدة.</p>
        </header>

        <nav className={styles.nav} aria-label="أقسام لوحة المدينة">
          {cityLayers.map((layer) => {
            const Icon = layerIcons[layer.id];
            return (
              <button
                key={layer.id}
                type="button"
                className={activeLayer === layer.id ? styles.active : ""}
                aria-current={activeLayer === layer.id ? "page" : undefined}
                onClick={() => changeLayer(layer.id)}
              >
                <Icon size={17} />
                {layer.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarCopy}>
            <h2>{activeLayerMeta.label}</h2>
            <p>{activeLayerMeta.description}</p>
          </div>

          <label className={styles.periodField}>
            الفترة
            <select value={period} onChange={(event) => setPeriod(event.target.value as CityPeriod)}>
              {cityPeriods.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
        </header>

        <div className={styles.demoNote}>
          اللوحة جاهزة للربط بقاعدة البيانات، والبيانات المعروضة حاليًا تجريبية لاختبار رحلة القرار والواجهات.
          {localReportCount > 0 ? ` لديك ${localReportCount} بلاغ محفوظ محليًا على هذا الجهاز بانتظار الربط المشترك.` : ""}
        </div>

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
            <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
              <RefreshCw size={13} /> إعادة المحاولة
            </button>
          </div>
        )}

        <section className={styles.metrics} aria-label="مؤشرات اللوحة الحالية">
          <div className={styles.metric}><span>الملاحظات</span><strong>{metrics.reportCount}</strong></div>
          <div className={styles.metric}><span>أولوية عالية</span><strong>{metrics.highPriorityCount}</strong></div>
          <div className={styles.metric}><span>تدخلات نشطة</span><strong>{metrics.activeInterventions}</strong></div>
          <div className={styles.metric}><span>نسبة التحقق</span><strong>{metrics.verifiedRate}%</strong></div>
        </section>

        {loading && !snapshot ? (
          <div className={styles.loading}>جاري تجهيز حالة المدينة…</div>
        ) : (
          <>
            <section className={styles.workspace} aria-label="خريطة وتفاصيل المتابعة">
              <div className={styles.mapPanel}>
                <div className="map-frame">
                  <CityMapView signals={signals} selectedId={selectedId} onSelect={setSelectedId} />
                </div>
              </div>

              <aside className={styles.detailPanel} aria-live="polite">
                {selectedSignal ? (
                  <>
                    <header className={styles.detailHeader}>
                      <small>{categoryLabel(selectedSignal.category)} · {formatUpdated(selectedSignal.updatedMinutes)}</small>
                      <h3>{selectedSignal.title}</h3>
                      <p>{selectedSignal.location}</p>
                    </header>

                    <div className={styles.priorityLine}>
                      <span>درجة الأولوية</span>
                      <strong>{selectedSignal.priorityScore}</strong>
                    </div>

                    <dl className={styles.detailFacts}>
                      <div><dt>الملاحظات في الفترة</dt><dd>{selectedSignal.reports[period]}</dd></div>
                      <div><dt>تم التحقق</dt><dd>{selectedSignal.verifiedRate}%</dd></div>
                      <div><dt>حالة التدخل</dt><dd>{interventionStatusLabel(selectedSignal.interventionStatus)}</dd></div>
                    </dl>

                    <div className={styles.detailText}>
                      <span>ما الذي نعرفه؟</span>
                      <p>{selectedSignal.detail}</p>
                    </div>

                    <div className={styles.detailText}>
                      <span>الإجراء المقترح</span>
                      <p>{selectedSignal.recommendedAction}</p>
                    </div>

                    <div className={styles.interventionField}>
                      <label htmlFor="intervention-status">حالة التدخل</label>
                      <select
                        id="intervention-status"
                        value={selectedSignal.interventionStatus}
                        onChange={(event) => updateIntervention(selectedSignal.id, event.target.value as InterventionStatus)}
                      >
                        <option value="not_started">لم يبدأ</option>
                        <option value="planned">مخطط</option>
                        <option value="in_progress">جارٍ التنفيذ</option>
                        <option value="completed">مكتمل</option>
                      </select>
                      <small>يُحفظ هذا التغيير على جهازك الآن. لاحقًا سيذهب لنفس عقد الـAPI عند ربط قاعدة البيانات.</small>
                    </div>
                  </>
                ) : (
                  <div className={styles.detailEmpty}>
                    <strong>لا توجد نقطة محددة</strong>
                    <span>اختر نقطة من الخريطة أو القائمة.</span>
                  </div>
                )}
              </aside>
            </section>

            <section className={styles.listSection}>
              <div className={styles.sectionHeader}>
                <h3>{activeLayer === "interventions" ? "التدخلات الحالية" : "الأولويات الظاهرة"}</h3>
                <span>{signals.length} نقاط</span>
              </div>

              {signals.length ? (
                <div className={styles.signalList}>
                  {signals.map((signal) => (
                    <button
                      type="button"
                      key={signal.id}
                      className={`${styles.signalRow} ${selectedId === signal.id ? styles.selected : ""}`}
                      onClick={() => setSelectedId(signal.id)}
                    >
                      <div className={styles.signalCopy}>
                        <strong>{signal.title}</strong>
                        <span>{signal.location} · {categoryLabel(signal.category)} · {interventionStatusLabel(signal.interventionStatus)}</span>
                      </div>
                      <div className={styles.signalMeta}>
                        <strong>{signal.priorityScore}</strong>
                        <span>{signal.reports[period]} ملاحظة</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>لا توجد نقاط في هذا القسم خلال العرض الحالي.</div>
              )}
            </section>
          </>
        )}

        <details className={styles.readiness}>
          <summary>جاهزية مصادر البيانات</summary>
          <div className={styles.readinessGrid}>
            {cityReadiness.map((item) => (
              <div className={styles.readinessRow} key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.state}</span>
                <span>{item.note}</span>
              </div>
            ))}
          </div>
        </details>
      </section>
    </main>
  );
}
