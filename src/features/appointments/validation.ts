import type { AppointmentStatus } from "@prisma/client";
import { z } from "zod";

const clinicDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Unesite ispravan datum.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Unesite ispravan datum.");

export const appointmentInputSchema = z
  .object({
    clientId: z.string().uuid("Odaberite ispravnog klijenta."),
    animalId: z.string().uuid("Odaberite ispravnu životinju."),
    veterinarianId: z.string().uuid("Odaberite veterinara."),
    startsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Unesite ispravan početak termina."),
    endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Unesite ispravan završetak termina."),
    reason: z.string().trim().min(1, "Razlog dolaska je obavezan.").max(240),
    notes: z.string().trim().max(5000).optional().or(z.literal("")),
  })
  .refine((value) => value.startsAt < value.endsAt, {
    message: "Završetak termina mora biti nakon početka.",
    path: ["endsAt"],
  });

export const appointmentListQuerySchema = z.object({
  date: clinicDate,
  status: z
    .enum(["all", "SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .default("all"),
  search: z.string().trim().max(100).default(""),
});

export const appointmentCalendarQuerySchema = appointmentListQuerySchema.extend({
  veterinarianId: z.union([z.literal("all"), z.string().uuid()]).default("all"),
  view: z.enum(["week", "month"]).default("week"),
});

export const appointmentStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
}).strict();

export const appointmentUpdateSchema = appointmentInputSchema;

export type AppointmentStatusValue = AppointmentStatus;

const validTransitions: Record<AppointmentStatusValue, readonly AppointmentStatusValue[]> = {
  SCHEDULED: ["CONFIRMED", "IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransitionAppointment(
  current: AppointmentStatusValue,
  next: AppointmentStatusValue,
) {
  return validTransitions[current].includes(next);
}

export function getAppointmentTransitions(current: AppointmentStatusValue) {
  return validTransitions[current];
}
