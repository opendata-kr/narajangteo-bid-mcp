import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { CHANGE_OP, CHANGE_KINDS, type ChangeKind } from "../api/endpoints.js";
import { RawChangeSchema } from "../api/schema.js";
import { formatChange } from "../format.js";
import { runOps, type OpOutcome } from "../api/runOps.js";
import type { BidChange } from "../api/types.js";

export const changeHistoryInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호 (예: R25BK00932003). 이 도구는 공고의 변경이력(정정·변경 항목)을 반환. 기초금액은 get_bid_basis_amount, 참가자격은 get_bid_eligibility로 조회"),
  bidKind: z.enum(["thng", "cnstwk", "servc"]).optional()
    .describe("업무구분(thng=물품, cnstwk=공사, servc=용역). 변경이력은 이 3구분만. 미지정 시 3구분 병렬 조회로 API 요청 3건 소모(지정 시 1건)"),
};
// inputSchema에서 파생해 shape와 타입의 원천을 하나로 유지한다.
export type ChangeHistoryArgs = z.infer<z.ZodObject<typeof changeHistoryInputShape>>;

export interface ChangeHistoryResult {
  bidNtceNo: string; anySucceeded: boolean;
  results: Partial<Record<ChangeKind, OpOutcome<BidChange>>>;
}

export async function runChangeHistory(client: DataGoKrClient, args: ChangeHistoryArgs): Promise<ChangeHistoryResult> {
  const kinds: readonly ChangeKind[] = args.bidKind ? [args.bidKind] : CHANGE_KINDS;
  const params = { inqryDiv: "2", bidNtceNo: args.bidNtceNo, numOfRows: 100, pageNo: 1 };
  const { results, anySucceeded } = await runOps(
    client, kinds.map((k) => ({ label: k, op: CHANGE_OP[k], params })), RawChangeSchema, formatChange,
  );
  return { bidNtceNo: args.bidNtceNo, anySucceeded, results };
}
