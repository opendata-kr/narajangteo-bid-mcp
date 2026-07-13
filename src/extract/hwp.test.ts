import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import * as CFB from "cfb";
import { extractHwp } from "./hwp.js";

// 최소 OLE(HWP 5.x는 OLE 컴파운드) 픽스처를 in-test로 생성해 실파일 없이 검증한다.
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "hwp-test-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function utf16le(s: string): Buffer {
  return Buffer.from(s, "utf16le");
}

// 비압축 PARA_TEXT(태그 67) 레코드: 4바이트 헤더(UInt32LE) + UTF-16LE 본문.
function paraTextRecord(text: string): Buffer {
  const data = utf16le(text);
  const size = data.length; // < 0xfff이므로 확장 size 불필요
  const header = Buffer.alloc(4);
  const value = (67 & 0x3ff) | ((0 & 0x3ff) << 10) | ((size & 0xfff) << 20);
  header.writeUInt32LE(value >>> 0, 0);
  return Buffer.concat([header, data]);
}

// 확장 size PARA_TEXT: size 필드=0xfff, 다음 4바이트가 실제 size.
function paraTextRecordExtended(text: string): Buffer {
  const data = utf16le(text);
  const header = Buffer.alloc(4);
  const value = (67 & 0x3ff) | ((0 & 0x3ff) << 10) | ((0xfff & 0xfff) << 20);
  header.writeUInt32LE(value >>> 0, 0);
  const ext = Buffer.alloc(4);
  ext.writeUInt32LE(data.length, 0);
  return Buffer.concat([header, ext, data]);
}

// 인라인 제어문자(코드 4) + 데이터 7워드(8 WCHAR): 데이터가 본문으로 새면 안 된다.
function paraTextWithInlineControl(before: string, after: string): Buffer {
  const head = utf16le(before);
  const ctrl = Buffer.alloc(16); // 8 WCHAR
  ctrl.writeUInt16LE(4, 0); // 선두 제어 워드
  for (let w = 1; w < 8; w++) ctrl.writeUInt16LE(0xac00 + w, w * 2); // 데이터 워드(가·각…)
  const tail = utf16le(after);
  const data = Buffer.concat([head, ctrl, tail]);
  const header = Buffer.alloc(4);
  const value = (67 & 0x3ff) | ((0 & 0x3ff) << 10) | ((data.length & 0xfff) << 20);
  header.writeUInt32LE(value >>> 0, 0);
  return Buffer.concat([header, data]);
}

// 오프셋 36 UInt32LE 최하위비트(bit0)=압축여부. compressed=false 픽스처.
function fileHeaderUncompressed(): Buffer {
  const h = Buffer.alloc(40);
  h.writeUInt32LE(0, 36);
  return h;
}

// compressed=true 픽스처.
function fileHeaderCompressed(): Buffer {
  const h = Buffer.alloc(40);
  h.writeUInt32LE(1, 36);
  return h;
}

async function writeCfb(
  build: (cfb: CFB.CFB$Container) => void,
  name: string,
): Promise<string> {
  const cfb = CFB.utils.cfb_new();
  build(cfb);
  const out = CFB.write(cfb, { type: "buffer" }) as Buffer;
  const filePath = join(dir, name);
  await writeFile(filePath, out);
  return filePath;
}

describe("extractHwp", () => {
  it("BodyText/Section0의 비압축 PARA_TEXT 본문을 full로 추출", async () => {
    const filePath = await writeCfb((cfb) => {
      CFB.utils.cfb_add(cfb, "/FileHeader", fileHeaderUncompressed());
      CFB.utils.cfb_add(
        cfb,
        "/BodyText/Section0",
        paraTextRecord("본문내용"),
      );
    }, "full.hwp");
    const r = await extractHwp(filePath);
    expect(r.status).toBe("full");
    expect(r.text).toContain("본문내용");
  });

  it("여러 Section의 본문을 순서대로 이어붙인다", async () => {
    const filePath = await writeCfb((cfb) => {
      CFB.utils.cfb_add(cfb, "/FileHeader", fileHeaderUncompressed());
      CFB.utils.cfb_add(cfb, "/BodyText/Section0", paraTextRecord("첫섹션"));
      CFB.utils.cfb_add(cfb, "/BodyText/Section1", paraTextRecord("둘섹션"));
    }, "multi.hwp");
    const r = await extractHwp(filePath);
    expect(r.status).toBe("full");
    expect(r.text).toContain("첫섹션");
    expect(r.text).toContain("둘섹션");
  });

  it("압축(zlib raw) 본문을 inflate해 full로 추출", async () => {
    const section = deflateRawSync(paraTextRecord("압축본문내용"));
    const filePath = await writeCfb((cfb) => {
      CFB.utils.cfb_add(cfb, "/FileHeader", fileHeaderCompressed());
      CFB.utils.cfb_add(cfb, "/BodyText/Section0", section);
    }, "compressed.hwp");
    const r = await extractHwp(filePath);
    expect(r.status).toBe("full");
    expect(r.text).toContain("압축본문내용");
  });

  it("확장 size(0xfff) PARA_TEXT 레코드를 처리", async () => {
    const filePath = await writeCfb((cfb) => {
      CFB.utils.cfb_add(cfb, "/FileHeader", fileHeaderUncompressed());
      CFB.utils.cfb_add(
        cfb,
        "/BodyText/Section0",
        paraTextRecordExtended("확장크기본문"),
      );
    }, "extsize.hwp");
    const r = await extractHwp(filePath);
    expect(r.status).toBe("full");
    expect(r.text).toContain("확장크기본문");
  });

  it("인라인 제어(8 WCHAR)의 데이터 워드가 본문으로 새지 않는다", async () => {
    const filePath = await writeCfb((cfb) => {
      CFB.utils.cfb_add(cfb, "/FileHeader", fileHeaderUncompressed());
      CFB.utils.cfb_add(
        cfb,
        "/BodyText/Section0",
        paraTextWithInlineControl("앞부분", "뒷부분"),
      );
    }, "inlinectrl.hwp");
    const r = await extractHwp(filePath);
    expect(r.status).toBe("full");
    expect(r.text).toContain("앞부분");
    expect(r.text).toContain("뒷부분");
    // 제어 데이터 워드(가·각…)가 본문에 섞이면 안 됨
    expect(r.text).not.toContain("각");
  });

  it("BodyText가 없으면 PrvText로 preview 폴백", async () => {
    const filePath = await writeCfb((cfb) => {
      CFB.utils.cfb_add(cfb, "/PrvText", utf16le("미리보기 목차"));
    }, "preview.hwp");
    const r = await extractHwp(filePath);
    expect(r.status).toBe("preview");
    expect(r.text).toContain("미리보기 목차");
  });

  it("비-OLE 버퍼는 error(전체 throw 안 함)", async () => {
    const filePath = join(dir, "notole.hwp");
    await writeFile(filePath, Buffer.from("not an ole file at all", "utf8"));
    const r = await extractHwp(filePath);
    expect(r.status).toBe("error");
    expect(r.error).toBeTruthy();
  });

  it("BodyText·PrvText 모두 없으면 error", async () => {
    const filePath = await writeCfb((cfb) => {
      CFB.utils.cfb_add(cfb, "/FileHeader", fileHeaderUncompressed());
    }, "nostreams.hwp");
    const r = await extractHwp(filePath);
    expect(r.status).toBe("error");
  });
});
