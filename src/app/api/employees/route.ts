import { Prisma, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { employeeInputSchema } from "@/features/employees/validation";
import { authorizeApiRequest } from "@/lib/auth/authorize-api-request";
import { prisma } from "@/lib/db";

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function GET() {
  const authorization = await authorizeApiRequest("employees:write");
  if (authorization.response) return authorization.response;

  const employees = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  return Response.json(employees);
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest("employees:write");
  if (authorization.response) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Tijelo zahtjeva nije ispravan JSON." }, { status: 400 });
  }
  const parsed = employeeInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Provjerite unesene podatke zaposlenog.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const passwordHash = await hash(input.password, 12);
  try {
    const employee = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email.toLowerCase(),
          phone: input.phone || null,
          passwordHash,
          role: input.role as Role,
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: {
          userId: authorization.user.id,
          action: "EMPLOYEE_CREATED",
          entityType: "User",
          entityId: created.id,
          details: { role: input.role },
        },
      });
      return created;
    });
    return Response.json(employee, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return Response.json({ error: "Korisnički nalog s ovom e-mail adresom već postoji." }, { status: 409 });
    }
    throw error;
  }
}
