"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { animalKeys, writeAnimal } from "@/features/animals/queries";
import { clientKeys } from "@/features/clients/queries";

export function ArchiveAnimalButton({ animalId }: { animalId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => writeAnimal(`/api/animals/${animalId}`, "DELETE"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: animalKeys.all }),
        queryClient.invalidateQueries({ queryKey: clientKeys.all }),
      ]);
    },
  });

  function archiveAnimal() {
    if (!window.confirm("Arhivirati ovu životinju? Historijski podaci će ostati sačuvani.")) {
      return;
    }

    mutation.mutate(undefined, { onSuccess: () => router.refresh() });
  }

  return (
    <div>
      <button className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] border border-[#f0d7d4] bg-white px-[13px] text-sm font-bold text-[#a43e3c] hover:bg-[#fbefee] disabled:cursor-wait disabled:opacity-[0.65] sm:w-auto" type="button" onClick={archiveAnimal} disabled={mutation.isPending}>
        {mutation.isPending ? "Arhiviranje..." : "Arhiviraj"}
      </button>
      {mutation.error ? <p className="mt-2 rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">{mutation.error.message}</p> : null}
    </div>
  );
}
