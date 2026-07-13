import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { resolveManifest, type AttachmentManifestEntry } from "./attachmentManifest.js";

export const downloadAttachmentsInputShape = {
  bidNtceNo: z
    .string()
    .describe(
      "입찰공고번호. 이 공고의 전 첨부를 디스크에 내려받고 ZIP은 풀어, 읽을 수 있는 파일 목록(매니페스트)을 반환한다. 개별 파일 본문은 read_attachment로 읽는다.",
    ),
  refresh: z
    .boolean()
    .optional()
    .describe(
      "true면 디스크 캐시를 무시하고 모든 첨부를 새로 내려받는다(첨부가 갱신됐을 때). 기본 false는 이미 받은 파일을 재사용한다.",
    ),
};

export type DownloadAttachmentsArgs = z.infer<z.ZodObject<typeof downloadAttachmentsInputShape>>;

export const downloadAttachmentsDescription =
  "입찰공고 첨부를 전부 디스크에 내려받고 ZIP은 풀어, 읽을 수 있는 파일 목록(매니페스트)만 반환한다(본문 텍스트는 담지 않는다). 각 파일 본문은 read_attachment에 이 목록의 index를 줘서 읽는다(불필요한 재조회 없이 필요한 파일만 읽는다). ZIP은 목록에서 사라지고 내부 파일이 항목으로 펼쳐지며 container에 원본 ZIP명이 담긴다. 첨부의 URL만 필요하면 get_bid_attachments를 쓴다. 저장 위치는 DATA_GO_KR_DOWNLOAD_DIR(미설정 시 ~/Downloads) 아래 공고번호 폴더다. 첨부가 나중에 바뀌면 refresh=true로 다시 호출한다. 각 항목의 extractable=true면 read_attachment로 본문(HWPX·구형 HWP·구형 DOC)을 읽을 수 있고, false면 파일만 저장돼 있다.";

export interface DownloadAttachmentsResult {
  bidNtceNo: string;
  anySucceeded: boolean;
  resolveErrors?: Record<string, string>;
  files: AttachmentManifestEntry[];
  truncatedFileList?: boolean;
}

export async function runDownloadAttachments(
  client: DataGoKrClient,
  args: DownloadAttachmentsArgs,
  opts?: { fetch?: typeof fetch; maxBytes?: number; timeoutMs?: number },
): Promise<DownloadAttachmentsResult> {
  const res = await resolveManifest(client, args.bidNtceNo, {
    downloadNonZip: true,
    refresh: args.refresh,
    ...opts,
  });
  return {
    bidNtceNo: res.bidNtceNo,
    anySucceeded: res.anySucceeded,
    ...(res.resolveErrors ? { resolveErrors: res.resolveErrors } : {}),
    files: res.manifest,
    ...(res.truncatedFileList ? { truncatedFileList: true } : {}),
  };
}
