import { NextRequest } from "next/server";
import { stockMovementReportQuerySchema } from "@/features/inventory/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { getClinicDateBounds } from "@/lib/dates";
import { prisma } from "@/lib/db";

function csvCell(value: string | number) {
  const text = String(value);
  const safeText = typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/.test(value)
    ? `'${text}`
    : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiRequest("reports:inventory");
  if (authorization.response) return authorization.response;

  const searchParams = request.nextUrl.searchParams;
  const parsed = stockMovementReportQuerySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    medicationId: searchParams.get("medicationId") ?? "all",
    userId: searchParams.get("userId") ?? "all",
    type: searchParams.get("type") ?? "all",
  });
  if (!parsed.success) {
    return Response.json({ error: "Odaberite ispravne filtere izvještaja." }, { status: 400 });
  }

  const from = getClinicDateBounds(parsed.data.from);
  const to = getClinicDateBounds(parsed.data.to);
  if (!from || !to) {
    return Response.json({ error: "Odabrani period nije ispravan." }, { status: 400 });
  }

  const where = {
    createdAt: { gte: from.start, lt: to.end },
    ...(parsed.data.type !== "all" ? { type: parsed.data.type } : {}),
    ...(parsed.data.userId !== "all" ? { userId: parsed.data.userId } : {}),
    ...(parsed.data.medicationId !== "all"
      ? { batch: { medicationId: parsed.data.medicationId } }
      : {}),
  };
  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        batch: {
          select: {
            batchNumber: true,
            medication: { select: { name: true, unit: true } },
          },
        },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5000,
    }),
  ]);

  const rows: (string | number)[][] = [[
    "Datum i vrijeme",
    "Tip kretanja",
    "Lijek",
    "Serija",
    "Količina",
    "Jedinica",
    "Razlog",
    "Korisnik",
  ]];

  for (const movement of movements) {
    rows.push([
      movement.createdAt.toISOString(),
      movement.type,
      movement.batch.medication.name,
      movement.batch.batchNumber,
      movement.quantity.toString(),
      movement.batch.medication.unit,
      movement.reason ?? "",
      `${movement.user.firstName} ${movement.user.lastName}`,
    ]);
  }

  if (total > movements.length) {
    rows.push([]);
    rows.push([`Izvoz je ograničen na 5000 od ${total} kretanja. Suzi period ili filtere.`]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kretanje-zaliha-${parsed.data.from}-${parsed.data.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
