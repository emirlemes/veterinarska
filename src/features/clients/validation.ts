import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const clientInputSchema = z.object({
  firstName: z.string().trim().min(1, "Ime je obavezno.").max(100),
  lastName: z.string().trim().min(1, "Prezime je obavezno.").max(100),
  companyName: optionalText(180),
  phone: z.string().trim().min(3, "Unesite ispravan broj telefona.").max(40),
  email: z
    .string()
    .trim()
    .email("Unesite ispravnu e-mail adresu.")
    .max(254)
    .or(z.literal(""))
    .optional(),
  address: optionalText(240),
  city: optionalText(120),
  postalCode: optionalText(20),
  notes: optionalText(5000),
});

export const clientListQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().positive().default(1),
  status: z.enum(["active", "archived", "all"]).default("active"),
});

export type ClientInput = z.infer<typeof clientInputSchema>;
