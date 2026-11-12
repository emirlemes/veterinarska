import Link from "next/link";
import type { ReactNode } from "react";
import type { Role } from "@prisma/client";
import { LogoutButton } from "./logout-button";
import { MobileNavigation, type MobileNavigationItem } from "./mobile-navigation";
import { hasPermission } from "@/lib/auth/permissions";

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  VETERINARIAN: "Veterinar",
};

export function DashboardShell({
  children,
  name,
  role,
  activeSection,
}: {
  children: ReactNode;
  name: string;
  role: Role;
  activeSection: "dashboard" | "clients" | "animals" | "appointments" | "examinations" | "inventory" | "invoices" | "reports" | "inventory-report" | "services" | "employees" | "settings";
}) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("bs-BA");
  const primaryMobileItems: MobileNavigationItem[] = [
    { href: "/dashboard", label: "Pregled", glyph: "⌂", active: activeSection === "dashboard" },
    ...(hasPermission(role, "appointments:read")
      ? [{ href: "/appointments", label: "Termini", glyph: "▦", active: activeSection === "appointments" }]
      : []),
    ...(hasPermission(role, "examinations:read")
      ? [{ href: "/examinations", label: "Pregledi", glyph: "✚", active: activeSection === "examinations" }]
      : []),
    ...(hasPermission(role, "clients:read")
      ? [{ href: "/clients", label: "Klijenti", glyph: "◎", active: activeSection === "clients" }]
      : []),
    ...(hasPermission(role, "animals:read")
      ? [{ href: "/animals", label: "Životinje", glyph: "◉", active: activeSection === "animals" }]
      : []),
  ];
  const moreMobileItems: MobileNavigationItem[] = [
    ...(hasPermission(role, "medications:read")
      ? [{ href: "/inventory", label: "Lijekovi i zalihe", glyph: "▤", active: activeSection === "inventory" }]
      : []),
    ...(hasPermission(role, "invoices:read")
      ? [{ href: "/invoices", label: "Računi", glyph: "KM", active: activeSection === "invoices" }]
      : []),
    ...(hasPermission(role, "services:read")
      ? [{ href: "/services", label: "Usluge i cjenovnik", glyph: "₊", active: activeSection === "services" }]
      : []),
    ...(hasPermission(role, "employees:write")
      ? [{ href: "/employees", label: "Zaposleni", glyph: "♙", active: activeSection === "employees" }]
      : []),
    ...(hasPermission(role, "settings:write")
      ? [{ href: "/settings", label: "Postavke", glyph: "⚙", active: activeSection === "settings" }]
      : []),
    ...(hasPermission(role, "reports:financial")
      ? [{ href: "/reports/financial", label: "Finansijski izvještaj", glyph: "▥", active: activeSection === "reports" }]
      : []),
    ...(hasPermission(role, "reports:inventory")
      ? [{ href: "/reports/inventory", label: "Izvještaj zaliha", glyph: "▤", active: activeSection === "inventory-report" }]
      : []),
  ];

  return (
    <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] max-[820px]:grid-cols-[68px_minmax(0,1fr)] max-[639px]:grid-cols-1">
      <aside className="flex flex-col gap-[30px] overflow-y-auto border-r border-line bg-white px-[18px] pb-5 pt-[26px] max-[820px]:items-center max-[820px]:px-[9px] max-[639px]:hidden print:hidden">
        <Link className="flex items-center gap-[11px] px-2 max-[820px]:p-0" href="/dashboard" aria-label="VetCare početna stranica">
          <div className="grid size-[38px] place-items-center rounded-xl bg-green text-lg font-bold text-white" aria-hidden="true">
            V
          </div>
          <div className="max-[820px]:hidden">
            <div className="text-base font-[750] tracking-[-0.3px]">VetCare</div>
            <div className="mt-0.5 text-[11px] text-muted">Upravljanje ambulantom</div>
          </div>
        </Link>

        <nav className="max-[640px]:hidden" aria-label="Glavna navigacija">
          <p className="mb-[9px] mx-2 text-[10px] font-[750] uppercase tracking-[1.1px] text-[#9aa59f] max-[820px]:hidden">Pregled</p>
          <Link
            className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "dashboard" ? "bg-green-soft font-bold text-green-dark" : ""}`}
            href="/dashboard"
            aria-current={activeSection === "dashboard" ? "page" : undefined}
          >
            <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">⌂</span>
            <span className="max-[820px]:hidden">Kontrolna tabla</span>
          </Link>
          {hasPermission(role, "clients:read") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "clients" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/clients"
              aria-current={activeSection === "clients" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">◎</span>
              <span className="max-[820px]:hidden">Klijenti</span>
            </Link>
          ) : null}
          <p className="mb-[9px] mx-2 mt-[25px] text-[10px] font-[750] uppercase tracking-[1.1px] text-[#9aa59f] max-[820px]:hidden">
            Moduli
          </p>
          {hasPermission(role, "animals:read") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "animals" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/animals"
              aria-current={activeSection === "animals" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">◉</span>
              <span className="max-[820px]:hidden">Životinje</span>
            </Link>
          ) : null}
          {hasPermission(role, "appointments:read") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "appointments" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/appointments"
              aria-current={activeSection === "appointments" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">▦</span>
              <span className="max-[820px]:hidden">Termini</span>
            </Link>
          ) : null}
          {hasPermission(role, "examinations:read") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "examinations" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/examinations"
              aria-current={activeSection === "examinations" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">✚</span>
              <span className="max-[820px]:hidden">Pregledi</span>
            </Link>
          ) : null}
          {hasPermission(role, "medications:read") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "inventory" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/inventory"
              aria-current={activeSection === "inventory" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">▤</span>
              <span className="max-[820px]:hidden">Lijekovi i zalihe</span>
            </Link>
          ) : null}
          {hasPermission(role, "invoices:read") || hasPermission(role, "reports:financial") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "invoices" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/invoices"
              aria-current={activeSection === "invoices" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">KM</span>
              <span className="max-[820px]:hidden">Računi i izvještaji</span>
            </Link>
          ) : null}
          {hasPermission(role, "services:read") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "services" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/services"
              aria-current={activeSection === "services" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">₊</span>
              <span className="max-[820px]:hidden">Usluge i cjenovnik</span>
            </Link>
          ) : null}
          {hasPermission(role, "employees:write") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "employees" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/employees"
              aria-current={activeSection === "employees" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">♙</span>
              <span className="max-[820px]:hidden">Zaposleni</span>
            </Link>
          ) : null}
          {hasPermission(role, "settings:write") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "settings" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/settings"
              aria-current={activeSection === "settings" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">⚙</span>
              <span className="max-[820px]:hidden">Podešavanja</span>
            </Link>
          ) : null}
          {hasPermission(role, "reports:financial") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "reports" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/reports/financial"
              aria-current={activeSection === "reports" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">▥</span>
              <span className="max-[820px]:hidden">Finansijski izvještaj</span>
            </Link>
          ) : null}
          {hasPermission(role, "reports:inventory") ? (
            <Link
              className={`flex min-h-10 items-center gap-[11px] rounded-lg px-[11px] font-[550] text-[#66756d] max-[820px]:w-[46px] max-[820px]:justify-center max-[820px]:px-0 ${activeSection === "inventory-report" ? "bg-green-soft font-bold text-green-dark" : ""}`}
              href="/reports/inventory"
              aria-current={activeSection === "inventory-report" ? "page" : undefined}
            >
              <span className="grid size-[21px] place-items-center text-[15px]" aria-hidden="true">▤</span>
              <span className="max-[820px]:hidden">Izvještaj zaliha</span>
            </Link>
          ) : null}
        </nav>

        <div className="mt-auto w-full border-t border-line px-2.5 pt-3 max-[820px]:px-0">
          <div className="flex items-center gap-2.5 max-[820px]:justify-center">
            <div className="grid size-9 flex-none place-items-center rounded-full bg-green-soft text-xs font-[750] text-green-dark" aria-hidden="true">{initials}</div>
            <div className="min-w-0 max-[820px]:hidden">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold">{name}</div>
              <div className="mt-[3px] text-[11px] text-muted">{roleLabels[role]}</div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <MobileNavigation
        primaryItems={primaryMobileItems}
        moreItems={moreMobileItems}
        name={name}
        role={roleLabels[role]}
      />
      <div className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] min-[640px]:pb-0">
        <header className="flex min-h-[72px] items-center justify-between border-b border-line bg-white px-[34px] max-[820px]:px-[21px] max-[640px]:min-h-[60px] print:hidden">
          <div className="text-[13px] font-[650]">Veterinarska ambulanta</div>
          <div className="text-xs text-muted max-[640px]:hidden">
            {new Intl.DateTimeFormat("bs-BA", {
              dateStyle: "full",
              timeZone: "Europe/Sarajevo",
            }).format(new Date())}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
