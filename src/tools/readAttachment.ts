import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { errMessage, type DataGoKrClient } from "@opendata-kr/core";
import { loadOrMaterialize, type ManifestFormat } from "./attachmentManifest.js";
import { extractBuffer } from "../extract/index.js";

const DEFAULT_MAX_CHARS = 50000;

export const readAttachmentInputShape = {
  bidNtceNo: z.string().describe("입찰공고번호. download_attachments가 준 목록과 같은 공고를 지정한다."),
  index: z
    .number()
    .int()
    .describe(
      "읽을 파일의 목록 인덱스(0-base). download_attachments 응답 files[].index 값을 쓴다. 첨부가 바뀌면 인덱스가 흔들리므로 download_attachments를 refresh=true로 다시 호출해 목록을 갱신한다.",
    ),
  offset: z.number().int().optional().describe("본문 텍스트의 시작 문자 오프셋(기본 0). 긴 문서를 이어 읽을 때 이전 textLength 위치를 준다."),
  maxChars: z.number().int().optional().describe("반환 문자 상한(기본 50000). truncated=true면 offset을 이 반환분만큼 올려 다음 구간을 읽는다."),
};

export type ReadAttachmentArgs = z.infer<z.ZodObject<typeof readAttachmentInputShape>>;

export const readAttachmentDescription =
  "download_attachments가 준 파일 목록에서 index로 파일 하나를 골라 본문 텍스트를 읽는다. HWPX·구형 HWP·구형 DOC만 추출하며(그 외 format은 extractable=false라 본문이 비고 savedPath로 직접 열어야 한다), ZIP 내부 파일도 index로 직접 읽는다(container에 원본 ZIP명). 긴 문서는 offset·maxChars로 이어 읽는다(truncated=true면 다음 구간이 남음). 목록을 먼저 받으려면 download_attachments를, 첨부 URL만 필요하면 get_bid_attachments를 쓴다. 이미 내려받은 파일은 디스크에서 재사용한다(목록이 없으면 자동으로 먼저 내려받는다).";

export interface ReadAttachmentResult {
  bidNtceNo: string;
  index: number;
  fileNm: string;
  container?: string;
  format: ManifestFormat;
  extractStatus: "full" | "preview" | "unsupported" | "error";
  extractError?: string;
  byteSize: number;
  savedPath: string;
  text: string;
  textLength: number;
  truncated: boolean;
}

// 서로게이트 쌍이 잘리지 않게 슬라이스 끝을 보정한다(끝이 high surrogate면 한 칸 물린다).
function safeEnd(s: string, end: number): number {
  if (end < s.length) {
    const c = s.charCodeAt(end - 1);
    if (c >= 0xd800 && c <= 0xdbff) return end - 1;
  }
  return end;
}

export async function runReadAttachment(
  client: DataGoKrClient,
  args: ReadAttachmentArgs,
  opts?: { fetch?: typeof fetch; maxBytes?: number; timeoutMs?: number },
): Promise<ReadAttachmentResult> {
  const manifest = await loadOrMaterialize(client, args.bidNtceNo, opts ?? {});
  const files = manifest.files;

  if (files.length === 0) {
    throw new Error("이 공고에는 첨부 파일이 없습니다. download_attachments로 확인하세요.");
  }
  if (!Number.isInteger(args.index) || args.index < 0 || args.index >= files.length) {
    throw new Error(
      `index는 0..${files.length - 1} 범위여야 합니다. download_attachments로 파일 목록(길이 ${files.length})을 먼저 확인하세요.`,
    );
  }
  const entry = files[args.index]!;

  const base = {
    bidNtceNo: manifest.bidNtceNo,
    index: entry.index,
    fileNm: entry.fileNm,
    ...(entry.container ? { container: entry.container } : {}),
    format: entry.format,
    byteSize: entry.byteSize,
    savedPath: entry.savedPath,
  };

  if (!entry.extractable) {
    return { ...base, extractStatus: "unsupported", text: "", textLength: 0, truncated: false };
  }
  if (!existsSync(entry.savedPath)) {
    // 카탈로그는 있으나 파일이 사라진 경우: refresh 유도.
    return {
      ...base,
      extractStatus: "error",
      extractError: "저장된 파일을 찾지 못했습니다. download_attachments를 refresh=true로 다시 호출하세요.",
      text: "",
      textLength: 0,
      truncated: false,
    };
  }

  let buf: Buffer;
  try {
    buf = await readFile(entry.savedPath);
  } catch (err) {
    return { ...base, extractStatus: "error", extractError: errMessage(err), text: "", textLength: 0, truncated: false };
  }

  const ex = extractBuffer(entry.fileNm, buf);
  if (ex.status !== "full" && ex.status !== "preview") {
    return { ...base, extractStatus: ex.status, ...(ex.error !== undefined ? { extractError: ex.error } : {}), text: "", textLength: 0, truncated: false };
  }

  const offset = args.offset ?? 0;
  const maxChars = args.maxChars ?? DEFAULT_MAX_CHARS;
  if (offset < 0 || maxChars <= 0) {
    throw new Error("offset은 0 이상, maxChars는 1 이상이어야 합니다. 페이지네이션 값을 확인하세요.");
  }
  const full = ex.text;
  const textLength = full.length;
  if (offset >= textLength) {
    return { ...base, extractStatus: ex.status, text: "", textLength, truncated: false };
  }
  const end = safeEnd(full, offset + maxChars);
  const text = full.slice(offset, end);
  return { ...base, extractStatus: ex.status, text, textLength, truncated: end < textLength };
}
