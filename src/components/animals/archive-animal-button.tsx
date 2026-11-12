"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveAnimalButton({ animalId }: { animalId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function archiveAnimal() {
    if (!window.confirm("Arhivirati ovu životinju? Historijski podaci će ostati sačuvani.")) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/animals/${animalId}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(
          typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "Životinju nije moguće arhivirati.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Nije moguće povezati se sa serverom. Pokušajte ponovo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] border border-[#f0d7d4] bg-white px-[13px] text-sm font-bold text-[#a43e3c] hover:bg-[#fbefee] disabled:cursor-wait disabled:opacity-[0.65] sm:w-auto" type="button" onClick={archiveAnimal} disabled={isSubmitting}>
        {isSubmitting ? "Arhiviranje..." : "Arhiviraj"}
      </button>
      {error ? <p className="mt-2 rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">{error}</p> : null}
    </div>
  );
}
