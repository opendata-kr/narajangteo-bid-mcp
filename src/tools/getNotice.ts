import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import {
  ALL_BID_KINDS,
  type BidKind,
  listOperation,
} from "../api/endpoints.js";
import { formatItem } from "../format.js";
import type { BidNotice } from "../api/types.js";

export const getNoticeInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호 (예: R25BK00932003)"),
  bidKind: z
    .enum(["cnstwk", "servc", "thng", "frgcpt"])
    .optional()
    .describe(
      "업무구분(cnstwk=공사, servc=용역, thng=물품, frgcpt=외자). 미지정 시 전 구분에서 조회",
    ),
};

export type GetNoticeArgs = { bidNtceNo: string; bidKind?: BidKind };

export interface GetNoticeResult {
  found: boolean;
  bidKind?: BidKind;
  notice?: BidNotice;
  searchedKinds: BidKind[];
}

export async function runGetNotice(
  client: DataGoKrClient,
  args: GetNoticeArgs,
): Promise<GetNoticeResult> {
  const kinds: BidKind[] = args.bidKind ? [args.bidKind] : [...ALL_BID_KINDS];
  const params = { inqryDiv: "2", bidNtceNo: args.bidNtceNo, numOfRows: 10, pageNo: 1 };

  const settled = await Promise.allSettled(
    kinds.map((kind) => client.call(listOperation(kind), { ...params })),
  );

  const errorMessages: string[] = [];
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
    if (s.status === "rejected") {
      const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
      if (!errorMessages.includes(msg)) errorMessages.push(msg);
    }
  }

  if (errorMessages.length > 0) {
    throw new Error(`입찰공고 조회 중 오류: ${errorMessages.join("; ")}`);
  }
  return { found: false, searchedKinds: kinds };
}
