import { z } from "zod";
import { errMessage, type DataGoKrClient } from "@opendata-kr/core";
import { ATTACH_OPS, NOTICE_KINDS, listOperation } from "../api/endpoints.js";
import { RawAttachmentSchema, RawBidNoticeSchema } from "../api/schema.js";
import { formatAttachment, formatNoticeSpecAttachments } from "../format.js";
import { runOps, type OpOutcome } from "../api/runOps.js";
import type { BidAttachment } from "../api/types.js";

export const attachmentsInputShape = {
  bidNtceNo: z.string().describe(
    "입찰공고번호. 이 공고의 첨부파일(공고문·규격서·제안요청서·과업지시서 등)의 파일명·다운로드 URL을 반환한다. 파일 자체는 내려받지 않는다.",
  ),
};
// inputSchema에서 파생해 shape와 타입의 원천을 하나로 유지한다.
export type AttachmentsArgs = z.infer<z.ZodObject<typeof attachmentsInputShape>>;

// ATTACH_OPS 인덱스에 대응하는 라벨(I e발주, J 혁신장터RFP)
export const ATTACH_LABELS = ["eorder", "innovationRfp"] as const;
// 조회·flatten 순서: 공고 규격첨부(주경로)를 먼저, 그다음 특수 첨부 op.
export const FLATTEN_ORDER = ["notice", ...ATTACH_LABELS] as const;
type AttachLabel = (typeof FLATTEN_ORDER)[number];

export interface AttachmentsResult {
  bidNtceNo: string; anySucceeded: boolean;
  results: Record<AttachLabel, OpOutcome<BidAttachment>>;
}

export interface ResolvedAttachments {
  results: Record<AttachLabel, OpOutcome<BidAttachment>>;
  anySucceeded: boolean;
  flattened: { fileNm: string; fileUrl: string }[];
}

// 기본 목록 오퍼레이션(kind별)을 fanOut해 공고의 ntceSpec* 규격첨부를 해소한다.
// 첨부의 주경로는 전용 AtchFile op가 아니라 목록 응답 인라인 필드(ntceSpecDocUrl1~10)다.
// bidNtceNo만으로는 kind를 모르므로 getNotice와 같은 방식으로 kind를 훑어 처음 히트한 응답을 쓴다.
async function resolveNoticeSpec(
  client: DataGoKrClient,
  bidNtceNo: string,
): Promise<OpOutcome<BidAttachment>> {
  const params = { inqryDiv: "2", bidNtceNo, numOfRows: 10, pageNo: 1 };
  const settled = await Promise.allSettled(
    NOTICE_KINDS.map((k) => client.get(listOperation(k), { params, schema: RawBidNoticeSchema })),
  );
  const errors: string[] = [];
  let rejected = 0;
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value.data.length > 0) {
      const items = formatNoticeSpecAttachments(s.value.data[0]!);
      return { status: "ok", totalCount: items.length, invalidCount: s.value.invalid.length, items };
    }
    if (s.status === "rejected") {
      rejected += 1;
      const m = errMessage(s.reason);
      if (!errors.includes(m)) errors.push(m);
    }
  }
  // 전 kind가 API 에러면 해소 실패, 아니면 공고 미발견(0건 성공).
  if (rejected === NOTICE_KINDS.length) return { status: "error", error: errors.join("; ") };
  return { status: "ok", totalCount: 0, invalidCount: 0, items: [] };
}

// 세 소스(공고 규격첨부 notice + e발주 + 혁신장터RFP)를 병렬 해소하고 결과맵·flatten을 만든다.
// get_bid_attachments·download_attachments가 공유한다(URL 해소 로직 단일화).
export async function resolveAttachments(
  client: DataGoKrClient,
  bidNtceNo: string,
): Promise<ResolvedAttachments> {
  const calls = ATTACH_OPS.map((o, i) => ({
    label: ATTACH_LABELS[i]!, op: o.op,
    params: { inqryDiv: o.byNoInqryDiv, bidNtceNo, numOfRows: 100, pageNo: 1 },
  }));
  const [opResolved, notice] = await Promise.all([
    runOps(client, calls, RawAttachmentSchema, formatAttachment),
    resolveNoticeSpec(client, bidNtceNo),
  ]);
  const results: Record<AttachLabel, OpOutcome<BidAttachment>> = { notice, ...opResolved.results };
  const anySucceeded = opResolved.anySucceeded || notice.status === "ok";

  // FLATTEN_ORDER(notice 우선)로 fileUrl 있는 첨부만 결정적으로 모으고 URL 중복을 제거한다.
  const seen = new Set<string>();
  const flattened: { fileNm: string; fileUrl: string }[] = [];
  for (const label of FLATTEN_ORDER) {
    const r = results[label];
    if (r.status === "ok") {
      for (const item of r.items) {
        if (item.fileUrl && !seen.has(item.fileUrl)) {
          seen.add(item.fileUrl);
          flattened.push({ fileNm: item.fileNm, fileUrl: item.fileUrl });
        }
      }
    }
  }
  return { results, anySucceeded, flattened };
}

export async function runAttachments(client: DataGoKrClient, args: AttachmentsArgs): Promise<AttachmentsResult> {
  const { results, anySucceeded } = await resolveAttachments(client, args.bidNtceNo);
  return { bidNtceNo: args.bidNtceNo, anySucceeded, results };
}
