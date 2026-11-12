import type { Metadata } from "next";
import { ServiceManager } from "@/components/services/service-manager";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Usluge i cjenovnik" };

export default async function ServicesPage() {
  const user = await requirePermission("services:read");
  const services = await prisma.service.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      isActive: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5">
        <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">Finansije ambulante</p>
        <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Usluge i cjenovnik</h1>
        <p className="mt-2 text-sm text-muted">Upravljajte uslugama i cijenama koje se mogu dodati na račun.</p>
      </div>
      <ServiceManager
        services={services.map((service) => ({ ...service, price: service.price.toString() }))}
        canWrite={hasPermission(user.role, "services:write")}
      />
    </main>
  );
}
