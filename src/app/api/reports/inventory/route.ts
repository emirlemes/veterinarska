import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { getClinicDate } from "@/lib/dates";
import { prisma } from "@/lib/db";

function csvCell(value: string | number) {
  const text = String(value);
  const safeText = typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/.test(value)
    ? `'${text}`
    : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function getDateAfterDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export async function GET() {
  const authorization = await authorizeApiRequest("reports:inventory");
  if (authorization.response) return authorization.response;

  const today = getClinicDate();
  const expiryLimit = getDateAfterDays(today, 90);
  const medications = await prisma.medication.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      name: true,
      activeIngredient: true,
      form: true,
      strength: true,
      unit: true,
      minimumStock: true,
      isActive: true,
      batches: {
        orderBy: [{ expiresAt: "asc" }, { batchNumber: "asc" }],
        select: {
          batchNumber: true,
          expiresAt: true,
          quantityRemaining: true,
        },
      },
    },
  });

  const rows: (string | number)[][] = [[
    "Lijek",
    "Aktivna supstanca",
    "Oblik",
    "Jačina",
    "Status lijeka",
    "Serija",
    "Rok trajanja",
    "Količina serije",
    "Jedinica",
    "Minimalna zaliha",
    "Status serije",
    "Datum izvještaja",
  ]];

  for (const medication of medications) {
    const batches = medication.batches.length ? medication.batches : [null];
    for (const batch of batches) {
      const expiry = batch?.expiresAt?.toISOString().slice(0, 10) ?? "";
      const expired = Boolean(expiry && expiry < today);
      const expiring = Boolean(expiry && expiry >= today && expiry <= expiryLimit);
      const stockStatus = !medication.isActive
        ? "Arhiviran lijek"
        : expired
          ? "Istekla serija"
          : expiring
            ? "Ističe u 90 dana"
            : "Upotrebljivo";
      rows.push([
        medication.name,
        medication.activeIngredient ?? "",
        medication.form ?? "",
        medication.strength ?? "",
        medication.isActive ? "Aktivan" : "Arhiviran",
        batch?.batchNumber ?? "",
        expiry,
        batch?.quantityRemaining.toString() ?? "0",
        medication.unit,
        medication.minimumStock.toString(),
        stockStatus,
        today,
      ]);
    }
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="izvjestaj-zaliha-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
