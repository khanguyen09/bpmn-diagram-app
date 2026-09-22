"use client";

import Link from "next/link";
import { Menu, Network, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";

const navigation = [
  { href: "/studio/diagram", label: "BPMN Studio", icon: Network },
  { href: "/studio/profile", label: "Tài khoản", icon: UserRound },
] as const;

export function isBpmnFocusWorkspacePath(pathname: string): boolean {
  return /^\/studio\/diagram\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/i.test(pathname);
}

export function Brand() {
  return <Link className="brand" href="/studio/diagram" aria-label="BPMN Studio — Thư viện quy trình">
    <span className="brand__mark" aria-hidden="true"><span /></span>
    <span><strong>BPMN Studio</strong><small>Vẽ và quản lý quy trình</small></span>
  </Link>;
}

export function SiteShell({ children, studio = false }: { children: React.ReactNode; studio?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !open) return;
      setOpen(false); menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);
  if (studio && isBpmnFocusWorkspacePath(pathname)) {
    return <main id="main-content" className="main-content main-content--focus">{children}</main>;
  }
  return <div className="app-shell">
    <header className="mobile-header">
      <Brand />
      <button ref={menuButtonRef} className="icon-button" aria-label={open ? "Đóng menu" : "Mở menu"} aria-controls="primary-navigation" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {open ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
      </button>
    </header>
    <aside id="primary-navigation" className={cn("sidebar", open && "sidebar--open")}>
      <Brand />
      <nav aria-label="Điều hướng Studio"><div className="nav-group">
        <span className="nav-group__label">Không gian làm việc</span>
        {navigation.map(({ href, label, icon: Icon }, index) => <Link key={href} href={href} className={cn("nav-link", pathname.startsWith(href) && "nav-link--active")} aria-current={pathname.startsWith(href) ? "page" : undefined} onClick={() => setOpen(false)}>
          <span className="nav-link__index">0{index + 1}</span><Icon className="nav-link__icon" size={18} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span>
        </Link>)}
      </div></nav>
      <div className="sidebar__footer"><a className="sidebar-login" href="https://github.com/khanguyen09/bpmn-diagram-app">Mã nguồn & hướng dẫn</a></div>
    </aside>
    <main id="main-content" className="main-content">{children}</main>
  </div>;
}
