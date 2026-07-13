import { unzipSync } from "fflate";

// zip 첨부(공고파일.zip 등)는 안에 hwpx·hwp·doc를 묶는다. 펼침 모델에서 zip은 텍스트로
// 추출하지 않고 내부 파일을 매니페스트 항목으로 펼친다. 여기선 두 순수 연산만 제공한다.
// (1) 압축 해제 없이 내부 목록 열거(listZipEntries), (2) 지정 엔트리 하나만 해제(readZipEntry).
// 가드: 경로 안전(zip slip), 엔트리 수 상한(열거), 엔트리당 해제용량 상한(읽기).

export type ZipEntryFormat = "hwpx" | "hwp" | "doc" | "other";

export interface ZipEntryInfo {
  name: string;
  format: ZipEntryFormat;
  originalSize: number; // 압축 해제 크기(zip 중앙 디렉터리)
  extractable: boolean; // hwpx·hwp·doc
  reason?: string; // 미지원·중첩 zip·경로 안전 등(extractable=false 사유)
}

export interface ZipListing {
  entries: ZipEntryInfo[];
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

// 압축 해제 없이 내부 엔트리를 열거한다. filter가 항상 false를 돌려주므로 바이트는 풀지 않고
// 메타데이터(name·originalSize)만 수집한다. 지원 판정·미해제 사유를 함께 매긴다.
export function listZipEntries(buf: Buffer, maxEntries = DEFAULT_MAX_ENTRIES): ZipListing {
  const entries: ZipEntryInfo[] = [];
  let count = 0;
  let truncated = false;
  try {
    unzipSync(new Uint8Array(buf), {
      filter: (file: { name: string; originalSize: number }) => {
        const name = file.name;
        if (name.endsWith("/")) return false; // 디렉터리
        if (count >= maxEntries) { truncated = true; return false; }
        count += 1;
        const format = formatOf(name);
        if (isUnsafePath(name)) {
          entries.push({ name, format, originalSize: file.originalSize, extractable: false, reason: "경로 안전 위반" });
        } else if (/\.zip$/i.test(name)) {
          entries.push({ name, format: "other", originalSize: file.originalSize, extractable: false, reason: "중첩 zip(재귀 안 함)" });
        } else if (format === "other") {
          entries.push({ name, format, originalSize: file.originalSize, extractable: false, reason: "미지원 포맷" });
        } else {
          entries.push({ name, format, originalSize: file.originalSize, extractable: true });
        }
        return false; // 목록만: 해제 안 함
      },
    });
  } catch (err) {
    return { entries: [], truncated: false, error: `zip 목록 해석에 실패했습니다(zip이 아니거나 손상): ${err instanceof Error ? err.message : String(err)}` };
  }
  return { entries, truncated };
}

// 지정 엔트리 하나만 압축 해제해 버퍼로 돌려준다. 경로 안전·중첩 zip은 여기서도 거부하고,
// 엔트리당 해제용량 상한을 넘으면 undefined(호출측이 미지원 처리).
export function readZipEntry(
  buf: Buffer,
  name: string,
  maxEntryBytes = DEFAULT_MAX_ENTRY_BYTES,
): Buffer | undefined {
  if (isUnsafePath(name) || /\.zip$/i.test(name)) return undefined;
  const out = unzipSync(new Uint8Array(buf), {
    filter: (file: { name: string; originalSize: number }) =>
      file.name === name && file.originalSize <= maxEntryBytes,
  });
  const data = out[name];
  return data ? Buffer.from(data) : undefined;
}
