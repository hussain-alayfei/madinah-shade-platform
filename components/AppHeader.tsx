"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "./BrandMark";

const links = [
  { href: "/", label: "الرحلة" },
  { href: "/community", label: "المجتمع" },
  { href: "/report", label: "إرسال بلاغ" },
  { href: "/city", label: "لوحة المدينة" },
];

export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link href="/" className="app-header__brand" onClick={() => setOpen(false)}>
          <BrandMark />
        </Link>

        <nav className="app-header__nav" aria-label="التنقل الرئيسي">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" || pathname === "/plan" || pathname === "/navigate" : pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={active ? "is-active" : ""}>
                {link.label}
              </Link>
            );
          })}
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
  );
}
