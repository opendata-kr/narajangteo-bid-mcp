import { z } from "zod";
import { callOperation } from "../api/client.js";
import {
  ALL_BID_KINDS,
  type BidKind,
  listOperation,
} from "../api/endpoints.js";
import type { AppConfig } from "../config.js";
import { formatItem } from "../format.js";
import type { BidNotice } from "../api/types.js";

export const getNoticeInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호 (예: R25BK00932003)"),
  bidKind: z
    .enum(["cnstwk", "servc", "thng", "frgcpt"])
    .optional()
    .describe("업무구분. 미지정 시 전 구분에서 조회"),
};

export type GetNoticeArgs = { bidNtceNo: string; bidKind?: BidKind };

export interface GetNoticeResult {
  found: boolean;
  bidKind?: BidKind;
  notice?: BidNotice;
  searchedKinds: BidKind[];
}

export interface GetNoticeDeps {
  callFn?: typeof callOperation;
}

export async function runGetNotice(
  config: AppConfig,
  args: GetNoticeArgs,
  deps: GetNoticeDeps = {},
): Promise<GetNoticeResult> {
  const callFn = deps.callFn ?? callOperation;
  const kinds: BidKind[] = args.bidKind ? [args.bidKind] : [...ALL_BID_KINDS];
  const params = { inqryDiv: "2", bidNtceNo: args.bidNtceNo, numOfRows: 10, pageNo: 1 };

  const settled = await Promise.allSettled(
    kinds.map((kind) => callFn(config, listOperation(kind), { ...params })),
  );

  for (let i = 0; i < kinds.length; i++) {
    const s = settled[i]!;
    if (s.status === "fulfilled" && s.value.items.length > 0) {
      return {
        found: true,
        bidKind: kinds[i]!,
        notice: formatItem(s.value.items[0]!),
        searchedKinds: kinds,
      };
    }
  }
  return { found: false, searchedKinds: kinds };
}
