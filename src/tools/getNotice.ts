import { z } from "zod";
import { errMessage, type DataGoKrClient } from "@opendata-kr/core";
import { listOperation, type BidKind } from "../api/endpoints.js";
import { RawBidNoticeSchema } from "../api/schema.js";
import { formatItem } from "../format.js";
import type { BidNotice } from "../api/types.js";

const DEFAULT_KINDS: BidKind[] = ["cnstwk", "servc", "thng", "frgcpt"];

export const getNoticeInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호 (예: R25BK00932003)"),
  bidKind: z.enum(["cnstwk", "servc", "thng", "frgcpt", "etc"]).optional()
    .describe("업무구분(cnstwk=공사, servc=용역, thng=물품, frgcpt=외자, etc=기타). 미지정 시 기타 제외 4구분 조회로 API 요청 4건 소모(지정 시 1건). 기타공고는 etc 명시"),
};
// inputSchema에서 파생해 shape와 타입의 원천을 하나로 유지한다.
export type GetNoticeArgs = z.infer<z.ZodObject<typeof getNoticeInputShape>>;

export interface GetNoticeResult {
  found: boolean;
  bidKind?: BidKind;
  notice?: BidNotice;
  searchedKinds: BidKind[];
  invalidCount: number;
  errors: string[];
}

export async function runGetNotice(client: DataGoKrClient, args: GetNoticeArgs): Promise<GetNoticeResult> {
  const kinds: BidKind[] = args.bidKind ? [args.bidKind] : DEFAULT_KINDS;
  const params = { inqryDiv: "2", bidNtceNo: args.bidNtceNo, numOfRows: 10, pageNo: 1 };
  const settled = await Promise.allSettled(
    kinds.map((k) => client.get(listOperation(k), { params, schema: RawBidNoticeSchema })),
  );

  const errors: string[] = [];
  let invalidCount = 0;
  for (let i = 0; i < kinds.length; i++) {
    const s = settled[i]!;
    if (s.status === "fulfilled") {
      invalidCount += s.value.invalid.length;
      if (s.value.data.length > 0) {
        return {
          found: true, bidKind: kinds[i]!, notice: formatItem(s.value.data[0]!),
          searchedKinds: kinds, invalidCount, errors,
        };
      }
    } else {
      const m = errMessage(s.reason);
      if (!errors.includes(m)) errors.push(m);
    }
  }
  return { found: false, searchedKinds: kinds, invalidCount, errors };
}
