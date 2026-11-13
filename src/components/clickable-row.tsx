"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
} & ({ href: string; onActivate?: never } | { href?: never; onActivate: () => void });

function useRecordActivation(href: string | undefined, onActivate: (() => void) | undefined) {
  const router = useRouter();

  function activate() {
    if (href) router.push(href);
    else onActivate?.();
  }

  function handleClick(event: MouseEvent<HTMLElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, summary, dialog, [contenteditable], [data-row-action]")) return;
    if (window.getSelection()?.toString()) return;
    activate();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    activate();
  }

  return { handleClick, handleKeyDown };
}

export function ClickableRow({ href, onActivate, children, className = "" }: Props) {
  const { handleClick, handleKeyDown } = useRecordActivation(href, onActivate);
  return (
    <tr tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown} className={`cursor-pointer hover:bg-[#f7faf8] focus-visible:outline-2 focus-visible:outline-green ${className}`}>
      {children}
    </tr>
  );
}

export function ClickableCard({ href, onActivate, children, className = "" }: Props) {
  const { handleClick, handleKeyDown } = useRecordActivation(href, onActivate);
  return (
    <article tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown} className={`cursor-pointer hover:bg-[#f7faf8] focus-visible:outline-2 focus-visible:outline-green ${className}`}>
      {children}
    </article>
  );
}
