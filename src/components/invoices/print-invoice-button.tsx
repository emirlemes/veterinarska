"use client";

export function PrintInvoiceButton() {
  return (
    <button
      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-[#53645a] hover:bg-[#f7faf8] print:hidden sm:w-auto"
      type="button"
      onClick={() => window.print()}
    >
      Štampaj / PDF
    </button>
  );
}
