"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { clientKeys, writeClient } from "@/features/clients/queries";
import { animalKeys } from "@/features/animals/queries";

type ClientFormValues = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  notes?: string | null;
};

export function ClientForm({ client }: { client?: ClientFormValues }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: object) => writeClient(
      client?.id ? `/api/clients/${client.id}` : "/api/clients",
      client?.id ? "PUT" : "POST",
      body,
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: clientKeys.all }),
        queryClient.invalidateQueries({ queryKey: animalKeys.all }),
      ]);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    mutation.mutate(body, {
      onSuccess: (result) => {
        if (
          client?.id &&
          typeof result === "object" &&
          result !== null &&
          "id" in result &&
          typeof result.id === "string"
        ) {
          router.push(`/clients/${result.id}`);
        } else if (client?.id) {
          router.push(`/clients/${client.id}`);
        } else {
          router.push("/clients");
        }
        router.refresh();
      },
    });
  }

  return (
    <form className="max-w-[860px] min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-x-[18px] max-[640px]:grid-cols-1">
        <Field label="Ime" name="firstName" required value={client?.firstName} />
        <Field label="Prezime" name="lastName" required value={client?.lastName} />
        <Field label="Naziv firme (opcionalno)" name="companyName" value={client?.companyName} />
        <Field label="Telefon" name="phone" required value={client?.phone} />
        <Field label="E-mail" name="email" type="email" value={client?.email} />
        <Field label="Adresa" name="address" value={client?.address} />
        <Field label="Grad" name="city" value={client?.city} />
        <Field label="Poštanski broj" name="postalCode" value={client?.postalCode} />
        <label className="col-span-full my-4 grid gap-[7px] max-[640px]:col-auto">
          <span className="text-xs font-[650]">Napomena</span>
          <textarea className="w-full resize-y rounded-[7px] border border-[#dce4de] px-3 py-2.5 outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]" name="notes" rows={4} maxLength={5000} defaultValue={client?.notes ?? ""} />
        </label>
      </div>
      {mutation.error ? <p className="rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">{mutation.error.message}</p> : null}
      <div className="mt-3 flex items-center justify-end gap-[9px] border-t border-line pt-[17px]">
        <button className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] border border-transparent bg-green px-[13px] text-sm font-bold text-white hover:bg-green-dark disabled:cursor-wait disabled:opacity-[0.65] sm:w-auto" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Čuvanje..." : client?.id ? "Sačuvaj izmjene" : "Kreiraj klijenta"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value?: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="my-4 grid gap-[7px]">
      <span className="text-xs font-[650]">{label}{required ? " *" : ""}</span>
      <input
        className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-3 outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]"
        name={name}
        type={type}
        required={required}
        maxLength={name === "phone" ? 40 : name === "email" ? 254 : undefined}
        defaultValue={value ?? ""}
      />
    </label>
  );
}
