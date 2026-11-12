import assert from "node:assert/strict";
import test from "node:test";
import { animalInputSchema } from "../features/animals/validation.ts";

const validAnimal = {
  name: "Maza",
  species: "Pas",
  ownerId: "2db14280-b50f-4b24-bbfc-ed42e715fc84",
  dateOfBirth: "2020-02-29",
  weightKg: "12.375",
  status: "ACTIVE",
};

test("animal input accepts valid optional fields and a real calendar date", () => {
  assert.equal(animalInputSchema.safeParse(validAnimal).success, true);
});

test("animal input rejects impossible dates and non-positive weights", () => {
  assert.equal(
    animalInputSchema.safeParse({ ...validAnimal, dateOfBirth: "2021-02-29" }).success,
    false,
  );
  assert.equal(animalInputSchema.safeParse({ ...validAnimal, weightKg: "0" }).success, false);
  assert.equal(animalInputSchema.safeParse({ ...validAnimal, weightKg: "-2" }).success, false);
});

test("animal input requires a valid owner identifier and name", () => {
  assert.equal(animalInputSchema.safeParse({ ...validAnimal, ownerId: "invalid" }).success, false);
  assert.equal(animalInputSchema.safeParse({ ...validAnimal, name: " " }).success, false);
});
