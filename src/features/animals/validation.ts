import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Unesite ispravan datum.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Unesite ispravan datum.")
  .or(z.literal(""))
  .optional();

export const animalInputSchema = z.object({
  name: z.string().trim().min(1, "Ime životinje je obavezno.").max(120),
  species: z.string().trim().min(1, "Vrsta životinje je obavezna.").max(80),
  breed: optionalText(120),
  sex: optionalText(30),
  dateOfBirth: dateInput,
  color: optionalText(80),
  weightKg: z
    .string()
    .trim()
    .regex(/^\d{1,4}(\.\d{1,3})?$/, "Težina mora biti pozitivan broj do tri decimale.")
    .refine((value) => Number(value) > 0, "Težina mora biti veća od nule.")
    .optional()
    .or(z.literal("")),
  microchipNumber: optionalText(80),
  passportNumber: optionalText(80),
  identificationNumber: optionalText(80),
  ownerId: z.string().uuid("Odaberite ispravnog vlasnika."),
  allergies: optionalText(5000),
  chronicConditions: optionalText(5000),
  notes: optionalText(5000),
  status: z.enum(["ACTIVE", "DECEASED", "INACTIVE"]).default("ACTIVE"),
});

export const animalListQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().positive().default(1),
  status: z.enum(["active", "inactive", "deceased", "all"]).default("active"),
  species: z.string().trim().max(80).default(""),
  ownerId: z.string().uuid().optional(),
});
