import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";

// HWPX(한글 2010+ OWPML 포맷)는 zip 컨테이너다. 본문은 Contents/section*.xml에
// OWPML(Open Word-Processor Markup Language) 태그로 담긴다. 텍스트 노드만 뽑는다.

export interface HwpxExtractResult {
  status: "full" | "error";
  text: string;
  error?: string;
}

const SECTION_RE = /^Contents\/section(\d+)\.xml$/i;

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// 숫자참조 코드포인트를 문자로. 유효범위(0..0x10FFFF) 밖이면 fromCodePoint가
// RangeError를 던지므로 원문 유지로 방어한다(잘못된 참조에 전체 실패시키지 않음).
function fromCodePointSafe(original: string, code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return original;
  try {
    return String.fromCodePoint(code);
  } catch {
    return original;
  }
}

// XML 엔티티 디코드. 명명 엔티티·숫자참조(10진 &#dddd; ·16진 &#xHHHH;)를 풀되,
// &amp;는 마지막에 풀어 이중 디코드(예: "&amp;lt;"→"<")를 막는다.
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex: string) =>
      fromCodePointSafe(m, parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (m, dec: string) =>
      fromCodePointSafe(m, parseInt(dec, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function extractHwpx(filePath: string): Promise<HwpxExtractResult> {
  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch (err) {
    return {
      status: "error",
      text: "",
      error: `HWPX 파일을 읽지 못했습니다: ${errMessage(err)}`,
    };
  }

  let entries: Record<string, Uint8Array>;
  try {
    // Contents/section*.xml만 압축 해제한다. HWPX는 BinData에 원본 이미지(수백 MB급)를
    // 담을 수 있어 전체 해제는 본문 텍스트에 불필요한 비용이다(페이지네이션 재추출 비용).
    entries = unzipSync(new Uint8Array(buf), {
      filter: (file) => SECTION_RE.test(file.name),
    });
  } catch (err) {
    return {
      status: "error",
      text: "",
      error: `HWPX zip 해제에 실패했습니다(HWPX가 아니거나 손상): ${errMessage(err)}`,
    };
  }

  const sections = Object.keys(entries)
    .map((name) => {
      const m = SECTION_RE.exec(name);
      return m && m[1] !== undefined
        ? { name, index: Number(m[1]) }
        : undefined;
    })
    .filter((x): x is { name: string; index: number } => x !== undefined)
    .sort((a, b) => a.index - b.index);

  if (sections.length === 0) {
    return {
      status: "error",
      text: "",
      error: "HWPX 본문(Contents/section*.xml)을 찾을 수 없습니다.",
    };
  }

  const decoder = new TextDecoder("utf-8");
  let xml = "";
  for (const { name } of sections) {
    const data = entries[name];
    if (data) xml += decoder.decode(data);
  }

  // 순서 고정: 태그 제거(공백 치환) → 엔티티 디코드 → 공백 정규화.
  const text = decodeEntities(xml.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  if (text.length === 0) {
    return {
      status: "error",
      text: "",
      error: "HWPX 본문에서 추출된 텍스트가 없습니다.",
    };
  }

  return { status: "full", text };
}
