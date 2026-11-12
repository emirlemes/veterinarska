import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppointmentStatus, Role } from "@prisma/client";
import { z } from "zod";
import { ExaminationForm } from "@/components/examinations/examination-form";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Novi pregled" };

const activeAppointmentStatuses = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

export default async function NewExaminationPage({
  searchParams,
}: {
  searchParams: Promise<{ appointmentId?: string; clientId?: string; animalId?: string }>;
}) {
  const user = await requirePermission("examinations:write");
  const params = await searchParams;
  let appointment:
    | {
        id: string;
        startsAt: Date;
        reason: string;
        status: AppointmentStatus;
        client: { id: string; firstName: string; lastName: string; companyName: string | null };
        animal: { id: string; name: string; species: string; ownerId: string };
        veterinarian: { id: string; firstName: string; lastName: string };
        examination: { id: string } | null;
      }
    | undefined;

  if (params.appointmentId) {
    if (!z.string().uuid().safeParse(params.appointmentId).success) notFound();
    appointment = await prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        animal: { select: { id: true, name: true, species: true, ownerId: true } },
        veterinarian: { select: { id: true, firstName: true, lastName: true } },
        examination: { select: { id: true } },
      },
    }) ?? undefined;
    if (!appointment) notFound();
    if (appointment.examination) redirect(`/examinations/${appointment.examination.id}`);
    const appointmentStatus = appointment.status;
    if (!activeAppointmentStatuses.some((status) => status === appointmentStatus)) notFound();
  }

  const [clients, animals, veterinarians] = await Promise.all([
    prisma.client.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, companyName: true },
    }),
    prisma.animal.findMany({
      where: { status: "ACTIVE", owner: { isActive: true } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, species: true, ownerId: true },
    }),
    prisma.user.findMany({
      where: { role: Role.VETERINARIAN, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  const selectedClient = params.clientId
    ? clients.find((client) => client.id === params.clientId)
    : undefined;
  const selectedAnimal = params.animalId
    ? animals.find((animal) => animal.id === params.animalId)
    : undefined;
  const canCreate = Boolean(appointment) ||
    (clients.length > 0 && animals.length > 0 && veterinarians.length > 0);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-5 sm:px-[34px] sm:pb-[42px] sm:pt-[31px]">
      <div className="mb-5 sm:mb-[25px]">
        <p className="mb-[7px] text-[11px] font-[750] uppercase tracking-[0.7px] text-green">
          {appointment ? "Pregled po terminu" : "Medicinska evidencija"}
        </p>
        <h1 className="m-0 text-[clamp(24px,3vw,30px)] tracking-[-0.9px]">Novi pregled</h1>
        <p className="mt-2 text-sm text-muted">
          {appointment
            ? "Pregled će biti povezan s odabranim terminom."
            : "Pregled možete započeti i bez prethodno zakazanog termina."}
        </p>
      </div>

      {canCreate ? (
        <ExaminationForm
          clients={clients}
          animals={animals}
          veterinarians={veterinarians}
          appointment={appointment}
          defaultClientId={selectedClient?.id}
          defaultAnimalId={
            selectedClient && selectedAnimal?.ownerId === selectedClient.id
              ? selectedAnimal.id
              : undefined
          }
          currentUserId={user.id}
        />
      ) : (
        <section className="max-w-[760px] rounded-xl border border-line bg-white p-5 text-sm text-muted shadow-[0_2px_6px_rgb(34_62_47_/_2%)]">
          <h2 className="m-0 text-base font-semibold text-ink">Nedostaju podaci za pregled</h2>
          <ul className="mb-0 mt-3 list-disc space-y-1 pl-5">
            {!clients.length ? <li>Nema aktivnih klijenata.</li> : null}
            {!animals.length ? <li>Nema aktivnih životinja povezanih s aktivnim klijentom.</li> : null}
            {!veterinarians.length ? <li>Nema aktivnih korisnika s ulogom veterinara.</li> : null}
          </ul>
        </section>
      )}
    </main>
  );
}
