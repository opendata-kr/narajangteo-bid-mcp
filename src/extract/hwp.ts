import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import * as CFB from "cfb";

// 구형 HWP(한글 5.x)는 OLE 컴파운드 파일이다. 본문은 BodyText/Section* 스트림에
// HWP 레코드로, 미리보기 평문은 PrvText 스트림에 담긴다. 본문(full) 추출을
// 시도하고 실패하면 PrvText(preview)로 폴백한다(best-effort).

export interface HwpExtractResult {
  status: "full" | "preview" | "error";
  text: string;
  error?: string;
}

// PARA_TEXT = HWP 문단 텍스트 레코드의 태그 ID.
const TAG_PARA_TEXT = 67;

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// CFB 스트림 content(Buffer|number[])를 Buffer로 정규화한다.
function toBuffer(content: CFB.CFB$Blob): Buffer {
  return Buffer.isBuffer(content) ? content : Buffer.from(content);
}

// CFB.find는 중첩 스토리지 경로에 선행 슬래시가 필요하다(없으면 null 반환).
function findStream(cfb: CFB.CFB$Container, path: string): Buffer | undefined {
  const entry = CFB.find(cfb, path);
  return entry ? toBuffer(entry.content) : undefined;
}

// PARA_TEXT의 제어문자(코드 1~9,11,12,14~23)는 인라인·확장 제어라 8 WCHAR(16바이트)를
// 차지한다(선두 제어 워드 + 데이터 7워드). 1 WCHAR만 스킵하면 데이터 워드가 본문 텍스트로
// 새어 오염된다. 문자 제어(10/13=개행, 24~31)는 1 WCHAR다.
const INLINE_CONTROL = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
]);

// PARA_TEXT는 UTF-16LE. WCHAR 단위로 전진하며 제어문자 폭(1 또는 8 WCHAR)을 정확히 건너뛴다.
function decodeParaText(data: Buffer): string {
  let out = "";
  let i = 0;
  while (i + 1 < data.length) {
    const c = data.readUInt16LE(i);
    if (c >= 32) {
      out += String.fromCharCode(c);
      i += 2;
    } else if (c === 13 || c === 10) {
      out += "\n";
      i += 2;
    } else if (INLINE_CONTROL.has(c)) {
      i += 16; // 8 WCHAR 제어: 데이터 7워드까지 건너뛴다
    } else {
      i += 2; // 문자 제어(0, 24~31 등)
    }
  }
  return out;
}

// HWP 레코드 순회: 4바이트 헤더(UInt32LE) = tagID(하위10) | level(다음10) | size(상위12).
// size==0xfff이면 다음 4바이트가 실제 size. PARA_TEXT 레코드 텍스트만 모은다.
function extractParaTexts(section: Buffer): string {
  let out = "";
  let pos = 0;
  while (pos + 4 <= section.length) {
    const value = section.readUInt32LE(pos);
    pos += 4;
    const tagId = value & 0x3ff;
    let size = (value >>> 20) & 0xfff;
    if (size === 0xfff) {
      if (pos + 4 > section.length) break;
      size = section.readUInt32LE(pos);
      pos += 4;
    }
    if (pos + size > section.length) break; // 잘린 레코드 방어
    if (tagId === TAG_PARA_TEXT) {
      out += decodeParaText(section.subarray(pos, pos + size));
    }
    pos += size;
  }
  return out;
}

// FileHeader 오프셋 36 UInt32LE 최하위비트(bit0)=1이면 본문이 zlib raw 압축.
function isCompressed(cfb: CFB.CFB$Container): boolean {
  const header = findStream(cfb, "/FileHeader");
  if (!header || header.length < 40) return false;
  return (header.readUInt32LE(36) & 1) === 1;
}

function extractBody(cfb: CFB.CFB$Container, compressed: boolean): string {
  let text = "";
  for (let i = 0; ; i++) {
    const raw = findStream(cfb, `/BodyText/Section${i}`);
    if (!raw) break;
    let section: Buffer;
    if (compressed) {
      try {
        section = inflateRawSync(raw);
      } catch {
        continue; // 이 섹션 해제 실패는 건너뛰고 나머지로 best-effort
      }
    } else {
      section = raw;
    }
    text += extractParaTexts(section);
  }
  return text;
}

// 버퍼 코어(동기). zip 내부 첨부처럼 디스크 경로가 없는 입력도 추출할 수 있게 분리했다.
export function extractHwpFromBuffer(buf: Buffer): HwpExtractResult {
  let cfb: CFB.CFB$Container;
  try {
    cfb = CFB.read(buf, { type: "buffer" });
  } catch (err) {
    return {
      status: "error",
      text: "",
      error: `HWP(OLE) 파싱에 실패했습니다(HWP가 아니거나 손상): ${errMessage(err)}`,
    };
  }

  // 본문(full) 시도.
  const body = extractBody(cfb, isCompressed(cfb)).trim();
  if (body.length > 0) {
    return { status: "full", text: body };
  }

  // PrvText(preview) 폴백.
  const prv = findStream(cfb, "/PrvText");
  if (prv) {
    const preview = prv.toString("utf16le").trim();
    if (preview.length > 0) {
      return { status: "preview", text: preview };
    }
  }

  return {
    status: "error",
    text: "",
    error: "HWP 본문과 미리보기(PrvText)에서 모두 텍스트를 추출하지 못했습니다.",
  };
}

export async function extractHwp(filePath: string): Promise<HwpExtractResult> {
  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch (err) {
    return {
      status: "error",
      text: "",
      error: `HWP 파일을 읽지 못했습니다: ${errMessage(err)}`,
    };
  }
  return extractHwpFromBuffer(buf);
}
