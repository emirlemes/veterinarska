import { Prisma, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
import { employeeUpdateSchema } from "@/features/employees/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest("employees:write");
  if (authorization.response) return authorization.response;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return Response.json({ error: "Zaposleni nije pronađen." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = employeeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene izmjene zaposlenog.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (id === authorization.user.id && input.isActive === false) {
    return Response.json({ error: "Ne možete deaktivirati vlastiti nalog." }, { status: 400 });
  }

  let passwordHash: string | undefined;
  if (input.password) passwordHash = await hash(input.password, 12);
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({
        where: { id },
        select: { id: true, role: true, isActive: true },
      });
      if (!existing) return { kind: "not-found" as const };

      const losesAdminAccess =
        existing.role === Role.ADMIN &&
        existing.isActive &&
        (input.role !== undefined && input.role !== Role.ADMIN || input.isActive === false);
      if (losesAdminAccess) {
        const activeAdmins = await transaction.user.count({
          where: { role: Role.ADMIN, isActive: true },
        });
        if (activeAdmins <= 1) return { kind: "last-admin" as const };
      }

      const updated = await transaction.user.update({
        where: { id },
        data: {
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
          ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
        select: { id: true, role: true, isActive: true },
      });
      await transaction.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: input.isActive === false
            ? "EMPLOYEE_DEACTIVATED"
            : input.isActive === true && existing.isActive === false
              ? "EMPLOYEE_REACTIVATED"
              : passwordHash
                ? "EMPLOYEE_UPDATED_PASSWORD"
                : "EMPLOYEE_UPDATED",
          entityType: "User",
          entityId: updated.id,
          details: {
            ...(input.role !== undefined ? { role: input.role } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            passwordChanged: passwordHash !== undefined,
          },
        },
      });
      return { kind: "updated" as const, employee: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.kind === "not-found") {
      return Response.json({ error: "Zaposleni nije pronađen." }, { status: 404 });
    }
    if (result.kind === "last-admin") {
      return Response.json({ error: "Ambulanta mora imati najmanje jednog aktivnog administratora." }, { status: 400 });
    }
    return Response.json(result.employee);
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return Response.json({ error: "Korisnički nalog s ovom e-mail adresom već postoji." }, { status: 409 });
    }
    if (isPrismaError(error, "P2034")) {
      return Response.json({ error: "Podaci su upravo izmijenjeni. Osvježite stranicu i pokušajte ponovo." }, { status: 409 });
    }
    throw error;
  }
}
