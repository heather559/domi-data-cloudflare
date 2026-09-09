import { createServerFn } from "@tanstack/react-start";
import type { PipelineRun } from "@/lib/pipeline-runs";

export const listPipelineRunsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PipelineRun[]> => {
    const { listPipelineRuns } = await import("@/lib/pipeline-runs.server");
    return listPipelineRuns();
  },
);
