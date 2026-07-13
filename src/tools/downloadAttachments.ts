import { existsSync, statSync } from "node:fs";
import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { resolveAttachments } from "./attachments.js";
import { resolveSaveDir, planSavedPath, downloadToPath } from "../api/fileDownload.js";
import { extractText } from "../extract/index.js";
import type { DownloadedFile, DownloadAttachmentsResult } from "../api/types.js";

type DownloadOpts = { fetch?: typeof fetch; maxBytes?: number; timeoutMs?: number };

export const downloadAttachmentsInputShape = {
  bidNtceNo: z
    .string()
    .describe(
      "입찰공고번호. 이 공고의 첨부를 디스크에 저장하고 본문 텍스트를 추출한다. 첨부 다운로드 URL만 필요하면 get_bid_attachments를 쓴다.",
    ),
  fileIndex: z
    .number()
    .int()
    .optional()
    .describe(
      "특정 첨부 하나의 전문을 페이지네이션할 때 files 배열 인덱스(0-base). 미지정 시 전 첨부의 앞부분 미리보기를 반환.",
    ),
  offset: z
    .number()
    .int()
    .optional()
    .describe("fileIndex 지정 시 그 첨부 텍스트의 시작 문자 오프셋(기본 0)."),
  maxChars: z
    .number()
    .int()
    .optional()
    .describe("fileIndex 지정 시 반환 문자 상한(기본 50000)."),
};

export type DownloadAttachmentsArgs = z.infer<
  z.ZodObject<typeof downloadAttachmentsInputShape>
>;

export const downloadAttachmentsDescription =
  "입찰공고 첨부(공고문·규격서·제안요청서·과업지시서 등)를 디스크에 내려받고 본문 텍스트를 추출해 반환한다. 첨부의 다운로드 URL만 필요하면 get_bid_attachments를 쓰고, 실제 파일 저장과 내용 읽기가 필요할 때 이 도구를 쓴다. 저장 위치는 DATA_GO_KR_DOWNLOAD_DIR(미설정 시 ~/Downloads) 아래 공고번호 폴더다. fileIndex 미지정 시 각 첨부 앞부분 미리보기를, 지정 시 그 첨부 전문을 offset·maxChars로 페이지네이션해 준다. HWPX·구형 HWP·구형 DOC와 이들을 담은 ZIP만 텍스트를 추출한다(ZIP은 내부 지원 파일을 파일명 헤더와 함께 합쳐 준다). 그 외 포맷은 파일만 저장한다(원본 바이트는 응답에 담지 않는다).";

const MAX_ATTACHMENTS = 20;
const PREVIEW_CHARS = 3000;
const DEFAULT_MAX_CHARS = 50000;

// 다운로드·추출 후 슬라이스 전 중간 표현. fullText는 슬라이스 재료라 응답에 그대로 싣지 않는다.
type Downloaded =
  | { fileNm: string; downloadStatus: "error"; error: string }
  | {
      fileNm: string;
      downloadStatus: "ok";
      savedPath: string;
      byteSize: number;
      format: "hwpx" | "hwp" | "doc" | "zip" | "other";
      extractStatus: "full" | "preview" | "unsupported" | "error";
      fullText: string;
      extractError?: string;
    };

type DownloadedOk = Extract<Downloaded, { downloadStatus: "ok" }>;

function hasText(m: DownloadedOk): boolean {
  return m.extractStatus === "full" || m.extractStatus === "preview";
}

// ok 엔트리를 슬라이스 결과(text·textLength·truncated)와 합쳐 출력 파일로 만든다.
function toOkFile(
  m: DownloadedOk,
  text: string,
  textLength: number,
  truncated: boolean,
): DownloadedFile {
  const base = {
    fileNm: m.fileNm,
    downloadStatus: "ok" as const,
    savedPath: m.savedPath,
    byteSize: m.byteSize,
    format: m.format,
    extractStatus: m.extractStatus,
    text,
    textLength,
    truncated,
  };
  return m.extractError !== undefined ? { ...base, extractError: m.extractError } : base;
}

// 텍스트 없는 ok 엔트리(unsupported·error): text=""·textLength=0·truncated=false 고정.
function emptyTextFile(m: DownloadedOk): DownloadedFile {
  return toOkFile(m, "", 0, false);
}

export async function runDownloadAttachments(
  client: DataGoKrClient,
  args: DownloadAttachmentsArgs,
  opts?: { fetch?: typeof fetch; maxBytes?: number; timeoutMs?: number },
): Promise<DownloadAttachmentsResult> {
  // 1. URL 해소: 공고 규격첨부(notice) + e발주 + 혁신장터RFP를 병렬 조회하고 notice 우선 flatten·URL 중복제거.
  const { results, anySucceeded, flattened } = await resolveAttachments(client, args.bidNtceNo);

  // 2. 해소 실패는 소스별로만 표면화한다("첨부 0건"과 "조회 실패"를 구분하려면 필요).
  const resolveErrorEntries: Record<string, string> = {};
  for (const [label, r] of Object.entries(results)) {
    if (r.status === "error") resolveErrorEntries[label] = r.error;
  }
  const resolveErrors =
    Object.keys(resolveErrorEntries).length > 0 ? resolveErrorEntries : undefined;

  // 3. 첨부 수 상한 절단.
  const truncatedFileList = flattened.length > MAX_ATTACHMENTS ? true : undefined;
  const list = flattened.slice(0, MAX_ATTACHMENTS);

  // 4. 첨부 없으면 다운로드 없이 즉시 반환.
  if (list.length === 0) {
    return {
      bidNtceNo: args.bidNtceNo,
      anySucceeded,
      ...(resolveErrors ? { resolveErrors } : {}),
      files: [],
      ...(truncatedFileList ? { truncatedFileList } : {}),
    };
  }

  // 5. 저장 디렉터리 1회 확보(throw 가능 → 핸들러 errorText가 잡음).
  const saveDir = await resolveSaveDir(args.bidNtceNo);

  // 6. 결정적 이름 계획(순수, 전 리스트 순서대로). fileIndex 대상만 받아도 index→savedPath가
  // 프리뷰 모드와 같게 나오도록 전 리스트를 돈다. reserved는 한 호출 내 서로 다른 동명 첨부만
  // 서픽스한다(재호출에도 같은 이름 → 재사용 스킵의 근거).
  const reserved = new Set<string>();
  const planned = list.map((att, i) => ({
    fileNm: att.fileNm,
    fileUrl: att.fileUrl,
    savedPath: planSavedPath(saveDir, att.fileNm, i, reserved),
  }));

  // 7. 다운로드 or 재사용 후 슬라이스. fileIndex 지정 시 대상 한 건만 받고(페이지네이션이 나머지
  // 첨부를 재요청하지 않음), 미지정 시 전 파일 프리뷰.
  let files: DownloadedFile[];
  if (args.fileIndex !== undefined) {
    const idx = args.fileIndex;
    if (!Number.isInteger(idx) || idx < 0 || idx >= planned.length) {
      throw new Error(
        `fileIndex는 0..${planned.length - 1} 범위여야 합니다. files 배열 길이(${planned.length}) 안의 정수를 지정하세요.`,
      );
    }
    const entry = await fetchOrReuse(planned[idx]!, opts);
    files = sliceEntry(entry, args.offset, args.maxChars);
  } else {
    const downloaded: Downloaded[] = [];
    for (const p of planned) downloaded.push(await fetchOrReuse(p, opts));
    files = slicePreview(downloaded);
  }

  // 8. undefined 필드는 생략.
  return {
    bidNtceNo: args.bidNtceNo,
    anySucceeded,
    ...(resolveErrors ? { resolveErrors } : {}),
    files,
    ...(truncatedFileList ? { truncatedFileList } : {}),
  };
}

// 프리뷰 모드: 각 ok 파일을 앞 PREVIEW_CHARS만 컷. downloadStatus="error"는 그대로.
function slicePreview(downloaded: Downloaded[]): DownloadedFile[] {
  return downloaded.map((m) => {
    if (m.downloadStatus === "error") return m;
    if (!hasText(m)) return emptyTextFile(m);
    const textLength = m.fullText.length;
    return toOkFile(m, m.fullText.slice(0, PREVIEW_CHARS), textLength, PREVIEW_CHARS < textLength);
  });
}

// 계획된 첨부 하나를 다운로드하거나(경로에 없을 때) 이미 있으면 디스크에서 재사용한다.
// downloadToPath의 원자적 저장 불변식 덕에 존재하는 savedPath는 항상 완전한 파일이다.
// 다운로드·추출 실패는 throw하지 않고 error 엔트리로 격리한다(per-file).
async function fetchOrReuse(
  p: { fileNm: string; fileUrl: string; savedPath: string },
  opts?: DownloadOpts,
): Promise<Downloaded> {
  try {
    let byteSize: number;
    if (existsSync(p.savedPath)) {
      byteSize = statSync(p.savedPath).size;
    } else {
      ({ byteSize } = await downloadToPath(p.fileUrl, p.savedPath, opts ?? {}));
    }
    const ex = await extractText(p.savedPath, p.fileNm);
    return {
      fileNm: p.fileNm,
      downloadStatus: "ok",
      savedPath: p.savedPath,
      byteSize,
      format: ex.format,
      extractStatus: ex.status,
      fullText: ex.text,
      ...(ex.error !== undefined ? { extractError: ex.error } : {}),
    };
  } catch (err) {
    return {
      fileNm: p.fileNm,
      downloadStatus: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// fileIndex 지정 모드: 단건을 offset·maxChars로 페이지네이션해 반환(범위 검사는 호출자가 함).
function sliceEntry(
  target: Downloaded,
  offsetArg: number | undefined,
  maxCharsArg: number | undefined,
): DownloadedFile[] {
  // 다운로드 실패·텍스트 없는 엔트리는 슬라이스 없이 원형 단건 반환.
  if (target.downloadStatus === "error") return [target];
  if (!hasText(target)) return [emptyTextFile(target)];

  const offset = offsetArg ?? 0;
  const maxChars = maxCharsArg ?? DEFAULT_MAX_CHARS;
  if (offset < 0 || maxChars <= 0) {
    throw new Error(
      "offset은 0 이상, maxChars는 1 이상이어야 합니다. 페이지네이션 값을 확인하세요.",
    );
  }

  const textLength = target.fullText.length;
  if (offset >= textLength) return [toOkFile(target, "", textLength, false)];
  const text = target.fullText.slice(offset, offset + maxChars);
  return [toOkFile(target, text, textLength, offset + text.length < textLength)];
}
