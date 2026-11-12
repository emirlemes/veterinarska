import { z } from "zod";

const serviceFields = {
  name: z.string().trim().min(1, "Unesite naziv usluge.").max(180),
  description: z.string().trim().max(10000).optional().or(z.literal("")),
  price: z.string().trim().regex(/^\d{1,9}(?:\.\d{1,2})?$/, "Unesite cijenu s najviše dvije decimale."),
};

export const serviceInputSchema = z.object(serviceFields);

export const serviceUpdateSchema = z.object({
  name: serviceFields.name.optional(),
  description: serviceFields.description,
  price: serviceFields.price.optional(),
  isActive: z.boolean().optional(),
}).refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  "Unesite izmjenu usluge.",
);
