import { createServerFn } from "@tanstack/react-start";

/** Builds the weekly tracker workbook on demand and returns it base64 encoded. */
export const buildWeeklyWorkbookNow = createServerFn({ method: "GET" }).handler(async () => {
  const { buildWeeklyWorkbook } = await import("./weekly-workbook.server");
  const book = await buildWeeklyWorkbook();
  return book;
});
