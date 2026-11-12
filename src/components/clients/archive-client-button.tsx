"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientKeys, writeClient } from "@/features/clients/queries";
import { animalKeys } from "@/features/animals/queries";

export function ArchiveClientButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => writeClient(`/api/clients/${clientId}`, "DELETE"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: clientKeys.all }),
        queryClient.invalidateQueries({ queryKey: animalKeys.all }),
      ]);
    },
  });

  function archiveClient() {
    if (!window.confirm("Arhivirati ovog klijenta? Historijski podaci će ostati sačuvani.")) {
      return;
    }

    mutation.mutate(undefined, {
      onSuccess: () => {
        router.push("/clients?status=archived");
        router.refresh();
      },
    });
  }

  return (
    <div>
      <button className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] border border-[#f0d7d4] bg-white px-[13px] text-sm font-bold text-[#a43e3c] hover:bg-[#fbefee] disabled:cursor-wait disabled:opacity-[0.65] sm:w-auto" type="button" onClick={archiveClient} disabled={mutation.isPending}>
        {mutation.isPending ? "Arhiviranje..." : "Arhiviraj"}
      </button>
      {mutation.error ? <p className="mt-2 rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">{mutation.error.message}</p> : null}
    </div>
  );
}
