import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import "./animations.css";
import "./polish.css";
import "./responsive.css";
import "./enhancements.css";
import "./live-maps.css";
import "./mobile-app.css";
import "./mobile-fixes.css";
import { AppHeader } from "@/components/AppHeader";

const font = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ظل المدينة | مسارات أريح للمشي",
  description: "تجربة ملاحة حضرية للمشي داخل المدينة المنورة.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ظل المدينة",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f6f1",
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
