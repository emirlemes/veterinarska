import { z } from "zod";

const role = z.enum(["ADMIN", "VETERINARIAN"]);
const email = z.string().trim().email("Unesite ispravnu e-mail adresu.").max(254);
const password = z.string().min(12, "Lozinka mora imati najmanje 12 znakova.").max(128);
const phone = z.string().trim().max(40).optional().or(z.literal(""));

export const employeeInputSchema = z.object({
  firstName: z.string().trim().min(1, "Unesite ime.").max(100),
  lastName: z.string().trim().min(1, "Unesite prezime.").max(100),
  email,
  phone,
  password,
  role: role.default("VETERINARIAN"),
});

export const employeeUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: email.optional(),
  phone,
  password: password.optional().or(z.literal("")),
  role: role.optional(),
  isActive: z.boolean().optional(),
}).refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  "Unesite izmjenu zaposlenog.",
);
