import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentCalendarQuerySchema,
  appointmentInputSchema,
  appointmentListQuerySchema,
  appointmentStatusSchema,
  appointmentUpdateSchema,
  canTransitionAppointment,
  getAppointmentTransitions,
} from "../features/appointments/validation.ts";
import {
  getAppointmentMonthDates,
  getAppointmentWeekDates,
} from "../features/appointments/calendar.ts";

const validAppointment = {
  clientId: "2db14280-b50f-4b24-bbfc-ed42e715fc84",
  animalId: "7e0e166a-7816-4f75-bbb4-d663c495c624",
  veterinarianId: "a88eece2-a766-4412-8d34-42a63a0ac9fd",
  startsAt: "2026-11-11T09:00",
  endsAt: "2026-11-11T09:30",
  reason: "Kontrolni pregled",
};

test("appointment input requires valid ids, a reason, and increasing times", () => {
  assert.equal(appointmentInputSchema.safeParse(validAppointment).success, true);
  assert.equal(appointmentUpdateSchema.safeParse(validAppointment).success, true);
  assert.equal(
    appointmentInputSchema.safeParse({ ...validAppointment, endsAt: "2026-11-11T09:00" }).success,
    false,
  );
  assert.equal(
    appointmentInputSchema.safeParse({ ...validAppointment, veterinarianId: "invalid" }).success,
    false,
  );
  assert.equal(
    appointmentInputSchema.safeParse({ ...validAppointment, reason: " " }).success,
    false,
  );
  assert.equal(
    appointmentStatusSchema.safeParse({ status: "CONFIRMED", startsAt: "ignored" }).success,
    false,
  );
});

test("appointment status changes follow allowed workflow transitions", () => {
  assert.equal(canTransitionAppointment("SCHEDULED", "CONFIRMED"), true);
  assert.equal(canTransitionAppointment("IN_PROGRESS", "COMPLETED"), true);
  assert.equal(canTransitionAppointment("COMPLETED", "IN_PROGRESS"), false);
  assert.equal(canTransitionAppointment("CANCELLED", "CONFIRMED"), false);
  assert.deepEqual(getAppointmentTransitions("NO_SHOW"), []);
});

test("calendar week starts on Monday and includes seven valid dates", () => {
  assert.deepEqual(getAppointmentWeekDates("2026-11-11"), [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ]);
  assert.deepEqual(getAppointmentWeekDates("2026-11-15")?.[0], "2026-11-09");
  assert.deepEqual(getAppointmentWeekDates("2024-03-01"), [
    "2024-02-26",
    "2024-02-27",
    "2024-02-28",
    "2024-02-29",
    "2024-03-01",
    "2024-03-02",
    "2024-03-03",
  ]);
  assert.equal(getAppointmentWeekDates("2026-02-30"), null);
});

test("appointment list filters validate search text and calendar veterinarian", () => {
  assert.equal(
    appointmentListQuerySchema.safeParse({
      date: "2026-11-11",
      status: "all",
      search: "Luna",
    }).success,
    true,
  );
  assert.equal(
    appointmentListQuerySchema.safeParse({
      date: "2026-11-11",
      status: "all",
      search: "a".repeat(101),
    }).success,
    false,
  );
  assert.equal(
    appointmentCalendarQuerySchema.safeParse({
      date: "2026-11-11",
      status: "all",
      veterinarianId: "all",
      view: "month",
    }).success,
    true,
  );
});

test("monthly calendar fills Monday-first rows and handles leap February", () => {
  const february = getAppointmentMonthDates("2024-02-20");
  assert.ok(february);
  assert.equal(february.length, 35);
  assert.equal(february[0], "2024-01-29");
  assert.equal(february[3], "2024-02-01");
  assert.equal(february[31], "2024-02-29");
  assert.equal(february[34], "2024-03-03");

  const march = getAppointmentMonthDates("2026-03-12");
  assert.ok(march);
  assert.equal(march.length, 42);
  assert.equal(march[0], "2026-02-23");
  assert.equal(march[41], "2026-04-05");
  assert.equal(getAppointmentMonthDates("2026-02-30"), null);
});
