import { readFile } from "node:fs/promises";
import { extractHwpxFromBuffer } from "./hwpx.js";
import { extractHwpFromBuffer } from "./hwp.js";
import { extractDocFromBuffer } from "./doc.js";
import { extractZipFromBuffer } from "./zip.js";

// 첨부 파일명 확장자로 추출기를 고르고, 하위 추출기 예외를 status="error"로
// 격리해 도구 전체가 throw로 죽지 않게 한다.

export type ExtractFormat = "hwpx" | "hwp" | "doc" | "zip" | "other";

export interface ExtractResult {
  format: ExtractFormat;
  status: "full" | "preview" | "unsupported" | "error";
  text: string;
  error?: string;
}

function formatFor(fileNm: string): ExtractFormat {
  const lower = fileNm.toLowerCase();
  if (lower.endsWith(".hwpx")) return "hwpx";
  if (lower.endsWith(".hwp")) return "hwp";
  if (lower.endsWith(".doc")) return "doc";
  if (lower.endsWith(".zip")) return "zip";
  return "other";
}

// 버퍼 코어 디스패치. allowZip=false면 zip을 재귀하지 않는다(zip 내부의 중첩 zip 차단).
function extractFromBuffer(fileNm: string, buf: Buffer, allowZip: boolean): ExtractResult {
  const format = formatFor(fileNm);
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
  if (format === "zip") {
    if (!allowZip) return { format, status: "unsupported", text: "" }; // 중첩 zip 미재귀
    const r = extractZipFromBuffer(buf, (innerNm, innerBuf) => {
      const ir = extractFromBuffer(innerNm, innerBuf, false);
      return { extracted: ir.status === "full" || ir.status === "preview", text: ir.text };
    });
    return { format, status: r.status, text: r.text, error: r.error };
  }
  return { format, status: "unsupported", text: "" };
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
  try {
    return extractFromBuffer(fileNm, buf, true);
  } catch (err) {
    return {
      format: formatFor(fileNm),
      status: "error",
      text: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
