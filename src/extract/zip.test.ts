import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extractZipToEntries } from "./zip.js";

function makeZip(files: Record<string, Uint8Array>): Buffer {
  return Buffer.from(zipSync(files));
}

describe("extractZipToEntries", () => {
  it("내부 엔트리를 바이트·포맷·지원여부와 함께 전량 추출한다", () => {
    const zip = makeZip({
      "제안요청서.hwpx": strToU8("HWPX"),
      "공고.doc": strToU8("DOC"),
      "스캔.pdf": strToU8("PDF"),
    });
    const r = extractZipToEntries(zip);
    expect(r.error).toBeUndefined();
    expect(r.entries.map((e) => e.name).sort()).toEqual(["공고.doc", "스캔.pdf", "제안요청서.hwpx"]);
    const by = Object.fromEntries(r.entries.map((e) => [e.name, e]));
    expect(by["제안요청서.hwpx"]).toMatchObject({ format: "hwpx", extractable: true });
    expect(by["제안요청서.hwpx"]!.data.toString()).toBe("HWPX");
    expect(by["공고.doc"]).toMatchObject({ format: "doc", extractable: true });
    // 미지원 포맷도 파일로는 추출(사용자가 열 수 있게)하되 extractable=false.
    expect(by["스캔.pdf"]).toMatchObject({ format: "other", extractable: false, reason: "미지원 포맷" });
    expect(by["스캔.pdf"]!.data.toString()).toBe("PDF");
  });

  it("중첩 zip은 파일로 남기되 extractable=false(재귀 안 함)", () => {
    const zip = makeZip({ "안쪽.zip": strToU8("Z"), "본문.hwpx": strToU8("H") });
    const by = Object.fromEntries(extractZipToEntries(zip).entries.map((e) => [e.name, e]));
    expect(by["안쪽.zip"]).toMatchObject({ extractable: false, reason: "중첩 zip(재귀 안 함)" });
    expect(by["본문.hwpx"]).toMatchObject({ extractable: true });
  });

  it("경로 안전 위반(..)·절대경로 엔트리는 제외하고 truncated", () => {
    const zip = makeZip({ "../evil.hwpx": strToU8("E"), "정상.hwpx": strToU8("N") });
    const r = extractZipToEntries(zip);
    expect(r.entries.map((e) => e.name)).toEqual(["정상.hwpx"]);
    expect(r.truncated).toBe(true);
  });

  it("엔트리 수 상한 초과분은 제외하고 truncated", () => {
    const zip = makeZip({ "1.hwpx": strToU8("a"), "2.hwpx": strToU8("b"), "3.hwpx": strToU8("c") });
    const r = extractZipToEntries(zip, { maxEntries: 2 });
    expect(r.entries).toHaveLength(2);
    expect(r.truncated).toBe(true);
  });

  it("엔트리당 크기 상한 초과분은 제외(zip bomb 방어)", () => {
    const zip = makeZip({ "큰.hwpx": strToU8("x".repeat(500)), "작은.hwpx": strToU8("y") });
    const r = extractZipToEntries(zip, { maxEntryBytes: 10 });
    expect(r.entries.map((e) => e.name)).toEqual(["작은.hwpx"]);
    expect(r.truncated).toBe(true);
  });

  it("zip이 아니면 error", () => {
    const r = extractZipToEntries(Buffer.from("not a zip"));
    expect(r.error).toBeDefined();
    expect(r.entries).toEqual([]);
  });
});
