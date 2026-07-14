import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { ITEM_OP, ITEM_KINDS, type ItemKind } from "../api/endpoints.js";
import { RawBidItemSchema } from "../api/schema.js";
import { formatItemRow } from "../format.js";
import { runOps, type OpOutcome } from "../api/runOps.js";
import type { BidItem } from "../api/types.js";

export const itemsInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호 (예: R25BK00932003)"),
  bidNtceOrd: z.string().optional()
    .describe("입찰공고차수(예: 000). 구매대상물품은 차수 단위라 필수. get_bid_notice 결과의 bidNtceOrd에서 확인. 미지정 시 000"),
  bidKind: z.enum(["thng", "servc", "frgcpt"]).optional()
    .describe("업무구분(thng=물품, servc=용역, frgcpt=외자). 공사는 구매대상물품 없음. 미지정 시 3구분 병렬 조회로 API 요청 3건 소모(지정 시 1건)"),
};
// inputSchema에서 파생해 shape와 타입의 원천을 하나로 유지한다.
export type ItemsArgs = z.infer<z.ZodObject<typeof itemsInputShape>>;

export interface ItemsResult {
  bidNtceNo: string; bidNtceOrd: string; anySucceeded: boolean;
  results: Partial<Record<ItemKind, OpOutcome<BidItem>>>;
}

export async function runItems(client: DataGoKrClient, args: ItemsArgs): Promise<ItemsResult> {
  const bidNtceOrd = args.bidNtceOrd ?? "000";
  const kinds: readonly ItemKind[] = args.bidKind ? [args.bidKind] : ITEM_KINDS;
  const params = { inqryDiv: "2", bidNtceNo: args.bidNtceNo, bidNtceOrd, numOfRows: 100, pageNo: 1 };
  const { results, anySucceeded } = await runOps(
    client, kinds.map((k) => ({ label: k, op: ITEM_OP[k], params })), RawBidItemSchema, formatItemRow,
  );
  return { bidNtceNo: args.bidNtceNo, bidNtceOrd, anySucceeded, results };
}
