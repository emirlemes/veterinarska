import assert from "node:assert/strict";
import test from "node:test";
import {
  canCompleteExamination,
  examinationInputSchema,
  examinationServiceInputSchema,
  examinationUpdateSchema,
  therapyInputSchema,
} from "../features/examinations/validation.ts";
import {
  getMedicationStockState,
  medicationBatchInputSchema,
  medicationInputSchema,
  stockAdjustmentSchema,
  stockMovementReportQuerySchema,
} from "../features/inventory/validation.ts";
import {
  calculateInvoiceTotals,
  getInvoiceStatus,
  invoiceInputSchema,
  invoiceVoidInputSchema,
  paymentInputSchema,
  paymentReversalInputSchema,
} from "../features/invoices/validation.ts";
import { getInitialInvoiceItems } from "../features/invoices/initial-items.ts";
import { reportDateRangeSchema } from "../features/reports/validation.ts";
import {
  serviceInputSchema,
  serviceUpdateSchema,
} from "../features/services/validation.ts";
import {
  employeeInputSchema,
  employeeUpdateSchema,
} from "../features/employees/validation.ts";
import {
  checkAppointmentWorkingHours,
  clinicSettingsSchema,
  defaultWorkingHours,
} from "../features/settings/validation.ts";

const validInput = {
  clientId: "11111111-1111-4111-8111-111111111111",
  animalId: "22222222-2222-4222-8222-222222222222",
  veterinarianId: "33333333-3333-4333-8333-333333333333",
  appointmentId: "",
  chiefComplaint: "Kontrolni pregled",
};

test("accepts walk-in examination input without an appointment", () => {
  const parsed = examinationInputSchema.safeParse(validInput);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.appointmentId, "");
});

test("rejects malformed relation identifiers and oversized clinical text", () => {
  assert.equal(
    examinationInputSchema.safeParse({ ...validInput, clientId: "not-a-uuid" }).success,
    false,
  );
  assert.equal(
    examinationInputSchema.safeParse({ ...validInput, notes: "x".repeat(10001) }).success,
    false,
  );
});

test("accepts supported examination updates and rejects unsupported status changes", () => {
  const input = {
    ...validInput,
    appointmentId: "",
    id: "44444444-4444-4444-8444-444444444444",
    status: "COMPLETED",
  };
  assert.equal(examinationUpdateSchema.safeParse(input).success, true);
  assert.equal(examinationUpdateSchema.safeParse({ ...input, status: "CANCELLED" }).success, false);
});

test("only an in-progress examination can be completed", () => {
  assert.equal(canCompleteExamination("IN_PROGRESS"), true);
  assert.equal(canCompleteExamination("COMPLETED"), false);
});

test("therapy input requires a name and validates clinical field lengths", () => {
  assert.equal(therapyInputSchema.safeParse({ name: "Kontrola ishrane" }).success, true);
  assert.equal(therapyInputSchema.safeParse({ name: "  " }).success, false);
  assert.equal(
    therapyInputSchema.safeParse({ name: "Terapija", dosage: "x".repeat(161) }).success,
    false,
  );
  assert.equal(
    therapyInputSchema.safeParse({ name: "Terapija", instructions: "x".repeat(10001) }).success,
    false,
  );
});

test("performed examination services validate catalog ids and positive quantities", () => {
  const validService = {
    serviceId: "44444444-4444-4444-8444-444444444444",
    quantity: "1.5",
  };
  assert.equal(examinationServiceInputSchema.safeParse(validService).success, true);
  assert.equal(
    examinationServiceInputSchema.safeParse({ ...validService, quantity: "0" }).success,
    false,
  );
  assert.equal(
    examinationServiceInputSchema.safeParse({ ...validService, quantity: "1.001" }).success,
    false,
  );
  assert.equal(
    examinationServiceInputSchema.safeParse({ ...validService, serviceId: "invalid" }).success,
    false,
  );
});

test("medication stock receipt validates positive precise quantities and batch fields", () => {
  assert.equal(
    medicationBatchInputSchema.safeParse({ batchNumber: "A-1", quantity: "2.125" }).success,
    true,
  );
  assert.equal(
    medicationBatchInputSchema.safeParse({ batchNumber: "A-1", quantity: "0" }).success,
    false,
  );
  assert.equal(
    medicationBatchInputSchema.safeParse({ batchNumber: "A-1", quantity: "1.1234" }).success,
    false,
  );
  assert.equal(medicationInputSchema.safeParse({ name: "Lijek", unit: "ml" }).success, true);
  assert.equal(medicationInputSchema.safeParse({ name: "", unit: "ml" }).success, false);
});

test("stock thresholds distinguish empty, low and sufficient stock", () => {
  assert.equal(getMedicationStockState(0, 4), "OUT_OF_STOCK");
  assert.equal(getMedicationStockState(4, 4), "LOW_STOCK");
  assert.equal(getMedicationStockState(5, 4), "IN_STOCK");
});

test("stock corrections require a valid direction, positive quantity and reason", () => {
  assert.equal(
    stockAdjustmentSchema.safeParse({
      direction: "REMOVE",
      quantity: "1.25",
      reason: "Ispravka inventure",
    }).success,
    true,
  );
  assert.equal(
    stockAdjustmentSchema.safeParse({
      direction: "REMOVE",
      quantity: "1",
      reason: "",
    }).success,
    false,
  );
  assert.equal(
    stockAdjustmentSchema.safeParse({
      direction: "INVENTORY",
      quantity: "1",
      reason: "Ispravka",
    }).success,
    false,
  );
});

test("stock movement report validates period, movement type and relation filters", () => {
  const validFilters = {
    from: "2026-11-01",
    to: "2026-11-30",
    medicationId: "all",
    userId: "all",
    type: "ADJUSTMENT",
  };
  assert.equal(stockMovementReportQuerySchema.safeParse(validFilters).success, true);
  assert.equal(
    stockMovementReportQuerySchema.safeParse({ ...validFilters, type: "UNKNOWN" }).success,
    false,
  );
  assert.equal(
    stockMovementReportQuerySchema.safeParse({ ...validFilters, medicationId: "invalid" }).success,
    false,
  );
  assert.equal(
    stockMovementReportQuerySchema.safeParse({
      ...validFilters,
      from: "2025-11-01",
      to: "2026-11-30",
    }).success,
    false,
  );
});

test("invoice lines and payments validate amounts and required relations", () => {
  const invoice = invoiceInputSchema.safeParse({
    clientId: "11111111-1111-4111-8111-111111111111",
    taxRate: "17",
    items: [{ description: "Pregled", quantity: "1", unitPrice: "50.00" }],
  });
  assert.equal(invoice.success, true);
  assert.equal(
    invoiceInputSchema.safeParse({
      clientId: "11111111-1111-4111-8111-111111111111",
      taxRate: "100",
      items: [{ description: "Pregled", quantity: "1", unitPrice: "50.00" }],
    }).success,
    true,
  );
  assert.equal(
    invoiceInputSchema.safeParse({
      clientId: "11111111-1111-4111-8111-111111111111",
      taxRate: "100.01",
      items: [{ description: "Pregled", quantity: "1", unitPrice: "50.00" }],
    }).success,
    false,
  );
  assert.equal(
    invoiceInputSchema.safeParse({
      clientId: "11111111-1111-4111-8111-111111111111",
      items: [],
    }).success,
    false,
  );
  assert.equal(
    paymentInputSchema.safeParse({ amount: "20", method: "CASH" }).success,
    true,
  );
  assert.equal(
    paymentInputSchema.safeParse({ amount: "0", method: "CASH" }).success,
    false,
  );
});

test("invoice totals and partial payment states calculate in integer cents", () => {
  assert.deepEqual(
    calculateInvoiceTotals([
      { quantity: "2", unitPrice: "12.50" },
      { quantity: "1", unitPrice: "5.00" },
    ], "10"),
    { subtotalCents: 3000, taxAmountCents: 300, totalCents: 3300 },
  );
  assert.equal(getInvoiceStatus(3300, 0), "ISSUED");
  assert.equal(getInvoiceStatus(3300, 1000), "PARTIALLY_PAID");
  assert.equal(getInvoiceStatus(3300, 3300), "PAID");
});

test("invoice lines use performed-service price snapshots and diagnosis fallback", () => {
  const performed = [
    { description: "Pregled", quantity: "1", unitPrice: "45.00" },
    { description: "Laboratorijski nalaz", quantity: "2", unitPrice: "12.50" },
  ];
  assert.deepEqual(getInitialInvoiceItems(performed, "Dijagnoza"), performed);
  assert.deepEqual(getInitialInvoiceItems([], "Dijagnoza"), [
    { description: "Dijagnoza", quantity: "1", unitPrice: "" },
  ]);
  assert.deepEqual(getInitialInvoiceItems([], null), [
    { description: "", quantity: "1", unitPrice: "" },
  ]);
});

test("payment reversals require a positive amount and a reason", () => {
  assert.equal(
    paymentReversalInputSchema.safeParse({ amount: "12.50", reason: "Pogrešno evidentirana uplata" }).success,
    true,
  );
  assert.equal(
    paymentReversalInputSchema.safeParse({ amount: "0", reason: "Greška" }).success,
    false,
  );
  assert.equal(
    paymentReversalInputSchema.safeParse({ amount: "10", reason: " " }).success,
    false,
  );
});

test("invoice voids require a non-empty reason within the supported length", () => {
  assert.equal(invoiceVoidInputSchema.safeParse({ reason: "Pogrešno izdat račun" }).success, true);
  assert.equal(invoiceVoidInputSchema.safeParse({ reason: " " }).success, false);
  assert.equal(invoiceVoidInputSchema.safeParse({ reason: "x".repeat(241) }).success, false);
});

test("financial report date ranges accept valid periods up to one year", () => {
  assert.equal(
    reportDateRangeSchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success,
    true,
  );
  assert.equal(
    reportDateRangeSchema.safeParse({ from: "2026-01-01", to: "2027-01-02" }).success,
    false,
  );
  assert.equal(
    reportDateRangeSchema.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success,
    false,
  );
});

test("service catalog validates names, prices and non-empty updates", () => {
  assert.equal(
    serviceInputSchema.safeParse({ name: "Vakcinacija", price: "35.50" }).success,
    true,
  );
  assert.equal(
    serviceInputSchema.safeParse({ name: " ", price: "35.50" }).success,
    false,
  );
  assert.equal(
    serviceInputSchema.safeParse({ name: "Pregled", price: "-1" }).success,
    false,
  );
  assert.equal(serviceUpdateSchema.safeParse({ isActive: false }).success, true);
  assert.equal(serviceUpdateSchema.safeParse({}).success, false);
});

test("employee accounts validate contact data, role and minimum password length", () => {
  const validEmployee = {
    firstName: "Amina",
    lastName: "Kovač",
    email: "amina@example.com",
    phone: "+387 61 123 456",
    password: "sigurna-lozinka-123",
    role: "VETERINARIAN",
  };
  assert.equal(employeeInputSchema.safeParse(validEmployee).success, true);
  assert.equal(employeeInputSchema.safeParse({ ...validEmployee, role: "ADMIN" }).success, true);
  const defaultRole = employeeInputSchema.safeParse({
    firstName: "Amina",
    lastName: "Kovač",
    email: "amina@example.com",
    password: "sigurna-lozinka-123",
  });
  assert.equal(defaultRole.success && defaultRole.data.role, "VETERINARIAN");
  assert.equal(
    employeeInputSchema.safeParse({ ...validEmployee, password: "kratka" }).success,
    false,
  );
  assert.equal(
    employeeInputSchema.safeParse({ ...validEmployee, role: "UNKNOWN" }).success,
    false,
  );
  assert.equal(
    employeeInputSchema.safeParse({ ...validEmployee, role: "DIRECTOR" }).success,
    false,
  );
  assert.equal(employeeUpdateSchema.safeParse({ isActive: false }).success, true);
  assert.equal(employeeUpdateSchema.safeParse({ password: "kratka" }).success, false);
  assert.equal(employeeUpdateSchema.safeParse({}).success, false);
});

test("clinic settings validate invoice defaults and appointment duration", () => {
  const validSettings = {
    clinicName: "VetCare",
    address: "Glavna 1",
    city: "Sarajevo",
    phone: "+387 33 123 456",
    email: "info@example.com",
    taxIdentificationNumber: "123456789",
    invoicePrefix: "VET-1",
    defaultTaxRate: "17",
    appointmentDurationMinutes: 45,
    workingHours: defaultWorkingHours,
  };
  assert.equal(clinicSettingsSchema.safeParse(validSettings).success, true);
  assert.equal(
    clinicSettingsSchema.safeParse({ ...validSettings, invoicePrefix: "lowercase" }).success,
    false,
  );
  assert.equal(
    clinicSettingsSchema.safeParse({ ...validSettings, defaultTaxRate: "101" }).success,
    false,
  );
  assert.equal(
    clinicSettingsSchema.safeParse({ ...validSettings, appointmentDurationMinutes: 0 }).success,
    false,
  );
  assert.equal(
    clinicSettingsSchema.safeParse({
      ...validSettings,
      workingHours: {
        ...defaultWorkingHours,
        "1": { enabled: true, start: "17:00", end: "09:00" },
      },
    }).success,
    false,
  );
});

test("appointments must fit within configured clinic working hours", () => {
  assert.equal(
    checkAppointmentWorkingHours("2026-11-09T09:00", "2026-11-09T09:30", defaultWorkingHours),
    "allowed",
  );
  assert.equal(
    checkAppointmentWorkingHours("2026-11-09T08:30", "2026-11-09T09:30", defaultWorkingHours),
    "outside-hours",
  );
  assert.equal(
    checkAppointmentWorkingHours("2026-11-15T10:00", "2026-11-15T10:30", defaultWorkingHours),
    "closed",
  );
  assert.equal(
    checkAppointmentWorkingHours("2026-11-09T23:30", "2026-11-10T00:30", defaultWorkingHours),
    "outside-hours",
  );
  assert.equal(
    checkAppointmentWorkingHours("2026-11-09T10:00", "2026-11-09T10:30", null),
    "allowed",
  );
});
