import { existsSync } from "node:fs";
import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { errMessage, type DataGoKrClient } from "@opendata-kr/core";
import { resolveAttachments } from "./attachments.js";
import { resolveSaveDir, planSavedPath, downloadToPath, type DownloadOptions } from "../api/fileDownload.js";
import { formatFor } from "../extract/index.js";
import { extractZipToEntries } from "../extract/zip.js";

// download_attachments(카탈로그)와 read_attachment(단건 읽기)가 공유하는 해소 계층.
// 첨부를 전부 디스크에 내려받고 zip은 풀어(원본 zip 삭제) 평평한 파일 카탈로그를 만든 뒤,
// 카탈로그를 공고 폴더의 `.attachments-manifest.json`에 영속한다. read는 이 파일을 읽어
// index로 디스크 파일을 직접 연다(API 재조회·재-unzip 없음 → index 안정성이 API 순서에 의존하지 않음).

export type ManifestFormat = "hwpx" | "hwp" | "doc" | "other";

export interface AttachmentManifestEntry {
  index: number;
  fileNm: string; // 디스크에 저장된 실제 파일명
  container?: string; // zip에서 풀렸으면 원본 zip 파일명
  format: ManifestFormat;
  extractable: boolean; // read_attachment로 본문 추출 가능(hwpx·hwp·doc)
  byteSize: number;
  savedPath: string; // 실제 파일의 디스크 경로
  note?: string; // 미해제 사유 등
}

export interface AttachmentManifest {
  bidNtceNo: string;
  anySucceeded: boolean;
  resolveErrors?: Record<string, string>;
  files: AttachmentManifestEntry[];
  truncatedFileList?: boolean;
}

const MANIFEST_FILE = ".attachments-manifest.json";
const MAX_MANIFEST = 50;

function isExtractable(fmt: ManifestFormat): boolean {
  return fmt === "hwpx" || fmt === "hwp" || fmt === "doc";
}

function toManifestFormat(f: ReturnType<typeof formatFor>): ManifestFormat {
  return f === "zip" ? "other" : f;
}

async function loadPersisted(saveDir: string): Promise<AttachmentManifest | null> {
  const p = path.join(saveDir, MANIFEST_FILE);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(await readFile(p, "utf8")) as AttachmentManifest;
  } catch {
    return null; // 손상 매니페스트는 없는 것으로 보고 재생성
  }
}

// 전 첨부를 디스크에 확보하고 zip을 풀어 카탈로그를 만든 뒤 영속한다. 이미 영속본이 있고
// refresh가 아니면 그대로 재사용한다(디스크·매니페스트 재생성 스킵).
export async function materialize(
  client: DataGoKrClient,
  bidNtceNo: string,
  opts: { refresh?: boolean } & DownloadOptions,
): Promise<AttachmentManifest> {
  const saveDir = await resolveSaveDir(bidNtceNo);
  if (!opts.refresh) {
    const cached = await loadPersisted(saveDir);
    if (cached) return cached;
  }

  const { results, anySucceeded, flattened } = await resolveAttachments(client, bidNtceNo);
  const errEntries: Record<string, string> = {};
  for (const [label, r] of Object.entries(results)) if (r.status === "error") errEntries[label] = r.error;
  const resolveErrors = Object.keys(errEntries).length ? errEntries : undefined;

  const dlOpts: DownloadOptions = { fetch: opts.fetch, maxBytes: opts.maxBytes, timeoutMs: opts.timeoutMs };
  const reserved = new Set<string>(); // 공고 폴더 내 평탄 배치의 동명 유일화(전 파일 공유)
  const files: AttachmentManifestEntry[] = [];
  let truncated = false;

  const push = (e: Omit<AttachmentManifestEntry, "index">): boolean => {
    if (files.length >= MAX_MANIFEST) { truncated = true; return false; }
    files.push({ index: files.length, ...e });
    return true;
  };

  for (const t of flattened) {
    if (files.length >= MAX_MANIFEST) { truncated = true; break; }
    const fmt = formatFor(t.fileNm);
    try {
      if (fmt === "zip") {
        // zip을 임시로 받아 메모리로 읽고 내부 파일을 평탄 저장한 뒤 원본 zip은 지운다.
        const tmpZip = planSavedPath(saveDir, t.fileNm, files.length, reserved);
        await downloadToPath(t.fileUrl, tmpZip, dlOpts);
        let zipBuf: Buffer;
        try {
          zipBuf = await readFile(tmpZip);
        } finally {
          reserved.delete(path.basename(tmpZip)); // zip 이름은 슬롯 점유하지 않는다(삭제되므로)
        }
        const extraction = extractZipToEntries(zipBuf);
        await unlink(tmpZip).catch(() => {});
        if (extraction.error) {
          push({ fileNm: t.fileNm, format: "other", extractable: false, byteSize: zipBuf.length, savedPath: tmpZip, note: extraction.error });
          continue;
        }
        if (extraction.truncated) truncated = true;
        for (const e of extraction.entries) {
          const savedPath = planSavedPath(saveDir, e.name, files.length, reserved);
          await writeFile(savedPath, e.data);
          if (!push({ fileNm: path.basename(savedPath), container: t.fileNm, format: e.format, extractable: e.extractable, byteSize: e.data.length, savedPath, ...(e.reason ? { note: e.reason } : {}) })) break;
        }
      } else {
        const savedPath = planSavedPath(saveDir, t.fileNm, files.length, reserved);
        let byteSize: number;
        if (!opts.refresh && existsSync(savedPath)) {
          byteSize = (await readFile(savedPath)).length;
        } else {
          ({ byteSize } = await downloadToPath(t.fileUrl, savedPath, dlOpts));
        }
        const format = toManifestFormat(fmt);
        push({ fileNm: path.basename(savedPath), format, extractable: isExtractable(format), byteSize, savedPath });
      }
    } catch (err) {
      const savedPath = path.join(saveDir, t.fileNm);
      push({ fileNm: t.fileNm, format: toManifestFormat(fmt), extractable: false, byteSize: 0, savedPath, note: `다운로드 실패: ${errMessage(err)}` });
    }
  }

  const manifest: AttachmentManifest = {
    bidNtceNo, anySucceeded, files,
    ...(resolveErrors ? { resolveErrors } : {}),
    ...(truncated ? { truncatedFileList: true } : {}),
  };
  await writeFile(path.join(saveDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2)).catch(() => {});
  return manifest;
}

// read_attachment용: 영속 카탈로그를 읽고, 없으면 materialize한다.
export async function loadOrMaterialize(
  client: DataGoKrClient,
  bidNtceNo: string,
  opts: DownloadOptions,
): Promise<AttachmentManifest> {
  const saveDir = await resolveSaveDir(bidNtceNo);
  const cached = await loadPersisted(saveDir);
  if (cached) return cached;
  return materialize(client, bidNtceNo, opts);
}
