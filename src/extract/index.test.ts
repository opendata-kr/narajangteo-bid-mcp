import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import * as CFB from "cfb";
import { extractText } from "./index.js";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "extract-index-test-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("extractText", () => {
  it(".hwpx는 hwpx 추출기로 라우팅해 full 반환", async () => {
    const enc = new TextEncoder();
    const buf = zipSync({
      "Contents/section0.xml": enc.encode("<p>계약</p>"),
    });
    const filePath = join(dir, "a.hwpx");
    await writeFile(filePath, buf);
    const r = await extractText(filePath, "원본.hwpx");
    expect(r.format).toBe("hwpx");
    expect(r.status).toBe("full");
    expect(r.text).toContain("계약");
  });

  it(".hwp는 hwp 추출기로 라우팅해 preview 반환", async () => {
    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, "/PrvText", Buffer.from("미리보기목차", "utf16le"));
    const out = CFB.write(cfb, { type: "buffer" }) as Buffer;
    const filePath = join(dir, "c.hwp");
    await writeFile(filePath, out);
    const r = await extractText(filePath, "원본.hwp");
    expect(r.format).toBe("hwp");
    expect(r.status).toBe("preview");
    expect(r.text).toContain("미리보기목차");
  });

  it("미지원 확장자(.pdf)는 unsupported·빈 텍스트", async () => {
    const filePath = join(dir, "a.pdf");
    await writeFile(filePath, Buffer.from("%PDF-1.4", "utf8"));
    const r = await extractText(filePath, "문서.pdf");
    expect(r.format).toBe("other");
    expect(r.status).toBe("unsupported");
    expect(r.text).toBe("");
  });

  it("존재하지 않는 파일도 throw 없이 status=error로 격리", async () => {
    const r = await extractText(join(dir, "nope.hwpx"), "없음.hwpx");
    expect(r.format).toBe("hwpx");
    expect(r.status).toBe("error");
  });

  it("손상 .hwp 입력도 throw 없이 status=error", async () => {
    const filePath = join(dir, "broken.hwp");
    await writeFile(filePath, Buffer.from([0x01, 0x02, 0x03]));
    const r = await extractText(filePath, "손상.hwp");
    expect(r.format).toBe("hwp");
    expect(r.status).toBe("error");
  });

  it("확장자 판정은 대소문자 무시", async () => {
    const filePath = join(dir, "b.pdf");
    await writeFile(filePath, Buffer.from("x", "utf8"));
    const r = await extractText(filePath, "FILE.PDF");
    expect(r.format).toBe("other");
    expect(r.status).toBe("unsupported");
  });

  it(".zip은 내부 hwpx를 재귀 추출해 헤더와 함께 full 반환", async () => {
    const enc = new TextEncoder();
    const innerHwpx = zipSync({ "Contents/section0.xml": enc.encode("<p>제안요청</p>") });
    const zip = zipSync({ "제안요청서.hwpx": innerHwpx, "스캔.pdf": enc.encode("%PDF") });
    const filePath = join(dir, "공고파일.zip");
    await writeFile(filePath, zip);
    const r = await extractText(filePath, "공고파일.zip");
    expect(r.format).toBe("zip");
    expect(r.status).toBe("full");
    expect(r.text).toContain("=== 제안요청서.hwpx ===");
    expect(r.text).toContain("제안요청");
    expect(r.text).toContain("=== 스캔.pdf ===\n(미지원 포맷)");
  });

  it(".doc는 doc 추출기로 라우팅한다(손상 입력은 error로 격리)", async () => {
    const filePath = join(dir, "d.doc");
    await writeFile(filePath, Buffer.from("not an ole doc", "utf8"));
    const r = await extractText(filePath, "공고.doc");
    expect(r.format).toBe("doc");
    expect(r.status).toBe("error");
  });
});
