export type ExaminationInvoiceService = {
  description: string;
  quantity: string;
  unitPrice: string;
};

export function getInitialInvoiceItems(
  services: ExaminationInvoiceService[],
  diagnosis: string | null,
): ExaminationInvoiceService[] {
  if (services.length) return services;
  return [{ description: diagnosis ?? "", quantity: "1", unitPrice: "" }];
}
