import { createServerFn } from "@tanstack/react-start";
import type { LuxRegistry } from "@/lib/lux-registry";

export const getLuxRegistry = createServerFn({ method: "GET" }).handler(
  async (): Promise<LuxRegistry> => {
    const { loadLuxRegistry } = await import("@/lib/lux-registry.server");
    return loadLuxRegistry({ withCitations: true });
  },
);
