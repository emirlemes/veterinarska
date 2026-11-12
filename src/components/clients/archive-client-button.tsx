"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveClientButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function archiveClient() {
    if (!window.confirm("Arhivirati ovog klijenta? Historijski podaci će ostati sačuvani.")) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    let response: Response;
    try {
      response = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
      setIsSubmitting(false);
      return;
    }

    const result: unknown = await response.json();
    if (!response.ok) {
      const message =
        typeof result === "object" &&
        result !== null &&
        "error" in result &&
        typeof result.error === "string"
          ? result.error
          : "Arhiviranje nije uspjelo.";
      setError(message);
      setIsSubmitting(false);
      return;
    }

    router.push("/clients?status=archived");
    router.refresh();
  }

  return (
    <div>
      <button className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] border border-[#f0d7d4] bg-white px-[13px] text-sm font-bold text-[#a43e3c] hover:bg-[#fbefee] disabled:cursor-wait disabled:opacity-[0.65] sm:w-auto" type="button" onClick={archiveClient} disabled={isSubmitting}>
        {isSubmitting ? "Arhiviranje..." : "Arhiviraj"}
      </button>
      {error ? <p className="mt-2 rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">{error}</p> : null}
    </div>
  );
}
