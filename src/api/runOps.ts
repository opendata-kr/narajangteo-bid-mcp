import type { DataGoKrClient, Params, StandardSchemaV1 } from "@opendata-kr/core";
import { fanOut } from "@opendata-kr/core";

export type OpOutcome<T> =
  | { status: "ok"; totalCount: number; invalidCount: number; items: T[] }
  | { status: "error"; error: string };

export interface OpCall<K extends string> {
  label: K;
  op: string;
  params: Params;
}

// 여러 오퍼레이션(kind)을 core fanOut으로 병렬 호출하고 label 결과맵으로 부분 실패를 격리한다.
// item은 schema로 검증해 통과분만 format하고, 탈락 건수는 invalidCount로 노출한다.
// label은 호출부 리터럴 유니온(K)을 보존해 결과맵 키에 자동완성·완전성 검사가 붙는다.
// 에러 문자열화·키 힌트는 core(fanOut 기본 errMessage·클라이언트 기본 인터셉터)가 처리한다.
// 반환 shape(OpOutcome status 태그·anySucceeded)는 발행된 도구 출력계약이라 유지한다.
export async function runOps<Raw, T, K extends string>(
  client: DataGoKrClient,
  calls: OpCall<K>[],
  schema: StandardSchemaV1<unknown, Raw>,
  format: (r: Raw) => T,
): Promise<{ results: Record<K, OpOutcome<T>>; anySucceeded: boolean }> {
  const { results: outcomes, anySucceeded } = await fanOut(
    calls,
    async (c) => {
      const r = await client.get(c.op, { params: { ...c.params }, schema });
      return { totalCount: r.totalCount, invalidCount: r.invalid.length, items: r.data.map(format) };
    },
    { label: (c) => c.label, concurrency: calls.length },
  );
  const results = {} as Record<K, OpOutcome<T>>;
  for (const c of calls) {
    const o = outcomes[c.label];
    results[c.label] = o.ok ? { status: "ok", ...o.value } : { status: "error", error: o.error };
  }
  return { results, anySucceeded };
}
