import { unzipSync } from "fflate";

// zip 첨부(공고파일.zip 등)는 안에 hwpx·hwp·doc를 묶는다. 펼침 모델에서 zip은 디스크로 전량
// 추출한 뒤 원본 zip을 지운다(사용자의 다운로드 폴더엔 실제 파일만 남는다). 여기선 순수 연산으로
// 내부 엔트리를 압축 해제해 {이름, 바이트, 포맷, 지원여부}로 돌려준다. 디스크 쓰기는 호출측이 한다.
// 가드: 경로 안전(zip slip)·중첩 zip 미재귀·엔트리 수 상한·엔트리당 해제용량 상한.

export type ZipEntryFormat = "hwpx" | "hwp" | "doc" | "other";

export interface ZipEntry {
  name: string; // zip 내부 엔트리 원본 이름(호출측이 sanitize)
  data: Buffer;
  format: ZipEntryFormat;
  extractable: boolean; // hwpx·hwp·doc(본문 추출 가능)
  reason?: string; // extractable=false 사유(미지원·중첩 zip)
}

export interface ZipExtraction {
  entries: ZipEntry[];
  truncated: boolean;
  error?: string;
}

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_MAX_ENTRY_BYTES = 100 * 1024 * 1024; // 엔트리당 100MB(zip bomb 방어)

function formatOf(name: string): ZipEntryFormat {
  const l = name.toLowerCase();
  if (l.endsWith(".hwpx")) return "hwpx";
  if (l.endsWith(".hwp")) return "hwp";
  if (l.endsWith(".doc")) return "doc";
  return "other";
}

// zip-slip 방어: 상위경로(..)·절대경로 엔트리.
function isUnsafePath(name: string): boolean {
  if (name.startsWith("/") || /^[a-zA-Z]:/.test(name)) return true;
  return name.split(/[\\/]/).includes("..");
}

// zip을 전량 압축 해제해 엔트리 목록으로 돌려준다. 경로 안전 위반·초과분은 건너뛰고(truncated·미포함),
// 엔트리당 해제용량 상한은 fflate filter의 originalSize로 선거른다. 미지원 포맷·중첩 zip도 파일로는
// 남겨 사용자가 열 수 있게 하되 extractable=false로 표시한다(중첩 zip은 재귀만 안 함).
export function extractZipToEntries(
  buf: Buffer,
  opts?: { maxEntries?: number; maxEntryBytes?: number },
): ZipExtraction {
  const maxEntries = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxEntryBytes = opts?.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES;
  const meta = new Map<string, { format: ZipEntryFormat; extractable: boolean; reason?: string }>();
  let count = 0;
  let truncated = false;

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buf), {
      filter: (file: { name: string; originalSize: number }) => {
        const name = file.name;
        if (name.endsWith("/")) return false; // 디렉터리
        if (count >= maxEntries) { truncated = true; return false; }
        if (isUnsafePath(name)) { truncated = true; return false; } // 경로 안전 위반은 아예 제외
        if (file.originalSize > maxEntryBytes) { truncated = true; return false; } // 크기 초과 제외
        count += 1;
        const format = formatOf(name);
        if (/\.zip$/i.test(name)) meta.set(name, { format: "other", extractable: false, reason: "중첩 zip(재귀 안 함)" });
        else if (format === "other") meta.set(name, { format, extractable: false, reason: "미지원 포맷" });
        else meta.set(name, { format, extractable: true });
        return true;
      },
    });
  } catch (err) {
    return { entries: [], truncated: false, error: `zip 해제에 실패했습니다(zip이 아니거나 손상): ${err instanceof Error ? err.message : String(err)}` };
  }

  const entries: ZipEntry[] = [];
  for (const [name, m] of meta) {
    const data = files[name];
    if (!data) continue; // fflate가 동명 엔트리를 합치면 일부 이름이 빌 수 있다(마지막만 유지)
    entries.push({ name, data: Buffer.from(data), format: m.format, extractable: m.extractable, ...(m.reason ? { reason: m.reason } : {}) });
  }
  return { entries, truncated };
}
