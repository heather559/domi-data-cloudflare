import { createServerFn } from "@tanstack/react-start";
import type { AlertCheckResult } from "@/lib/pipeline-runs";

export const runPipelineAlertCheckNow = createServerFn({ method: "POST" }).handler(
  async (): Promise<AlertCheckResult> => {
    const { runPipelineAlertCheck } = await import("@/lib/pipeline-alerts.server");
    return runPipelineAlertCheck();
  },
);
