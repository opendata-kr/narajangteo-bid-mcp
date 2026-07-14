import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { EVAL_OPS } from "../api/endpoints.js";
import { RawEvaluationSchema } from "../api/schema.js";
import { formatEvaluation } from "../format.js";
import { runOps, type OpOutcome } from "../api/runOps.js";
import type { BidEvaluation } from "../api/types.js";

export const evaluationInputShape = {
  bidNtceNo: z
    .string()
    .describe(
      "입찰공고번호 (예: R25BK00932003). 낙찰가 산정 산식A(국민연금·건강보험 등 합산항목)와 평가대상 주력분야를 함께 반환. 기초금액은 get_bid_basis_amount 도구로 조회.",
    ),
};
// inputSchema에서 파생해 shape와 타입의 원천을 하나로 유지한다.
export type EvaluationArgs = z.infer<z.ZodObject<typeof evaluationInputShape>>;

const LABELS = ["priceFormula", "targetField"] as const; // C, G 순서(EVAL_OPS와 정렬)
type EvalLabel = (typeof LABELS)[number];

export interface EvaluationResult {
  bidNtceNo: string;
  anySucceeded: boolean;
  results: Record<EvalLabel, OpOutcome<BidEvaluation>>;
}

export async function runEvaluation(
  client: DataGoKrClient,
  args: EvaluationArgs,
): Promise<EvaluationResult> {
  const calls = EVAL_OPS.map((o, i) => ({
    label: LABELS[i]!,
    op: o.op,
    params: { inqryDiv: o.byNoInqryDiv, bidNtceNo: args.bidNtceNo, numOfRows: 100, pageNo: 1 },
  }));
  const { results, anySucceeded } = await runOps(client, calls, RawEvaluationSchema, formatEvaluation);
  return { bidNtceNo: args.bidNtceNo, anySucceeded, results };
}
