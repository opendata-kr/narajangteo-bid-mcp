import { describe, it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import { listZipEntries, readZipEntry } from "./zip.js";

function makeZip(files: Record<string, Uint8Array>): Buffer {
  return Buffer.from(zipSync(files));
}

describe("listZipEntries", () => {
  it("내부 엔트리를 포맷·지원여부와 함께 열거한다(해제 안 함)", () => {
    const zip = makeZip({
      "제안요청서.hwpx": strToU8("dummy"),
      "공고.doc": strToU8("dummy"),
      "스캔.pdf": strToU8("dummy"),
    });
    const r = listZipEntries(zip);
    expect(r.error).toBeUndefined();
    expect(r.entries.map((e) => e.name)).toEqual(["제안요청서.hwpx", "공고.doc", "스캔.pdf"]);
    expect(r.entries[0]).toMatchObject({ format: "hwpx", extractable: true });
    expect(r.entries[1]).toMatchObject({ format: "doc", extractable: true });
    expect(r.entries[2]).toMatchObject({ format: "other", extractable: false, reason: "미지원 포맷" });
  });

  it("중첩 zip·경로 안전 위반은 extractable=false·사유 표기", () => {
    const zip = makeZip({
      "안쪽.zip": strToU8("x"),
      "../evil.hwpx": strToU8("y"),
      "정상.hwpx": strToU8("z"),
    });
    const r = listZipEntries(zip);
    const byName = Object.fromEntries(r.entries.map((e) => [e.name, e]));
    expect(byName["안쪽.zip"]).toMatchObject({ extractable: false, reason: "중첩 zip(재귀 안 함)" });
    expect(byName["../evil.hwpx"]).toMatchObject({ extractable: false, reason: "경로 안전 위반" });
    expect(byName["정상.hwpx"]).toMatchObject({ extractable: true });
  });

  it("엔트리 수 상한 초과분은 truncated", () => {
    const zip = makeZip({ "1.hwpx": strToU8("a"), "2.hwpx": strToU8("b"), "3.hwpx": strToU8("c") });
    const r = listZipEntries(zip, 2);
    expect(r.entries).toHaveLength(2);
    expect(r.truncated).toBe(true);
  });

  it("zip이 아니면 error", () => {
    const r = listZipEntries(Buffer.from("not a zip"));
    expect(r.error).toBeDefined();
    expect(r.entries).toEqual([]);
  });
});

describe("readZipEntry", () => {
  it("지정 엔트리 하나만 해제해 버퍼로 돌려준다", () => {
    const zip = makeZip({ "a.hwpx": strToU8("AAA"), "b.doc": strToU8("BBB") });
    const buf = readZipEntry(zip, "b.doc");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf!.toString()).toBe("BBB");
  });

  it("없는 이름이면 undefined", () => {
    const zip = makeZip({ "a.hwpx": strToU8("AAA") });
    expect(readZipEntry(zip, "없음.hwpx")).toBeUndefined();
  });

  it("엔트리당 크기 상한 초과면 undefined", () => {
    const zip = makeZip({ "큰.hwpx": strToU8("x".repeat(500)) });
    expect(readZipEntry(zip, "큰.hwpx", 10)).toBeUndefined();
  });

  it("경로 안전 위반·중첩 zip 이름은 undefined", () => {
    const zip = makeZip({ "../evil.hwpx": strToU8("x"), "안쪽.zip": strToU8("y") });
    expect(readZipEntry(zip, "../evil.hwpx")).toBeUndefined();
    expect(readZipEntry(zip, "안쪽.zip")).toBeUndefined();
  });
});
