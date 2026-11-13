import { z } from "zod";
import { getClinicDateBounds } from "@/lib/dates";

const optionalMedicalText = z.string().trim().max(10000).optional().or(z.literal(""));

export const examinationInputSchema = z.object({
  clientId: z.string().uuid("Odaberite ispravnog klijenta."),
  animalId: z.string().uuid("Odaberite ispravnu životinju."),
  appointmentId: z.string().uuid().optional().or(z.literal("")),
  veterinarianId: z.string().uuid().optional().or(z.literal("")),
  chiefComplaint: optionalMedicalText,
  symptoms: optionalMedicalText,
  diagnosis: optionalMedicalText,
  treatmentPlan: optionalMedicalText,
  notes: optionalMedicalText,
});

export const examinationUpdateSchema = examinationInputSchema.extend({
  id: z.string().uuid(),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]).default("IN_PROGRESS"),
});

export const examinationListQuerySchema = z.object({
  status: z.enum(["all", "IN_PROGRESS", "COMPLETED"]).default("all"),
  q: z.string().trim().max(100).default(""),
  date: z.string().refine((value) => !value || Boolean(getClinicDateBounds(value)), "Neispravan datum.").default(""),
  veterinarianId: z.union([z.literal(""), z.string().uuid()]).default(""),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});

export const examinationStatusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
});

export const therapyInputSchema = z.object({
  name: z.string().trim().min(1, "Unesite naziv terapije.").max(180),
  dosage: z.string().trim().max(160).optional().or(z.literal("")),
  frequency: z.string().trim().max(160).optional().or(z.literal("")),
  duration: z.string().trim().max(160).optional().or(z.literal("")),
  instructions: optionalMedicalText,
});

const positiveQuantitySchema = z
  .string()
  .trim()
  .regex(/^\d{1,9}(?:\.\d{1,3})?$/, "Unesite količinu s najviše tri decimale.")
  .refine((value) => Number(value) > 0, "Količina mora biti veća od nule.");

export const medicationAdministrationSchema = z.object({
  batchId: z.string().uuid("Odaberite ispravnu seriju lijeka."),
  quantity: positiveQuantitySchema,
  notes: optionalMedicalText,
});

export const examinationServiceInputSchema = z.object({
  serviceId: z.string().uuid("Odaberite uslugu iz cjenovnika."),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,7}(?:\.\d{1,2})?$/, "Unesite količinu s najviše dvije decimale.")
    .refine((value) => Number(value) > 0, "Količina mora biti veća od nule."),
});

export function canCompleteExamination(current: "IN_PROGRESS" | "COMPLETED") {
  return current === "IN_PROGRESS";
}

export function hasCompletionDiagnosis(diagnosis: string | null | undefined) {
  return Boolean(diagnosis?.trim());
}
