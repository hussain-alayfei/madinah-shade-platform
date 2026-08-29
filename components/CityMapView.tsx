"use client";
import dynamic from "next/dynamic";
const CityMapClient = dynamic(() => import("./CityMapClient").then((mod) => mod.CityMapClient), { ssr: false, loading: () => <div className="map-loading">جاري تحميل بيانات المدينة…</div> });
export function CityMapView({ focus = "overview" }: { focus?: string }) { return <CityMapClient focus={focus} />; }
