import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportDateRangeSchema = z.object({
  from: date,
  to: date,
}).superRefine(({ from, to }, context) => {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString().slice(0, 10) !== from ||
    end.toISOString().slice(0, 10) !== to
  ) {
    context.addIssue({ code: "custom", path: ["from"], message: "Odaberite ispravan datum." });
    return;
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days < 0 || days > 365) {
    context.addIssue({
      code: "custom",
      path: ["to"],
      message: "Period može trajati najviše 366 dana.",
    });
  }
});
