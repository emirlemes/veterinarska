import type { Metadata } from "next";
import { EmployeeManager } from "@/components/employees/employee-manager";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Zaposleni" };

export default async function EmployeesPage() {
  const currentUser = await requirePermission("employees:write");
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

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5">
        <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Administracija</p>
        <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Zaposleni</h1>
        <p className="mt-2 text-sm text-muted">Upravljajte pristupom, ulogama i korisničkim nalozima ambulante.</p>
      </div>
      <EmployeeManager
        employees={employees.map((employee) => ({ ...employee, createdAt: employee.createdAt.toISOString() }))}
        currentUserId={currentUser.id}
      />
    </main>
  );
}
