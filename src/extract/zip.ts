import { unzipSync } from "fflate";

// zip 첨부(공고파일.zip 등)는 안에 hwpx·hwp·doc를 묶는다. 이 zip을 하나의 첨부로 두되
// 내부 지원 포맷을 기존 추출기로 읽어 파일 헤더와 함께 본문을 이어붙인다(합침 모델).
// zip은 공격면이 있어 가드를 둔다. 해제 총용량·엔트리 수 상한, 중첩 zip 미재귀, 경로 안전.

export interface ZipExtractResult {
  status: "full" | "unsupported" | "error";
  text: string;
  error?: string;
}

// 내부 파일 추출 콜백. index.ts가 코어 추출기로 구현한다(중첩 zip 방지는 호출측이 담당).
export type InnerExtractor = (fileNm: string, buf: Buffer) => { extracted: boolean; text: string };

export interface ZipLimits {
  maxEntries: number;
  maxEntryBytes: number; // 엔트리당 해제용량 상한
  maxTotalBytes: number; // 합계 해제용량 상한(zip bomb 방어)
}

const DEFAULT_LIMITS: ZipLimits = {
  maxEntries: 100,
  maxEntryBytes: 100 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
};

const SUPPORTED_RE = /\.(hwpx|hwp|doc)$/i;

// zip-slip 방어: 상위경로(..)·절대경로 엔트리는 헤더 나열에서도 제외한다.
function isUnsafePath(name: string): boolean {
  if (name.startsWith("/") || /^[a-zA-Z]:/.test(name)) return true;
  return name.split(/[\\/]/).includes("..");
}

interface EntryMeta {
  name: string;
  supported: boolean; // 지원 포맷 + 가드 통과로 압축 해제됨
  reason?: string; // 미해제 사유(미지원·중첩 zip·크기 초과 등)
}

export function extractZipFromBuffer(
  buf: Buffer,
  extractInner: InnerExtractor,
  limits: ZipLimits = DEFAULT_LIMITS,
): ZipExtractResult {
  const metas: EntryMeta[] = [];
  let count = 0;
  let total = 0;
  let truncated = false;

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buf), {
      filter: (file: { name: string; originalSize: number }) => {
        const name = file.name;
        if (name.endsWith("/")) return false; // 디렉터리
        if (count >= limits.maxEntries) { truncated = true; return false; }
        count += 1;
        if (isUnsafePath(name)) { metas.push({ name, supported: false, reason: "경로 안전 위반" }); return false; }
        if (/\.zip$/i.test(name)) { metas.push({ name, supported: false, reason: "중첩 zip(재귀 안 함)" }); return false; }
        if (!SUPPORTED_RE.test(name)) { metas.push({ name, supported: false, reason: "미지원 포맷" }); return false; }
        if (file.originalSize > limits.maxEntryBytes) { metas.push({ name, supported: false, reason: "크기 초과" }); return false; }
        if (total + file.originalSize > limits.maxTotalBytes) { metas.push({ name, supported: false, reason: "총 용량 초과" }); return false; }
        total += file.originalSize;
        metas.push({ name, supported: true });
        return true;
      },
    });
  } catch (err) {
    return { status: "error", text: "", error: `zip 해제에 실패했습니다(zip이 아니거나 손상): ${err instanceof Error ? err.message : String(err)}` };
  }

  const blocks: string[] = [];
  let anyExtracted = false;
  for (const meta of metas) {
    if (meta.supported && entries[meta.name]) {
      const r = extractInner(meta.name, Buffer.from(entries[meta.name]!));
      if (r.extracted && r.text.length > 0) {
        anyExtracted = true;
        blocks.push(`=== ${meta.name} ===\n${r.text}`);
      } else {
        blocks.push(`=== ${meta.name} ===\n(본문 추출 실패)`);
      }
    } else {
      blocks.push(`=== ${meta.name} ===\n(${meta.reason ?? "미해제"})`);
    }
  }
  if (truncated) blocks.push(`(엔트리 ${limits.maxEntries}개 초과분은 생략됨)`);

  if (metas.length === 0) {
    return { status: "unsupported", text: "", error: "zip에 파일 엔트리가 없습니다." };
  }
  // 하나라도 본문을 뽑았으면 full. 전부 미지원이면 unsupported이되 나열은 남긴다.
  return { status: anyExtracted ? "full" : "unsupported", text: blocks.join("\n\n") };
}
