import { ReportForm } from "@/components/ReportForm";

export default function ReportPage() {
  return (
    <main className="content-shell content-shell--narrow">
      <div className="page-title">
        <h1>أرسل ملاحظة عن المسار</h1>
        <p>ساعد في تحديث حالة المسارات والخدمات. الملاحظات تمر بمرحلة تحقق مجتمعي قبل أن تدخل ضمن البيانات المعتمدة.</p>
      </div>
      <ReportForm />
    </main>
  );
}
