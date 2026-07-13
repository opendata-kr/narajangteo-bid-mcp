import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { ATTACH_OPS } from "../api/endpoints.js";
import { formatAttachment } from "../format.js";
import { runOps } from "../api/runOps.js";
import { LABELS } from "./attachments.js";
import { resolveSaveDir, downloadToFile } from "../api/fileDownload.js";
import { extractText } from "../extract/index.js";
import type { DownloadedFile, DownloadAttachmentsResult } from "../api/types.js";

export const downloadAttachmentsInputShape = {
  bidNtceNo: z
    .string()
    .describe(
      "입찰공고번호. 이 공고의 첨부를 디스크에 저장하고 본문 텍스트를 추출한다. 첨부 다운로드 URL만 필요하면 get_attachments를 쓴다.",
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
  "입찰공고 첨부(제안요청서·과업지시서 등)를 디스크에 내려받고 본문 텍스트를 추출해 반환한다. 첨부의 다운로드 URL만 필요하면 get_attachments를 쓰고, 실제 파일 저장과 내용 읽기가 필요할 때 이 도구를 쓴다. 저장 위치는 DATA_GO_KR_DOWNLOAD_DIR(미설정 시 ~/Downloads) 아래 공고번호 폴더다. fileIndex 미지정 시 각 첨부 앞부분 미리보기를, 지정 시 그 첨부 전문을 offset·maxChars로 페이지네이션해 준다. HWPX·구형 HWP만 텍스트를 추출하고 그 외 포맷은 파일만 저장한다(원본 바이트는 응답에 담지 않는다).";

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
      format: "hwpx" | "hwp" | "other";
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
  // 1. URL 해소: ATTACH_OPS(eorder I·innovationRfp J)를 병렬 조회.
  const calls = ATTACH_OPS.map((o, i) => ({
    label: LABELS[i]!,
    op: o.op,
    params: { inqryDiv: o.byNoInqryDiv, bidNtceNo: args.bidNtceNo, numOfRows: 100, pageNo: 1 },
  }));
  const { results, anySucceeded } = await runOps(client, calls, formatAttachment);

  // 2. 해소 실패는 op별로만 표면화한다("첨부 0건"과 "조회 실패"를 구분하려면 필요).
  const resolveErrorEntries: Record<string, string> = {};
  for (const label of LABELS) {
    const r = results[label];
    if (r && r.status === "error") resolveErrorEntries[label] = r.error;
  }
  const resolveErrors =
    Object.keys(resolveErrorEntries).length > 0 ? resolveErrorEntries : undefined;

  // 3. flatten: LABELS 순서로 fileUrl 있는 첨부만 결정적으로 모은다.
  const flattened: { fileNm: string; fileUrl: string }[] = [];
  for (const label of LABELS) {
    const r = results[label];
    if (r && r.status === "ok") {
      for (const item of r.items) {
        if (item.fileUrl) flattened.push({ fileNm: item.fileNm, fileUrl: item.fileUrl });
      }
    }
  }

  // 4. 첨부 수 상한 절단.
  const truncatedFileList = flattened.length > MAX_ATTACHMENTS ? true : undefined;
  const list = flattened.slice(0, MAX_ATTACHMENTS);

  // 5. 첨부 없으면 다운로드 없이 즉시 반환.
  if (list.length === 0) {
    return {
      bidNtceNo: args.bidNtceNo,
      anySucceeded,
      ...(resolveErrors ? { resolveErrors } : {}),
      files: [],
      ...(truncatedFileList ? { truncatedFileList } : {}),
    };
  }

  // 6. 저장 디렉터리 1회 확보(throw 가능 → 핸들러 errorText가 잡음).
  const saveDir = await resolveSaveDir(args.bidNtceNo);

  // 7. 순차 다운로드+추출. per-file try/catch로 한 파일 실패가 전체를 죽이지 않게 한다.
  // reserved는 이 호출에서 쓴 파일명을 모아 서로 다른 동명 첨부만 서픽스한다. 재호출은 같은
  // 경로로 덮어써 ~/Downloads/{공고}/에 사본이 누적되지 않는다.
  const reserved = new Set<string>();
  const downloaded: Downloaded[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const att = list[i]!;
    try {
      const { savedPath, byteSize } = await downloadToFile(att.fileUrl, att.fileNm, saveDir, {
        ...opts,
        index: i,
        reserved,
      });
      const ex = await extractText(savedPath, att.fileNm);
      downloaded.push({
        fileNm: att.fileNm,
        downloadStatus: "ok",
        savedPath,
        byteSize,
        format: ex.format,
        extractStatus: ex.status,
        fullText: ex.text,
        ...(ex.error !== undefined ? { extractError: ex.error } : {}),
      });
    } catch (err) {
      downloaded.push({
        fileNm: att.fileNm,
        downloadStatus: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 8. 슬라이스(모드 분기).
  const files = args.fileIndex === undefined
    ? slicePreview(downloaded)
    : sliceOne(downloaded, args.fileIndex, args.offset, args.maxChars);

  // 9. undefined 필드는 생략.
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

// fileIndex 지정 모드: 그 단건만 offset·maxChars로 페이지네이션해 반환.
function sliceOne(
  downloaded: Downloaded[],
  fileIndex: number,
  offsetArg: number | undefined,
  maxCharsArg: number | undefined,
): DownloadedFile[] {
  if (!Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex >= downloaded.length) {
    throw new Error(
      `fileIndex는 0..${downloaded.length - 1} 범위여야 합니다. files 배열 길이(${downloaded.length}) 안의 정수를 지정하세요.`,
    );
  }
  const target = downloaded[fileIndex]!;
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
