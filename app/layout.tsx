import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import "./animations.css";
import "./polish.css";
import { AppHeader } from "@/components/AppHeader";

const font = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ظل المدينة | مسارات أريح للمشي",
  description: "منصة ملاحة حضرية تقترح المسارات الأنسب للمشي حسب الظل والحرارة والازدحام والإتاحة والخدمات.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={font.className}>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
