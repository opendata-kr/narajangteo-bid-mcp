import { describe, it, expect } from "vitest";
import * as CFB from "cfb";
import { extractDocFromBuffer } from "./doc.js";

// 합성 .doc 빌더. WordDocument에 FIB + 텍스트를, 1Table에 piece table(CLX)을 넣어
// 실제 Word 97-2003 배치를 흉내낸다. 파서를 실제 포맷 규칙으로 검증한다.
const TEXT_BASE = 0x800; // 텍스트 시작 오프셋(FIB 뒤 여유 공간)

interface PieceSpec {
  text: string;
  compressed?: boolean; // true=cp1252 1바이트/문자, 기본 UTF-16LE
}

function makeDoc(pieces: PieceSpec[]): Buffer {
  // 1) 텍스트를 WordDocument에 순차 배치하며 각 조각의 fc·cp를 기록.
  const chunks: { buf: Buffer; compressed: boolean; nChars: number }[] = [];
  for (const p of pieces) {
    const buf = p.compressed
      ? Buffer.from(p.text, "latin1")
      : Buffer.from(p.text, "utf16le");
    chunks.push({ buf, compressed: !!p.compressed, nChars: p.text.length });
  }
  const textTotal = chunks.reduce((s, c) => s + c.buf.length, 0);
  const wd = Buffer.alloc(TEXT_BASE + textTotal);
  const fcStarts: number[] = [];
  let off = TEXT_BASE;
  for (const c of chunks) {
    fcStarts.push(off);
    c.buf.copy(wd, off);
    off += c.buf.length;
  }

  // 2) CLX = 0x02 + lcb(4) + PlcPcd((n+1)*CP + n*PCD).
  const n = chunks.length;
  const lcb = 4 * (n + 1) + 8 * n;
  const clx = Buffer.alloc(1 + 4 + lcb);
  clx.writeUInt8(0x02, 0);
  clx.writeUInt32LE(lcb, 1);
  const cpBase = 5;
  const pcdBase = 5 + 4 * (n + 1);
  let cp = 0;
  for (let i = 0; i < n; i += 1) {
    clx.writeUInt32LE(cp, cpBase + 4 * i);
    cp += chunks[i]!.nChars;
    // PCD: 2바이트 플래그 + 4바이트 fc(+압축비트) + 2바이트 prm.
    const fc = chunks[i]!.compressed
      ? (fcStarts[i]! << 1) | 0x40000000
      : fcStarts[i]!;
    clx.writeUInt32LE(fc >>> 0, pcdBase + 8 * i + 2);
  }
  clx.writeUInt32LE(cp, cpBase + 4 * n); // 마지막 CP

  // 3) FIB 필드.
  wd.writeUInt16LE(0xa5ec, 0x0000); // wIdent
  wd.writeUInt16LE(0x0200, 0x000a); // flags: 1Table 사용
  wd.writeInt32LE(0, 0x01a2); // fcClx(1Table 내 오프셋 0)
  wd.writeUInt32LE(clx.length, 0x01a6); // lcbClx

  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, "WordDocument", wd);
  CFB.utils.cfb_add(cfb, "1Table", clx);
  return CFB.write(cfb, { type: "buffer" }) as Buffer;
}

describe("extractDocFromBuffer", () => {
  it("UTF-16 단일 조각 본문을 추출한다(한글 포함)", () => {
    const doc = makeDoc([{ text: "제안요청서 본문입니다." }]);
    const r = extractDocFromBuffer(doc);
    expect(r.status).toBe("full");
    expect(r.text).toBe("제안요청서 본문입니다.");
  });

  it("여러 조각을 CP 순서대로 이어붙인다", () => {
    const doc = makeDoc([{ text: "첫째 " }, { text: "둘째 " }, { text: "셋째" }]);
    const r = extractDocFromBuffer(doc);
    expect(r.status).toBe("full");
    expect(r.text).toBe("첫째 둘째 셋째");
  });

  it("압축(cp1252) 조각도 디코드한다", () => {
    const doc = makeDoc([{ text: "ASCII part", compressed: true }]);
    const r = extractDocFromBuffer(doc);
    expect(r.status).toBe("full");
    expect(r.text).toBe("ASCII part");
  });

  it("필드코드(0x13..0x14)는 버리고 필드결과는 남긴다", () => {
    // "링크: " + [0x13]"HYPERLINK http://x"[0x14]"바로가기"[0x15]
    const t = "링크: " + String.fromCharCode(0x13) + "HYPERLINK http://x" + String.fromCharCode(0x14) + "바로가기" + String.fromCharCode(0x15);
    const doc = makeDoc([{ text: t }]);
    const r = extractDocFromBuffer(doc);
    expect(r.status).toBe("full");
    expect(r.text).toBe("링크: 바로가기");
    expect(r.text).not.toContain("HYPERLINK");
  });

  it("문단끝(0x0D)·셀끝(0x07)을 개행으로 바꾼다", () => {
    const doc = makeDoc([{ text: "가" + String.fromCharCode(0x0d) + "나" + String.fromCharCode(0x07) + "다" }]);
    const r = extractDocFromBuffer(doc);
    expect(r.text).toBe("가\n나\n다");
  });

  it(".doc가 아니면(서명 불일치) status=error", () => {
    const notDoc = Buffer.from("PK not an ole file");
    const r = extractDocFromBuffer(notDoc);
    expect(r.status).toBe("error");
    expect(r.error).toBeDefined();
  });

  it("WordDocument 스트림이 없으면 status=error", () => {
    const cfb = CFB.utils.cfb_new();
    CFB.utils.cfb_add(cfb, "Other", Buffer.from([1, 2, 3]));
    const buf = CFB.write(cfb, { type: "buffer" }) as Buffer;
    const r = extractDocFromBuffer(buf);
    expect(r.status).toBe("error");
  });
});
