"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoutButton } from "./logout-button";

export type MobileNavigationItem = {
  href: string;
  label: string;
  glyph: string;
  active: boolean;
};

export function MobileNavigation({
  primaryItems,
  moreItems,
  name,
  role,
}: {
  primaryItems: MobileNavigationItem[];
  moreItems: MobileNavigationItem[];
  name: string;
  role: string;
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <>
      {isMoreOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-ink/25 min-[640px]:hidden print:hidden"
          onClick={() => setIsMoreOpen(false)}
        >
          <section
            aria-label="Više modula"
            className="absolute inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] overflow-y-auto rounded-xl border border-line bg-white p-3 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-1 pb-3">
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-bold">{name}</p>
                <p className="mb-0 mt-1 text-xs text-muted">{role}</p>
              </div>
              <button
                aria-label="Zatvori meni"
                className="grid size-11 flex-none place-items-center rounded-lg border border-line text-xl text-muted"
                onClick={() => setIsMoreOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2 pt-3" aria-label="Ostali moduli">
              {moreItems.map((item) => (
                <Link
                  aria-current={item.active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold ${item.active ? "border-green/20 bg-green-soft text-green-dark" : "text-[#53645a]"}`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setIsMoreOpen(false)}
                >
                  <span className="grid size-7 flex-none place-items-center text-base" aria-hidden="true">
                    {item.glyph}
                  </span>
                  <span className="min-w-0">{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-3 border-t border-line pt-2">
              <LogoutButton />
            </div>
          </section>
        </div>
      ) : null}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 items-stretch border-t border-line bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgb(34_62_47_/_6%)] min-[640px]:hidden print:hidden"
        aria-label="Mobilna navigacija"
      >
        {primaryItems.map((item) => (
          <Link
            aria-current={item.active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-semibold ${item.active ? "text-green-dark" : "text-muted"}`}
            href={item.href}
            key={item.href}
          >
            <span className={`grid size-7 place-items-center rounded-lg text-base ${item.active ? "bg-green-soft" : ""}`} aria-hidden="true">
              {item.glyph}
            </span>
            <span className="max-w-full truncate px-0.5">{item.label}</span>
          </Link>
        ))}
        <button
          aria-expanded={isMoreOpen}
          aria-haspopup="dialog"
          className={`absolute right-2 top-[-52px] grid min-h-11 min-w-11 grid-cols-[auto_auto] items-center gap-1.5 rounded-full border border-line bg-white px-3 text-xs font-bold shadow-md ${isMoreOpen ? "text-green-dark" : "text-[#53645a]"}`}
          onClick={() => setIsMoreOpen((open) => !open)}
          type="button"
        >
          <span aria-hidden="true">☰</span>
          Više
        </button>
      </nav>
    </>
  );
}
