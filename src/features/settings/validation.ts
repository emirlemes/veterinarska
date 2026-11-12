import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

const dailyWorkingHoursSchema = z.object({
  enabled: z.boolean(),
  start: time,
  end: time,
}).superRefine((day, context) => {
  if (day.enabled && day.start >= day.end) {
    context.addIssue({
      code: "custom",
      path: ["end"],
      message: "Završetak radnog vremena mora biti nakon početka.",
    });
  }
});

export const workingHoursSchema = z.object({
  "1": dailyWorkingHoursSchema,
  "2": dailyWorkingHoursSchema,
  "3": dailyWorkingHoursSchema,
  "4": dailyWorkingHoursSchema,
  "5": dailyWorkingHoursSchema,
  "6": dailyWorkingHoursSchema,
  "7": dailyWorkingHoursSchema,
});

export type WorkingHours = z.infer<typeof workingHoursSchema>;

export const defaultWorkingHours: WorkingHours = {
  "1": { enabled: true, start: "09:00", end: "17:00" },
  "2": { enabled: true, start: "09:00", end: "17:00" },
  "3": { enabled: true, start: "09:00", end: "17:00" },
  "4": { enabled: true, start: "09:00", end: "17:00" },
  "5": { enabled: true, start: "09:00", end: "17:00" },
  "6": { enabled: false, start: "09:00", end: "13:00" },
  "7": { enabled: false, start: "09:00", end: "13:00" },
};

export function checkAppointmentWorkingHours(
  startsAt: string,
  endsAt: string,
  value: unknown,
): "allowed" | "closed" | "outside-hours" | "invalid-settings" {
  if (value === null || value === undefined) return "allowed";
  const parsed = workingHoursSchema.safeParse(value);
  if (!parsed.success) return "invalid-settings";

  const startDate = startsAt.slice(0, 10);
  const endDate = endsAt.slice(0, 10);
  if (startDate !== endDate) return "outside-hours";

  const [year, month, day] = startDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const dayKey = String(weekday === 0 ? 7 : weekday) as keyof WorkingHours;
  const schedule = parsed.data[dayKey];
  if (!schedule.enabled) return "closed";

  const startTime = startsAt.slice(11, 16);
  const endTime = endsAt.slice(11, 16);
  if (startTime < schedule.start || endTime > schedule.end) return "outside-hours";
  return "allowed";
}

export const clinicSettingsSchema = z.object({
  clinicName: z.string().trim().min(1, "Unesite naziv ambulante.").max(180),
  address: optionalText(240),
  city: optionalText(120),
  phone: optionalText(40),
  email: z.string().trim().email("Unesite ispravnu e-mail adresu.").max(254).optional().or(z.literal("")),
  taxIdentificationNumber: optionalText(80),
  invoicePrefix: z.string().trim().regex(/^[A-Z0-9-]{1,12}$/, "Koristite 1–12 velikih slova, brojeva ili crtica."),
  defaultTaxRate: z.string().trim().regex(/^\d{1,3}(?:\.\d{1,2})?$/, "Unesite ispravnu stopu."),
  appointmentDurationMinutes: z.number().int().min(5).max(480),
  workingHours: workingHoursSchema,
}).superRefine((value, context) => {
  if (Number(value.defaultTaxRate) > 100) {
    context.addIssue({
      code: "custom",
      path: ["defaultTaxRate"],
      message: "Porezna stopa ne može biti veća od 100%.",
    });
  }
});
