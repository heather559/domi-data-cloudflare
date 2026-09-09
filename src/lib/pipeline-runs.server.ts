// Server-only reader for public.pipeline_run_status. The table is closed to the
// Data API, so reads go through the privileged client from here only.
import type { PipelineRun } from "@/lib/pipeline-runs";

interface RawRun {
  agent_name?: string;
  week_start?: string;
  started_at?: string;
  completed_at?: string | null;
  status?: string;
  detail?: string | null;
}

export async function listPipelineRuns(): Promise<PipelineRun[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data, error } = await client
      .from("pipeline_run_status")
      .select("agent_name, week_start, started_at, completed_at, status, detail")
      .order("started_at", { ascending: false })
      .limit(2000);
    if (error) throw error;
    return ((data ?? []) as RawRun[]).map((r) => ({
      agentName: r.agent_name ?? "unknown",
      weekStart: r.week_start ?? "",
      startedAt: r.started_at ?? "",
      completedAt: r.completed_at ?? null,
      status: r.status ?? "unknown",
      detail: r.detail ?? null,
    }));
  } catch (err) {
    console.error("[pipeline_run_status] list failed:", err);
    return [];
  }
}
