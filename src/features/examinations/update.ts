import { AppointmentStatus, ExaminationStatus, Prisma } from "@prisma/client";
import { canCompleteExamination, hasCompletionDiagnosis } from "./validation";

type ClinicalUpdate = {
  clientId: string;
  animalId: string;
  chiefComplaint?: string;
  symptoms?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  notes?: string;
};

export async function updateExamination(
  transaction: Prisma.TransactionClient,
  input: {
    id: string;
    userId: string;
    status: "IN_PROGRESS" | "COMPLETED";
    clinical?: ClinicalUpdate;
  },
) {
  const examination = await transaction.examination.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      status: true,
      diagnosis: true,
      appointmentId: true,
      clientId: true,
      animalId: true,
      veterinarianId: true,
    },
  });
  if (!examination) return "missing" as const;
  if (!canCompleteExamination(examination.status)) return "completed" as const;
  if (input.clinical && (
    examination.clientId !== input.clinical.clientId ||
    examination.animalId !== input.clinical.animalId
  )) return "identity-immutable" as const;

  if (input.status === "COMPLETED") {
    const diagnosis = input.clinical ? input.clinical.diagnosis : examination.diagnosis;
    if (!hasCompletionDiagnosis(diagnosis)) return "missing-diagnosis" as const;
    if (examination.appointmentId) {
      const appointment = await transaction.appointment.findUnique({
        where: { id: examination.appointmentId },
        select: { status: true },
      });
      if (appointment?.status === AppointmentStatus.IN_PROGRESS) {
        const changed = await transaction.appointment.updateMany({
          where: { id: examination.appointmentId, status: AppointmentStatus.IN_PROGRESS },
          data: { status: AppointmentStatus.COMPLETED },
        });
        if (changed.count !== 1) throw new Error("APPOINTMENT_STATUS_CONFLICT");
      } else if (appointment && appointment.status !== AppointmentStatus.COMPLETED) {
        return "appointment-conflict" as const;
      }
    }
  }

  const changed = await transaction.examination.updateMany({
    where: { id: input.id, status: ExaminationStatus.IN_PROGRESS },
    data: {
      ...(input.clinical ? {
        chiefComplaint: input.clinical.chiefComplaint || null,
        symptoms: input.clinical.symptoms || null,
        diagnosis: input.clinical.diagnosis || null,
        treatmentPlan: input.clinical.treatmentPlan || null,
        notes: input.clinical.notes || null,
      } : {}),
      status: input.status,
    },
  });
  if (changed.count !== 1) throw new Error("EXAMINATION_STATUS_CONFLICT");

  await transaction.auditLog.create({
    data: {
      userId: input.userId,
      action: input.status === "COMPLETED" ? "EXAMINATION_COMPLETED" : "EXAMINATION_UPDATED",
      entityType: "Examination",
      entityId: input.id,
      details: { veterinarianId: examination.veterinarianId },
    },
  });
  return "success" as const;
}

export function examinationUpdateResponse(outcome: Awaited<ReturnType<typeof updateExamination>>) {
  switch (outcome) {
    case "missing": return Response.json({ error: "Pregled nije pronađen." }, { status: 404 });
    case "completed": return Response.json({ error: "Završen pregled više nije moguće mijenjati." }, { status: 409 });
    case "identity-immutable": return Response.json({ error: "Klijent i životinja pregleda ne mogu se naknadno mijenjati." }, { status: 400 });
    case "missing-diagnosis": return Response.json({ error: "Pregled nije moguće završiti jer dijagnoza nije unesena." }, { status: 400 });
    case "appointment-conflict": return Response.json({ error: "Termin ili pregled su u međuvremenu izmijenjeni." }, { status: 409 });
    case "success": return Response.json({ success: true });
  }
}

export function examinationConflictResponse(error: unknown) {
  if (
    (error instanceof Error && (error.message === "APPOINTMENT_STATUS_CONFLICT" || error.message === "EXAMINATION_STATUS_CONFLICT")) ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
  ) {
    return Response.json({ error: "Termin ili pregled su u međuvremenu izmijenjeni. Osvježite stranicu." }, { status: 409 });
  }
  throw error;
}
