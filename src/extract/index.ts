import { extractHwpx } from "./hwpx.js";
import { extractHwp } from "./hwp.js";

// 첨부 파일명 확장자로 추출기를 고르고, 하위 추출기 예외를 status="error"로
// 격리해 도구 전체가 throw로 죽지 않게 한다.

export interface ExtractResult {
  format: "hwpx" | "hwp" | "other";
  status: "full" | "preview" | "unsupported" | "error";
  text: string;
  error?: string;
}

function formatFor(fileNm: string): "hwpx" | "hwp" | "other" {
  const lower = fileNm.toLowerCase();
  if (lower.endsWith(".hwpx")) return "hwpx";
  if (lower.endsWith(".hwp")) return "hwp";
  return "other";
}

export async function extractText(
  filePath: string,
  fileNm: string,
): Promise<ExtractResult> {
  const format = formatFor(fileNm);
  try {
    if (format === "hwpx") {
      const r = await extractHwpx(filePath);
      return { format, status: r.status, text: r.text, error: r.error };
    }
    if (format === "hwp") {
      const r = await extractHwp(filePath);
      return { format, status: r.status, text: r.text, error: r.error };
    }
    return { format, status: "unsupported", text: "" };
  } catch (err) {
    return {
      format,
      status: "error",
      text: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
