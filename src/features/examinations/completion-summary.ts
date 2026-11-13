import { z } from "zod";

export const completionSummarySchema = z.object({
  animalId: z.string().uuid(),
  animal: z.string(),
  client: z.string(),
  veterinarian: z.string(),
  date: z.string().datetime(),
  diagnosis: z.string().nullable(),
  therapies: z.array(z.string()),
  medications: z.array(z.string()),
  services: z.array(z.string()),
  invoiceId: z.string().uuid().nullable(),
});
