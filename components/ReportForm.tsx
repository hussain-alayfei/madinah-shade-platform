"use client";

import { Camera, CheckCircle2, MapPin, Send } from "lucide-react";
import { FormEvent, useState } from "react";

export function ReportForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="success-box" role="status">
        <CheckCircle2 size={24} />
        <h2>تم استلام البلاغ</h2>
        <p>سيظهر للمجتمع للتحقق منه قبل اعتماده ضمن بيانات المسار.</p>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="category">نوع الملاحظة</label>
          <select id="category" name="category" defaultValue="accessibility">
            <option value="accessibility">الإتاحة</option>
            <option value="shade">الظل والحرارة</option>
            <option value="crowd">الازدحام</option>
            <option value="sidewalk">الرصيف والعوائق</option>
            <option value="services">المياه والخدمات</option>
            <option value="other">أخرى</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="location">الموقع</label>
          <div style={{ position: "relative" }}>
            <MapPin size={18} style={{ position: "absolute", right: 12, top: 15, color: "#0f6b54" }} />
            <input id="location" name="location" defaultValue="موقعي الحالي" style={{ paddingRight: 39 }} />
          </div>
        </div>

        <div className="form-field form-field--full">
          <label htmlFor="title">وصف مختصر</label>
          <input id="title" name="title" placeholder="مثال: المنحدر غير صالح للاستخدام" required />
        </div>

        <div className="form-field form-field--full">
          <label htmlFor="details">التفاصيل</label>
          <textarea id="details" name="details" placeholder="اكتب ما لاحظته بشكل واضح ليسهل على الآخرين التحقق منه." required />
        </div>

        <div className="form-field form-field--full">
          <label htmlFor="photo">صورة اختيارية</label>
          <div className="planner-input">
            <Camera size={18} />
            <input id="photo" name="photo" type="file" accept="image/*" style={{ padding: 0 }} />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-action">
          <Send size={18} />
          إرسال البلاغ
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          لا تنشر معلومات شخصية أو صورًا واضحة للأشخاص.
        </span>
      </div>
    </form>
  );
}
