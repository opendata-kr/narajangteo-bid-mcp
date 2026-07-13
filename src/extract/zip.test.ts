import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extractZipFromBuffer, type InnerExtractor, type ZipLimits } from "./zip.js";

// 지원 포맷은 이름으로만 판정하고 텍스트는 표식으로 돌려주는 가짜 추출기.
// zip.ts의 오케스트레이션(가드·헤더·합침)만 격리 검증한다(실제 파서 비의존).
const fakeInner: InnerExtractor = (nm) => {
  if (/\.(hwpx|hwp|doc)$/i.test(nm)) return { extracted: true, text: `TEXT[${nm}]` };
  return { extracted: false, text: "" };
};

function makeZip(files: Record<string, Uint8Array>): Buffer {
  return Buffer.from(zipSync(files));
}

describe("extractZipFromBuffer", () => {
  it("내부 지원 파일(hwpx·doc)을 헤더와 함께 합쳐 status=full", () => {
    const zip = makeZip({
      "제안요청서.hwpx": strToU8("dummy"),
      "공고.doc": strToU8("dummy"),
    });
    const r = extractZipFromBuffer(zip, fakeInner);
    expect(r.status).toBe("full");
    expect(r.text).toContain("=== 제안요청서.hwpx ===\nTEXT[제안요청서.hwpx]");
    expect(r.text).toContain("=== 공고.doc ===\nTEXT[공고.doc]");
  });

  it("미지원 포맷은 사유와 함께 나열하고 추출하지 않는다", () => {
    const zip = makeZip({ "스캔.pdf": strToU8("dummy"), "본문.hwpx": strToU8("dummy") });
    const r = extractZipFromBuffer(zip, fakeInner);
    expect(r.status).toBe("full"); // hwpx가 있어 full
    expect(r.text).toContain("=== 스캔.pdf ===\n(미지원 포맷)");
    expect(r.text).toContain("TEXT[본문.hwpx]");
  });

  it("전부 미지원이면 status=unsupported", () => {
    const zip = makeZip({ "a.pdf": strToU8("x"), "b.png": strToU8("y") });
    const r = extractZipFromBuffer(zip, fakeInner);
    expect(r.status).toBe("unsupported");
  });

  it("중첩 zip은 재귀하지 않고 사유를 남긴다", () => {
    const calls: string[] = [];
    const spy: InnerExtractor = (nm, b) => { calls.push(nm); return fakeInner(nm, b); };
    const zip = makeZip({ "안쪽.zip": strToU8("dummy"), "본문.hwpx": strToU8("dummy") });
    const r = extractZipFromBuffer(zip, spy);
    expect(r.text).toContain("=== 안쪽.zip ===\n(중첩 zip(재귀 안 함))");
    expect(calls).toEqual(["본문.hwpx"]); // zip은 extractInner 호출 안 됨
  });

  it("zip-slip 경로(..·절대경로)는 경로 안전 위반으로 제외", () => {
    const zip = makeZip({
      "../evil.hwpx": strToU8("dummy"),
      "정상.hwpx": strToU8("dummy"),
    });
    const r = extractZipFromBuffer(zip, fakeInner);
    expect(r.text).toContain("(경로 안전 위반)");
    expect(r.text).toContain("TEXT[정상.hwpx]");
  });

  it("엔트리 수 상한 초과분은 생략하고 truncated 표기", () => {
    const zip = makeZip({
      "1.hwpx": strToU8("a"), "2.hwpx": strToU8("b"), "3.hwpx": strToU8("c"),
    });
    const limits: ZipLimits = { maxEntries: 2, maxEntryBytes: 1e9, maxTotalBytes: 1e9 };
    const r = extractZipFromBuffer(zip, fakeInner, limits);
    expect(r.text).toContain("(엔트리 2개 초과분은 생략됨)");
  });

  it("총 해제용량 상한 초과 엔트리는 제외(zip bomb 방어)", () => {
    const big = strToU8("x".repeat(500));
    const zip = makeZip({ "큰.hwpx": big, "작은.hwpx": strToU8("y") });
    // 총 상한 10바이트: 첫 엔트리(500B) 초과로 제외.
    const limits: ZipLimits = { maxEntries: 100, maxEntryBytes: 1e9, maxTotalBytes: 10 };
    const r = extractZipFromBuffer(zip, fakeInner, limits);
    expect(r.text).toContain("(총 용량 초과)");
  });

  it("zip이 아니면 status=error", () => {
    const r = extractZipFromBuffer(Buffer.from("not a zip"), fakeInner);
    expect(r.status).toBe("error");
    expect(r.error).toBeDefined();
  });
});
