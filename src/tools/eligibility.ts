import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { ELIG_OPS } from "../api/endpoints.js";
import { RawEligibilitySchema } from "../api/schema.js";
import { formatEligibility } from "../format.js";
import { runOps, type OpOutcome } from "../api/runOps.js";
import type { BidEligibility } from "../api/types.js";

export const eligibilityInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호 (예: R25BK00932003)"),
  bidNtceOrd: z.string().optional()
    .describe("입찰공고차수(예: 000). 면허제한·참가가능지역은 차수 단위라 필수. 차수는 get_bid_notice 결과의 bidNtceOrd에서 확인. 미지정 시 000"),
};
// inputSchema에서 파생해 shape와 타입의 원천을 하나로 유지한다.
export type EligibilityArgs = z.infer<z.ZodObject<typeof eligibilityInputShape>>;

const LABELS = ["licenseLimit", "region"] as const; // E, F 순서(ELIG_OPS 정렬)
type EligLabel = (typeof LABELS)[number];

export interface EligibilityResult {
  bidNtceNo: string; bidNtceOrd: string; anySucceeded: boolean;
  results: Record<EligLabel, OpOutcome<BidEligibility>>;
}

export async function runEligibility(client: DataGoKrClient, args: EligibilityArgs): Promise<EligibilityResult> {
  const bidNtceOrd = args.bidNtceOrd ?? "000";
  const calls = ELIG_OPS.map((o, i) => ({
    label: LABELS[i]!, op: o.op,
    params: { inqryDiv: o.byNoInqryDiv, bidNtceNo: args.bidNtceNo, bidNtceOrd, numOfRows: 100, pageNo: 1 },
  }));
  const { results, anySucceeded } = await runOps(client, calls, RawEligibilitySchema, formatEligibility);
  return { bidNtceNo: args.bidNtceNo, bidNtceOrd, anySucceeded, results };
}
