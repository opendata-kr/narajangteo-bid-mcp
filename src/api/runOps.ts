import type { DataGoKrClient, OperationResult, RawItem } from "@opendata-kr/core";
import { withKeyHint } from "./errorHint.js";

export type OpOutcome<T> =
  | { status: "ok"; totalCount: number; items: T[] }
  | { status: "error"; error: string };

export interface OpCall {
  label: string;
  op: string;
  params: Record<string, string | number | undefined>;
}

export async function runOps<T>(
  client: DataGoKrClient,
  calls: OpCall[],
  format: (r: RawItem) => T,
): Promise<{ results: Record<string, OpOutcome<T>>; anySucceeded: boolean }> {
  const settled = await Promise.allSettled(
    calls.map((c) => client.call(c.op, { ...c.params })),
  );
  const results: Record<string, OpOutcome<T>> = {};
  let anySucceeded = false;
  settled.forEach((s, i) => {
    const label = calls[i]!.label;
    if (s.status === "fulfilled") {
      const op: OperationResult = s.value;
      results[label] = { status: "ok", totalCount: op.totalCount, items: op.items.map(format) };
      anySucceeded = true;
    } else {
      const r = s.reason;
      const msg = r instanceof Error ? r.message : String(r);
      results[label] = { status: "error", error: withKeyHint(client, msg) };
    }
  });
  return { results, anySucceeded };
}
