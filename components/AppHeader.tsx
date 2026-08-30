"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Flag, Home, Menu, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "./BrandMark";

const links = [
  { href: "/", label: "رحلتي", icon: Home },
  { href: "/community", label: "المجتمع", icon: UsersRound },
  { href: "/report", label: "بلاغ", icon: Flag },
  { href: "/city", label: "المدينة", icon: Building2 },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return ["/", "/plan", "/route", "/navigate", "/arrival"].includes(pathname);
  return pathname === href;
}

export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigationMode = pathname === "/navigate";

  return (
    <>
      <header className={`app-header ${navigationMode ? "app-header--navigation" : ""}`}>
        <div className="app-header__inner">
          <Link href="/" className="app-header__brand" onClick={() => setOpen(false)}>
            <BrandMark />
          </Link>

          <div className="mobile-scope" aria-label="نطاق التجربة">
            <span /> المدينة المنورة
          </div>

          <nav className="app-header__nav" aria-label="التنقل الرئيسي">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={isActive(pathname, link.href) ? "is-active" : ""}>
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            className="app-header__menu"
            type="button"
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open && (
          <nav className="app-header__mobile" aria-label="التنقل على الجوال">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {!navigationMode && (
        <nav className="mobile-tabbar" aria-label="التنقل الرئيسي للتطبيق">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}>
                <Icon size={21} strokeWidth={active ? 2.35 : 1.85} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
