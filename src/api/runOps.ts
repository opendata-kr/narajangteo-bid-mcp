import type { DataGoKrClient, RawItem } from "@opendata-kr/core";
import { fanOut, withKeyHint, errMessage } from "@opendata-kr/core";

export type OpOutcome<T> =
  | { status: "ok"; totalCount: number; items: T[] }
  | { status: "error"; error: string };

export interface OpCall {
  label: string;
  op: string;
  params: Record<string, string | number | undefined>;
}

// 여러 오퍼레이션(kind)을 core fanOut으로 병렬 호출하고 label 결과맵으로 부분 실패를 격리한다.
// 반환 shape(OpOutcome status 태그·anySucceeded)는 발행된 도구 출력계약이라 유지한다.
export async function runOps<T>(
  client: DataGoKrClient,
  calls: OpCall[],
  format: (r: RawItem) => T,
): Promise<{ results: Record<string, OpOutcome<T>>; anySucceeded: boolean }> {
  const { results: outcomes, anySucceeded } = await fanOut(
    calls,
    async (c) => {
      const op = await client.call(c.op, { ...c.params });
      return { totalCount: op.totalCount, items: op.items.map(format) };
    },
    {
      label: (c) => c.label,
      concurrency: calls.length,
      mapError: (e) => withKeyHint(client, errMessage(e)),
    },
  );
  const results: Record<string, OpOutcome<T>> = {};
  for (const c of calls) {
    const o = outcomes[c.label]!; // fanOut이 모든 label을 채우므로 non-null (noUncheckedIndexedAccess 대응)
    results[c.label] = o.ok ? { status: "ok", ...o.value } : { status: "error", error: o.error };
  }
  return { results, anySucceeded };
}
