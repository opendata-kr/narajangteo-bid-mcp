import { readFile } from "node:fs/promises";
import { extractHwpxFromBuffer } from "./hwpx.js";
import { extractHwpFromBuffer } from "./hwp.js";
import { extractDocFromBuffer } from "./doc.js";

// 첨부 파일명 확장자로 추출기를 고르고, 하위 추출기 예외를 status="error"로
// 격리해 도구 전체가 throw로 죽지 않게 한다. zip은 텍스트 추출 대상이 아니라
// 도구 계층이 내부 파일로 펼쳐 처리한다(여기선 unsupported).

export type ExtractFormat = "hwpx" | "hwp" | "doc" | "zip" | "other";

export interface ExtractResult {
  format: ExtractFormat;
  status: "full" | "preview" | "unsupported" | "error";
  text: string;
  error?: string;
}

export function formatFor(fileNm: string): ExtractFormat {
  const lower = fileNm.toLowerCase();
  if (lower.endsWith(".hwpx")) return "hwpx";
  if (lower.endsWith(".hwp")) return "hwp";
  if (lower.endsWith(".doc")) return "doc";
  if (lower.endsWith(".zip")) return "zip";
  return "other";
}

// 버퍼 코어 디스패치. zip 내부 파일 버퍼도 이 함수로 추출한다(zip 자신은 unsupported).
export function extractBuffer(fileNm: string, buf: Buffer): ExtractResult {
  const format = formatFor(fileNm);
  try {
    if (format === "hwpx") {
      const r = extractHwpxFromBuffer(buf);
      return { format, status: r.status, text: r.text, error: r.error };
    }
    if (format === "hwp") {
      const r = extractHwpFromBuffer(buf);
      return { format, status: r.status, text: r.text, error: r.error };
    }
    if (format === "doc") {
      const r = extractDocFromBuffer(buf);
      return { format, status: r.status, text: r.text, error: r.error };
    }
    return { format, status: "unsupported", text: "" };
  } catch (err) {
    return { format, status: "error", text: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export async function extractText(
  filePath: string,
  fileNm: string,
): Promise<ExtractResult> {
  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch (err) {
    return {
      format: formatFor(fileNm),
      status: "error",
      text: "",
      error: `첨부 파일을 읽지 못했습니다: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return extractBuffer(fileNm, buf);
}
