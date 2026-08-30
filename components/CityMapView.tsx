"use client";
import dynamic from "next/dynamic";
const CityMapClient=dynamic(()=>import("./CityMapClient").then((mod)=>mod.CityMapClient),{ssr:false,loading:()=> <div className="map-loading">جاري تحميل بيانات المدينة…</div>});
export function CityMapView({activeLayer="نظرة عامة"}:{activeLayer?:string}){return <CityMapClient activeLayer={activeLayer}/>;}
