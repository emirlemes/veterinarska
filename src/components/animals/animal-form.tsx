"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { animalKeys, writeAnimal } from "@/features/animals/queries";
import { clientKeys } from "@/features/clients/queries";

type OwnerOption = {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  isActive: boolean;
};

type AnimalFormValues = {
  id?: string;
  name?: string;
  species?: string;
  breed?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  color?: string | null;
  weightKg?: string | null;
  microchipNumber?: string | null;
  passportNumber?: string | null;
  identificationNumber?: string | null;
  ownerId?: string;
  allergies?: string | null;
  chronicConditions?: string | null;
  notes?: string | null;
  status?: "ACTIVE" | "DECEASED" | "INACTIVE";
};

export function AnimalForm({
  animal,
  owners,
  canWriteMedical,
}: {
  animal?: AnimalFormValues;
  owners: OwnerOption[];
  canWriteMedical: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: object) => writeAnimal(
      animal?.id ? `/api/animals/${animal.id}` : "/api/animals",
      animal?.id ? "PUT" : "POST",
      body,
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: animalKeys.all }),
        queryClient.invalidateQueries({ queryKey: clientKeys.all }),
      ]);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());
    mutation.mutate(body, {
      onSuccess: (result) => {
        if (animal?.id) {
          router.push(`/animals/${animal.id}`);
        } else if (
          typeof result === "object" &&
          result !== null &&
          "id" in result &&
          typeof result.id === "string"
        ) {
          router.push(`/animals/${result.id}`);
        } else {
          router.push("/animals");
        }
        router.refresh();
      },
    });
  }

  return (
    <form className="max-w-[860px] min-w-0 rounded-[11px] border border-line bg-white p-[18px_19px] shadow-[0_2px_6px_rgb(34_62_47_/_2%)]" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-x-[18px] max-[640px]:grid-cols-1">
        <Field label="Ime životinje" name="name" required value={animal?.name} />
        <Field label="Vrsta" name="species" required value={animal?.species} />
        <Field label="Pasmina" name="breed" value={animal?.breed} />
        <Field label="Spol" name="sex" value={animal?.sex} />
        <Field label="Datum rođenja" name="dateOfBirth" type="date" value={animal?.dateOfBirth} />
        <Field label="Boja" name="color" value={animal?.color} />
        <Field label="Težina (kg)" name="weightKg" type="number" value={animal?.weightKg} />
        <label className="my-4 grid gap-[7px]">
          <span className="text-xs font-[650]">Vlasnik *</span>
          <select className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-3 text-ink outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]" name="ownerId" defaultValue={animal?.ownerId ?? ""} required>
            <option value="" disabled>Odaberite vlasnika</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.companyName || `${owner.firstName} ${owner.lastName}`}
                {!owner.isActive ? " (arhiviran)" : ""}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Broj mikročipa"
          name="microchipNumber"
          value={animal?.microchipNumber}
        />
        <Field
          label="Broj pasoša"
          name="passportNumber"
          value={animal?.passportNumber}
        />
        <Field
          label="Identifikacijski broj"
          name="identificationNumber"
          value={animal?.identificationNumber}
        />
        {animal?.id ? (
          <label className="my-4 grid gap-[7px]">
            <span className="text-xs font-[650]">Status</span>
            <select className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-3 text-ink outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]" name="status" defaultValue={animal.status ?? "ACTIVE"}>
              <option value="ACTIVE">Aktivna</option>
              <option value="DECEASED">Uginula</option>
              <option value="INACTIVE">Neaktivna</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="status" value="ACTIVE" />
        )}
        {canWriteMedical ? (
          <>
            <TextArea label="Alergije" name="allergies" value={animal?.allergies} />
            <TextArea
              label="Hronična oboljenja"
              name="chronicConditions"
              value={animal?.chronicConditions}
            />
            <TextArea label="Medicinska napomena" name="notes" value={animal?.notes} />
          </>
        ) : null}
      </div>
      {mutation.error ? <p className="rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">{mutation.error.message}</p> : null}
      <div className="mt-3 flex items-center justify-end gap-[9px] border-t border-line pt-[17px]">
        <button className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-[7px] border border-transparent bg-green px-[13px] text-sm font-bold text-white hover:bg-green-dark disabled:cursor-wait disabled:opacity-[0.65] sm:w-auto" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Čuvanje..." : animal?.id ? "Sačuvaj izmjene" : "Kreiraj životinju"}
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
        maxLength={name === "weightKg" ? undefined : 120}
        step={type === "number" ? "0.001" : undefined}
        min={type === "number" ? "0.001" : undefined}
        defaultValue={value ?? ""}
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value?: string | null;
}) {
  return (
    <label className="col-span-full my-4 grid gap-[7px] max-[640px]:col-auto">
      <span className="text-xs font-[650]">{label}</span>
      <textarea className="w-full resize-y rounded-[7px] border border-[#dce4de] px-3 py-2.5 outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]" name={name} rows={3} maxLength={5000} defaultValue={value ?? ""} />
    </label>
  );
}
