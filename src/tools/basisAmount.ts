import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { BASIS_OP, BASIS_KINDS } from "../api/endpoints.js";
import { formatBasis } from "../format.js";
import { runOps, type OpOutcome } from "../api/runOps.js";
import type { BidBasisAmount } from "../api/types.js";

type BasisKind = "thng" | "cnstwk" | "servc";

export const basisAmountInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호 (예: R25BK00932003)"),
  bidKind: z.enum(["thng", "cnstwk", "servc"]).optional()
    .describe("업무구분(thng=물품, cnstwk=공사, servc=용역). 기초금액은 이 3구분만 존재. 미지정 시 3구분 병렬"),
};
export type BasisAmountArgs = { bidNtceNo: string; bidKind?: BasisKind };

export interface BasisAmountResult {
  bidNtceNo: string; anySucceeded: boolean;
  results: Record<string, OpOutcome<BidBasisAmount>>;
}

export async function runBasisAmount(client: DataGoKrClient, args: BasisAmountArgs): Promise<BasisAmountResult> {
  const kinds = (args.bidKind ? [args.bidKind] : BASIS_KINDS) as BasisKind[];
  const params = { inqryDiv: "2", bidNtceNo: args.bidNtceNo, numOfRows: 100, pageNo: 1 };
  const { results, anySucceeded } = await runOps(
    client, kinds.map((k) => ({ label: k, op: BASIS_OP[k], params })), formatBasis,
  );
  return { bidNtceNo: args.bidNtceNo, anySucceeded, results };
}
