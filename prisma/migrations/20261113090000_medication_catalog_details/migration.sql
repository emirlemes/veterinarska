ALTER TABLE "medications"
  ADD COLUMN "category" VARCHAR(100),
  ADD COLUMN "manufacturer" VARCHAR(180),
  ADD COLUMN "selling_price" DECIMAL(12, 2);

ALTER TABLE "medications"
  ADD CONSTRAINT "medications_selling_price_nonnegative"
  CHECK ("selling_price" IS NULL OR "selling_price" >= 0);
