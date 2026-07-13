import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { ATTACH_OPS } from "../api/endpoints.js";
import { formatAttachment } from "../format.js";
import { runOps, type OpOutcome } from "../api/runOps.js";
import type { BidAttachment } from "../api/types.js";

export const attachmentsInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호. e발주 첨부파일과 혁신장터 최종제안요청서 첨부파일 URL을 반환. 대부분 공고는 비어 있음"),
};
export type AttachmentsArgs = { bidNtceNo: string };

export const LABELS = ["eorder", "innovationRfp"] as const; // I, J 순서(ATTACH_OPS 정렬)

export interface AttachmentsResult {
  bidNtceNo: string; anySucceeded: boolean;
  results: Record<string, OpOutcome<BidAttachment>>;
}

export async function runAttachments(client: DataGoKrClient, args: AttachmentsArgs): Promise<AttachmentsResult> {
  const calls = ATTACH_OPS.map((o, i) => ({
    label: LABELS[i]!, op: o.op,
    params: { inqryDiv: o.byNoInqryDiv, bidNtceNo: args.bidNtceNo, numOfRows: 100, pageNo: 1 },
  }));
  const { results, anySucceeded } = await runOps(client, calls, formatAttachment);
  return { bidNtceNo: args.bidNtceNo, anySucceeded, results };
}
