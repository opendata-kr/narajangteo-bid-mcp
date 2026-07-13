import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { DataGoKrClient } from "@opendata-kr/core";
import { resolveAttachments } from "./attachments.js";
import { resolveSaveDir, planSavedPath, downloadToPath, type DownloadOptions } from "../api/fileDownload.js";
import { formatFor, type ExtractFormat } from "../extract/index.js";
import { listZipEntries, readZipEntry } from "../extract/zip.js";

// download_attachments(매니페스트)와 read_attachment(단건 읽기)가 공유하는 해소 계층.
// 첨부 URL 해소 → 디스크 확보 → zip 펼침 → 평평한 매니페스트를 결정적으로 만든다.
// 매니페스트 순서(그러므로 index)는 (첨부 해소 순서 + zip 엔트리 순서)로 결정적이라 두 도구가
// 같은 index를 본다. 첨부가 바뀌면 index가 흔들리므로 refresh로 재다운로드한다.

export type ManifestFormat = "hwpx" | "hwp" | "doc" | "other";

export interface AttachmentManifestEntry {
  index: number;
  fileNm: string;
  container?: string; // zip 내부 파일이면 그 zip 파일명
  format: ManifestFormat;
  extractable: boolean; // read_attachment로 본문 추출 가능(hwpx·hwp·doc)
  byteSize?: number; // zip 내부=압축해제 크기, 최상위=디스크 크기
  savedPath: string; // 최상위=그 파일 경로, zip 내부=담고 있는 zip 경로
  note?: string; // 미해제 사유·다운로드 실패 등
}

interface TopLevel {
  fileNm: string;
  fileUrl: string;
  savedPath: string;
  format: ExtractFormat;
}

export interface ManifestResolution {
  bidNtceNo: string;
  saveDir: string;
  topLevel: TopLevel[];
  manifest: AttachmentManifestEntry[];
  anySucceeded: boolean;
  resolveErrors?: Record<string, string>;
  truncatedFileList?: boolean;
}

const MAX_MANIFEST = 50;

function isExtractable(fmt: ManifestFormat): boolean {
  return fmt === "hwpx" || fmt === "hwp" || fmt === "doc";
}

function topLevelFormat(f: ExtractFormat): ManifestFormat {
  return f === "zip" ? "other" : f; // zip은 펼쳐지므로 컨테이너 항목엔 안 나옴
}

async function ensureFile(
  savedPath: string,
  fileUrl: string,
  refresh: boolean,
  opts: DownloadOptions,
): Promise<number> {
  if (!refresh && existsSync(savedPath)) return statSync(savedPath).size;
  const { byteSize } = await downloadToPath(fileUrl, savedPath, opts);
  return byteSize;
}

// 매니페스트를 만든다. downloadNonZip=true면 최상위 비-zip도 미리 받고(byteSize 확정),
// false면 디스크에 있을 때만 크기를 채운다. zip은 열거를 위해 항상 확보한다.
export async function resolveManifest(
  client: DataGoKrClient,
  bidNtceNo: string,
  opts: { downloadNonZip: boolean; refresh?: boolean } & DownloadOptions,
): Promise<ManifestResolution> {
  const { results, anySucceeded, flattened } = await resolveAttachments(client, bidNtceNo);
  const errEntries: Record<string, string> = {};
  for (const [label, r] of Object.entries(results)) if (r.status === "error") errEntries[label] = r.error;
  const resolveErrors = Object.keys(errEntries).length ? errEntries : undefined;

  const saveDir = await resolveSaveDir(bidNtceNo);
  const reserved = new Set<string>();
  const topLevel: TopLevel[] = flattened.map((a, i) => ({
    fileNm: a.fileNm,
    fileUrl: a.fileUrl,
    savedPath: planSavedPath(saveDir, a.fileNm, i, reserved),
    format: formatFor(a.fileNm),
  }));

  const dlOpts: DownloadOptions = { fetch: opts.fetch, maxBytes: opts.maxBytes, timeoutMs: opts.timeoutMs };
  const manifest: AttachmentManifestEntry[] = [];
  let truncated = false;

  for (const t of topLevel) {
    if (manifest.length >= MAX_MANIFEST) { truncated = true; break; }
    try {
      if (t.format === "zip") {
        await ensureFile(t.savedPath, t.fileUrl, !!opts.refresh, dlOpts); // 열거하려면 바이트 필요
        const zipBuf = await readFile(t.savedPath);
        const listing = listZipEntries(zipBuf);
        if (listing.error) {
          manifest.push({ index: manifest.length, fileNm: t.fileNm, format: "other", extractable: false, byteSize: statSync(t.savedPath).size, savedPath: t.savedPath, note: listing.error });
          continue;
        }
        for (const e of listing.entries) {
          if (manifest.length >= MAX_MANIFEST) { truncated = true; break; }
          manifest.push({
            index: manifest.length,
            fileNm: e.name,
            container: t.fileNm,
            format: e.format,
            extractable: e.extractable,
            byteSize: e.originalSize,
            savedPath: t.savedPath,
            ...(e.reason ? { note: e.reason } : {}),
          });
        }
        if (listing.truncated) truncated = true;
      } else {
        let byteSize: number | undefined;
        if (opts.downloadNonZip) byteSize = await ensureFile(t.savedPath, t.fileUrl, !!opts.refresh, dlOpts);
        else if (existsSync(t.savedPath)) byteSize = statSync(t.savedPath).size;
        const format = topLevelFormat(t.format);
        manifest.push({
          index: manifest.length,
          fileNm: t.fileNm,
          format,
          extractable: isExtractable(format),
          ...(byteSize !== undefined ? { byteSize } : {}),
          savedPath: t.savedPath,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      manifest.push({ index: manifest.length, fileNm: t.fileNm, format: topLevelFormat(t.format), extractable: false, savedPath: t.savedPath, note: `다운로드 실패: ${msg}` });
    }
  }

  return {
    bidNtceNo, saveDir, topLevel, manifest, anySucceeded,
    ...(resolveErrors ? { resolveErrors } : {}),
    ...(truncated ? { truncatedFileList: true } : {}),
  };
}

// 매니페스트 항목의 원본 바이트를 확보한다. zip 내부면 디스크 zip에서 해당 엔트리만 풀고,
// 최상위면 디스크 파일(없으면 다운로드)을 읽는다. 추출 불가·미해제 항목은 호출측이 먼저 거른다.
export async function loadEntryBuffer(
  resolution: ManifestResolution,
  entry: AttachmentManifestEntry,
  opts: { refresh?: boolean } & DownloadOptions,
): Promise<Buffer> {
  if (entry.container) {
    const zipBuf = await readFile(entry.savedPath); // resolveManifest가 zip을 이미 확보
    const inner = readZipEntry(zipBuf, entry.fileNm);
    if (!inner) throw new Error(`zip 내부 파일(${entry.fileNm})을 풀지 못했습니다. 크기 상한 초과이거나 손상일 수 있습니다.`);
    return inner;
  }
  const top = resolution.topLevel.find((t) => t.savedPath === entry.savedPath);
  if (!top) throw new Error(`첨부 원본 URL을 찾지 못했습니다(index ${entry.index}).`);
  const dlOpts: DownloadOptions = { fetch: opts.fetch, maxBytes: opts.maxBytes, timeoutMs: opts.timeoutMs };
  await ensureFile(entry.savedPath, top.fileUrl, !!opts.refresh, dlOpts);
  return readFile(entry.savedPath);
}
