import assert from "node:assert/strict";
import test from "node:test";
import {
  clinicDateTimeToUtc,
  getClinicDate,
  getClinicDateBounds,
  getClinicDayBounds,
} from "./dates.ts";

test("clinic day bounds use the Sarajevo timezone", () => {
  const { start, end } = getClinicDayBounds(new Date("2026-01-15T12:00:00.000Z"));

  assert.equal(start.toISOString(), "2026-01-14T23:00:00.000Z");
  assert.equal(end.toISOString(), "2026-01-15T23:00:00.000Z");
});

test("clinic day bounds account for the spring daylight-saving transition", () => {
  const { start, end } = getClinicDayBounds(new Date("2026-03-29T12:00:00.000Z"));

  assert.equal(start.toISOString(), "2026-03-28T23:00:00.000Z");
  assert.equal(end.toISOString(), "2026-03-29T22:00:00.000Z");
});

test("clinic day bounds account for the autumn daylight-saving transition", () => {
  const { start, end } = getClinicDayBounds(new Date("2026-10-25T12:00:00.000Z"));

  assert.equal(start.toISOString(), "2026-10-24T22:00:00.000Z");
  assert.equal(end.toISOString(), "2026-10-25T23:00:00.000Z");
});

test("clinic date-time input uses Sarajevo time regardless of device timezone", () => {
  assert.equal(clinicDateTimeToUtc("2026-01-15T09:00")?.toISOString(), "2026-01-15T08:00:00.000Z");
  assert.equal(clinicDateTimeToUtc("2026-07-15T09:00")?.toISOString(), "2026-07-15T07:00:00.000Z");
  assert.equal(clinicDateTimeToUtc("2026-03-29T02:30"), null);
});

test("clinic date and day bounds use valid Sarajevo calendar dates", () => {
  assert.equal(getClinicDate(new Date("2026-01-14T23:30:00.000Z")), "2026-01-15");
  assert.equal(getClinicDateBounds("2026-02-29"), null);
  assert.equal(getClinicDateBounds("2026-02-28")?.start.toISOString(), "2026-02-27T23:00:00.000Z");
});
