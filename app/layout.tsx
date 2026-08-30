import type { Metadata, Viewport } from "next";
import { Almarai } from "next/font/google";
import "./globals.css";
import "./animations.css";
import "./polish.css";
import "./responsive.css";
import "./enhancements.css";
import "./live-maps.css";
import "./mobile-app.css";
import "./mobile-fixes.css";
import "./map-first.css";
import "./saudi-polish.css";
import "./premium-rtl.css";
import "./status-messages.css";
import "./navigation-ux.css";
import "./voice-assistant.css";
import { AppHeader } from "@/components/AppHeader";
import { VoiceAssistant } from "@/components/VoiceAssistant";

const font = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ظل المدينة",
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
        <VoiceAssistant />
      </body>
    </html>
  );
}
