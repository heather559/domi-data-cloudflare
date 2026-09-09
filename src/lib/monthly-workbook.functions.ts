import { createServerFn } from "@tanstack/react-start";

/** Builds the monthly tracker workbook on demand and returns it base64 encoded. */
export const buildMonthlyWorkbookNow = createServerFn({ method: "GET" }).handler(async () => {
  const { buildMonthlyWorkbook } = await import("./monthly-workbook.server");
  const book = await buildMonthlyWorkbook();
  return book;
});
