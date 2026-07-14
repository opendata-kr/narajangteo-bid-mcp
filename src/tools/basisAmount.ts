import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { BASIS_OP, BASIS_KINDS, type BasisKind } from "../api/endpoints.js";
import { RawBasisSchema } from "../api/schema.js";
import { formatBasis } from "../format.js";
import { runOps, type OpOutcome } from "../api/runOps.js";
import type { BidBasisAmount } from "../api/types.js";

export const basisAmountInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호 (예: R25BK00932003)"),
  bidKind: z.enum(["thng", "cnstwk", "servc"]).optional()
    .describe("업무구분(thng=물품, cnstwk=공사, servc=용역). 기초금액은 이 3구분만 존재. 미지정 시 3구분 병렬 조회로 API 요청 3건 소모(지정 시 1건)"),
};
// inputSchema에서 파생해 shape와 타입의 원천을 하나로 유지한다.
export type BasisAmountArgs = z.infer<z.ZodObject<typeof basisAmountInputShape>>;

export interface BasisAmountResult {
  bidNtceNo: string; anySucceeded: boolean;
  results: Partial<Record<BasisKind, OpOutcome<BidBasisAmount>>>;
}

export async function runBasisAmount(client: DataGoKrClient, args: BasisAmountArgs): Promise<BasisAmountResult> {
  const kinds: readonly BasisKind[] = args.bidKind ? [args.bidKind] : BASIS_KINDS;
  const params = { inqryDiv: "2", bidNtceNo: args.bidNtceNo, numOfRows: 100, pageNo: 1 };
  const { results, anySucceeded } = await runOps(
    client, kinds.map((k) => ({ label: k, op: BASIS_OP[k], params })), RawBasisSchema, formatBasis,
  );
  return { bidNtceNo: args.bidNtceNo, anySucceeded, results };
}
