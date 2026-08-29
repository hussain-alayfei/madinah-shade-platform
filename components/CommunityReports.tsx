"use client";

import { Check, MapPin } from "lucide-react";
import { useState } from "react";
import { communityReports } from "@/lib/data";

export function CommunityReports() {
  const [verified, setVerified] = useState<number[]>([]);

  function toggle(id: number) {
    setVerified((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="report-list">
      {communityReports.map((report) => {
        const isVerified = verified.includes(report.id);
        return (
          <article className="report-row" key={report.id}>
            <div>
              <div className="report-row__meta">
                <span className="status-tag">{report.category}</span>
                <span>{report.status}</span>
                <span>·</span>
                <span>{report.time}</span>
              </div>
              <h3>{report.title}</h3>
              <p><MapPin size={14} style={{ verticalAlign: "middle", marginLeft: 5 }} />{report.location}</p>
            </div>

            <button
              type="button"
              className={`verify-button ${isVerified ? "is-verified" : ""}`}
              onClick={() => toggle(report.id)}
            >
              {isVerified ? <><Check size={15} /> تم التأكيد</> : `أؤكد · ${report.confirmations}`}
            </button>
          </article>
        );
      })}
    </div>
  );
}
