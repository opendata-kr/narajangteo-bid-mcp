import { readFile } from "node:fs/promises";
import * as CFB from "cfb";

// 구형 MS Word(.doc, Word 97-2003)는 OLE 컴파운드 파일이다. 본문 텍스트는 WordDocument
// 스트림에 있으나 그 배치는 Table 스트림(0Table 또는 1Table)의 piece table(CLX)이 정한다.
// CLX가 각 조각의 파일오프셋과 인코딩(UTF-16 또는 cp1252 압축)을 알려준다. fComplex(빠른저장)
// 여부와 무관하게 Word 97+는 항상 piece table을 쓰므로 CLX를 걸어야 정확히 읽는다.

export interface DocExtractResult {
  status: "full" | "error";
  text: string;
  error?: string;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toBuffer(content: CFB.CFB$Blob): Buffer {
  return Buffer.isBuffer(content) ? content : Buffer.from(content);
}

function findStream(cfb: CFB.CFB$Container, path: string): Buffer | undefined {
  const entry = CFB.find(cfb, path);
  return entry ? toBuffer(entry.content) : undefined;
}

// FIB(File Information Block) 오프셋(Word 97-2003).
const OFF_WIDENT = 0x0000; // 0xA5EC
const OFF_FLAGS = 0x000a; // bit 0x0200 = 1Table 사용
const OFF_FC_CLX = 0x01a2;
const OFF_LCB_CLX = 0x01a6;

const CLXT_PRC = 0x01; // 속성 수정자(건너뜀)
const CLXT_PCDT = 0x02; // piece table

interface Piece {
  fcStart: number; // WordDocument 내 바이트 오프셋
  nChars: number;
  compressed: boolean; // true=cp1252 1바이트/문자, false=UTF-16LE 2바이트/문자
}

// CLX(Table 스트림의 fcClx..+lcbClx)를 걸어 piece table을 조각 목록으로 푼다.
function parsePieceTable(clx: Buffer): Piece[] {
  let pos = 0;
  // Pcdt(0x02)를 만날 때까지 Prc(0x01)를 건너뛴다.
  while (pos < clx.length) {
    const clxt = clx[pos];
    if (clxt === CLXT_PRC) {
      if (pos + 3 > clx.length) return [];
      const cb = clx.readUInt16LE(pos + 1);
      pos += 3 + cb;
      continue;
    }
    if (clxt === CLXT_PCDT) break;
    return []; // 알 수 없는 clxt
  }
  if (pos >= clx.length || clx[pos] !== CLXT_PCDT) return [];
  if (pos + 5 > clx.length) return [];
  const lcb = clx.readUInt32LE(pos + 1);
  const plcStart = pos + 5;
  if (plcStart + lcb > clx.length || lcb < 4) return [];

  // PlcPcd = (n+1)개 CP(4바이트) + n개 PCD(8바이트). lcb = 12n + 4.
  const n = Math.floor((lcb - 4) / 12);
  if (n <= 0) return [];
  const cpBase = plcStart;
  const pcdBase = plcStart + 4 * (n + 1);

  const pieces: Piece[] = [];
  for (let i = 0; i < n; i += 1) {
    const cpStart = clx.readUInt32LE(cpBase + 4 * i);
    const cpEnd = clx.readUInt32LE(cpBase + 4 * (i + 1));
    const nChars = cpEnd - cpStart;
    if (nChars <= 0) continue;
    // PCD: 2바이트 플래그 + 4바이트 fc + 2바이트 prm. fc의 bit30=압축.
    const fc = clx.readUInt32LE(pcdBase + 8 * i + 2);
    const compressed = (fc & 0x40000000) !== 0;
    const masked = fc & 0x3fffffff;
    const fcStart = compressed ? masked >>> 1 : masked;
    pieces.push({ fcStart, nChars, compressed });
  }
  return pieces;
}

// Word 특수 제어문자를 정리한다. 필드코드(0x13..0x14 사이 지시문)는 버리고 필드결과는 남긴다.
// 문단·셀·줄바꿈은 개행으로, 나머지 제어문자는 제거한다.
function cleanText(raw: string): string {
  let out = "";
  let inFieldCode = false;
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw.charCodeAt(i);
    if (c === 0x13) { inFieldCode = true; continue; } // 필드 시작
    if (c === 0x14) { inFieldCode = false; continue; } // 필드 구분(이후 결과)
    if (c === 0x15) { inFieldCode = false; continue; } // 필드 끝
    if (inFieldCode) continue; // 필드 지시문은 버린다
    if (c === 0x0d || c === 0x0a || c === 0x0b || c === 0x0c || c === 0x07) {
      out += "\n"; // 문단·줄바꿈·페이지·셀 끝
      continue;
    }
    if (c === 0x09) { out += "\t"; continue; }
    if (c === 0x1e) { out += "-"; continue; } // 비분리 하이픈
    if (c < 0x20 || c === 0x1f || c === 0xfffe || c === 0xffff) continue; // 그 외 제어·플래그
    out += raw[i];
  }
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 압축(8비트) 조각은 latin1이 아니라 cp1252(windows-1252)다. 0x80-0x9F가 다르므로 정확한
// 디코더를 쓴다(스마트따옴표·대시 등 오독 방지). 한글 본문은 UTF-16 조각이라 이 경로 밖이다.
const CP1252 = new TextDecoder("windows-1252");

// 조각을 WordDocument에서 읽어 인코딩대로 디코드하고 이어붙인다.
function decodePieces(wd: Buffer, pieces: Piece[]): string {
  let text = "";
  for (const p of pieces) {
    if (p.compressed) {
      const end = Math.min(p.fcStart + p.nChars, wd.length);
      if (p.fcStart >= end) continue;
      text += CP1252.decode(wd.subarray(p.fcStart, end));
    } else {
      const end = Math.min(p.fcStart + p.nChars * 2, wd.length);
      if (p.fcStart >= end) continue;
      text += wd.subarray(p.fcStart, end).toString("utf16le");
    }
  }
  return text;
}

export function extractDocFromBuffer(buf: Buffer): DocExtractResult {
  let cfb: CFB.CFB$Container;
  try {
    cfb = CFB.read(buf, { type: "buffer" });
  } catch (err) {
    return { status: "error", text: "", error: `DOC(OLE) 파싱에 실패했습니다(.doc가 아니거나 손상): ${errMessage(err)}` };
  }

  const wd = findStream(cfb, "/WordDocument");
  if (!wd || wd.length < OFF_LCB_CLX + 4) {
    return { status: "error", text: "", error: "WordDocument 스트림을 찾을 수 없습니다(.doc가 아닐 수 있음)." };
  }
  if (wd.readUInt16LE(OFF_WIDENT) !== 0xa5ec) {
    return { status: "error", text: "", error: "WordDocument 서명(0xA5EC)이 아닙니다(.doc가 아닐 수 있음)." };
  }

  const flags = wd.readUInt16LE(OFF_FLAGS);
  const tableName = (flags & 0x0200) !== 0 ? "/1Table" : "/0Table";
  const table = findStream(cfb, tableName);
  const fcClx = wd.readInt32LE(OFF_FC_CLX);
  const lcbClx = wd.readUInt32LE(OFF_LCB_CLX);

  if (!table || lcbClx <= 0 || fcClx < 0 || fcClx + lcbClx > table.length) {
    return { status: "error", text: "", error: "piece table(CLX)을 읽을 수 없습니다(Table 스트림 부재·범위 초과)." };
  }

  const pieces = parsePieceTable(table.subarray(fcClx, fcClx + lcbClx));
  if (pieces.length === 0) {
    return { status: "error", text: "", error: "piece table에서 텍스트 조각을 찾지 못했습니다." };
  }

  const text = cleanText(decodePieces(wd, pieces));
  if (text.length === 0) {
    return { status: "error", text: "", error: "DOC 본문에서 추출된 텍스트가 없습니다." };
  }
  return { status: "full", text };
}

export async function extractDoc(filePath: string): Promise<DocExtractResult> {
  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch (err) {
    return { status: "error", text: "", error: `DOC 파일을 읽지 못했습니다: ${errMessage(err)}` };
  }
  return extractDocFromBuffer(buf);
}
