import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import type { DataGoKrClient } from "@opendata-kr/core";
import { makeTestClient } from "../test-helpers.js";
import { runReadAttachment } from "./readAttachment.js";
import { runDownloadAttachments } from "./downloadAttachments.js";

const SERVC_OP = "getBidPblancListInfoServc";
const EORDER_OP = "getBidPblancListInfoEorderAtchFileInfo";
const RFP_OP = "getBidPblancListPPIFnlRfpIssAtchFileInfo";

function noticeItem(pairs: [string, string][]): Record<string, unknown> {
  const o: Record<string, string> = { bidNtceNo: "R26", bidNtceOrd: "000" };
  pairs.forEach(([nm, url], i) => {
    o[`ntceSpecFileNm${i + 1}`] = nm;
    o[`ntceSpecDocUrl${i + 1}`] = url;
  });
  return o;
}

function makeClient(noticePairs: [string, string][]): DataGoKrClient {
  return makeTestClient({
    [SERVC_OP]: { items: [noticeItem(noticePairs)], totalCount: 1 },
  }).client;
}

const makeHwpx = (inner: string): Uint8Array =>
  zipSync({ "Contents/section0.xml": strToU8(`<x>${inner}</x>`) });

function makeFetch(map: Record<string, Uint8Array>): typeof fetch {
  return (async (input: unknown) => {
    const body = map[String(input)];
    if (!body) throw new Error(`미등록 URL: ${String(input)}`);
    return new Response(body);
  }) as unknown as typeof fetch;
}

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "read-attach2-"));
  process.env.DATA_GO_KR_DOWNLOAD_DIR = tmp;
});
afterAll(() => {
  delete process.env.DATA_GO_KR_DOWNLOAD_DIR;
  rmSync(tmp, { recursive: true, force: true });
});

describe("runReadAttachment", () => {
  it("콜드 호출도 자동 materialize 후 본문을 읽는다(디스크 직독)", async () => {
    const client = makeClient([["제안요청서.hwpx", "https://f/a"]]);
    const fetchFn = makeFetch({ "https://f/a": makeHwpx("제안요청 본문") });
    const out = await runReadAttachment(client, { bidNtceNo: "RA1", index: 0 }, { fetch: fetchFn });
    expect(out.fileNm).toBe("제안요청서.hwpx");
    expect(out.extractStatus).toBe("full");
    expect(out.text).toContain("제안요청 본문");
  });

  it("zip 내부 파일을 index로 읽는다(container 표기, 디스크에서)", async () => {
    const zip = zipSync({ "제안요청서.hwpx": makeHwpx("zip속 본문"), "스캔.pdf": strToU8("y") });
    const client = makeClient([["공고파일.zip", "https://f/zip"]]);
    const fetchFn = makeFetch({ "https://f/zip": zip });
    const out = await runReadAttachment(client, { bidNtceNo: "RA2", index: 0 }, { fetch: fetchFn });
    expect(out.fileNm).toBe("제안요청서.hwpx");
    expect(out.container).toBe("공고파일.zip");
    expect(out.extractStatus).toBe("full");
    expect(out.text).toContain("zip속 본문");
  });

  it("미지원 항목은 unsupported·빈 텍스트(savedPath는 존재)", async () => {
    const client = makeClient([["안내.pdf", "https://f/p"]]);
    const fetchFn = makeFetch({ "https://f/p": strToU8("%PDF") });
    const out = await runReadAttachment(client, { bidNtceNo: "RA3", index: 0 }, { fetch: fetchFn });
    expect(out.extractStatus).toBe("unsupported");
    expect(out.text).toBe("");
    expect(out.savedPath).toBeTruthy();
  });

  it("index 범위 초과는 회복 지시 에러", async () => {
    const client = makeClient([["문서.hwpx", "https://f/a"]]);
    const fetchFn = makeFetch({ "https://f/a": makeHwpx("x") });
    await expect(
      runReadAttachment(client, { bidNtceNo: "RA4", index: 5 }, { fetch: fetchFn }),
    ).rejects.toThrow(/index/);
  });

  it("첨부 0건 공고는 index 시도 시 명확한 에러(0..-1 없음)", async () => {
    await expect(
      runReadAttachment(makeClient([]), { bidNtceNo: "RA0", index: 0 }),
    ).rejects.toThrow(/첨부 파일이 없습니다/);
  });

  it("offset·maxChars 페이지네이션", async () => {
    const long = "가".repeat(5000);
    const client = makeClient([["긴문서.hwpx", "https://f/l"]]);
    const fetchFn = makeFetch({ "https://f/l": makeHwpx(long) });
    const mid = await runReadAttachment(client, { bidNtceNo: "RA5", index: 0, offset: 1000, maxChars: 1000 }, { fetch: fetchFn });
    expect(mid.text).toHaveLength(1000);
    expect(mid.textLength).toBe(5000);
    expect(mid.truncated).toBe(true);
  });

  it("download 카탈로그의 index와 read가 일관된다", async () => {
    const zip = zipSync({ "a.hwpx": makeHwpx("A본문"), "b.doc": strToU8("x") });
    const client = makeClient([
      ["표지.hwpx", "https://f/top"],
      ["묶음.zip", "https://f/zip"],
    ]);
    const fetchFn = makeFetch({ "https://f/top": makeHwpx("표지본문"), "https://f/zip": zip });
    const list = await runDownloadAttachments(client, { bidNtceNo: "RA6" }, { fetch: fetchFn });
    expect(list.files.map((f) => f.fileNm)).toEqual(["표지.hwpx", "a.hwpx", "b.doc"]);
    const read1 = await runReadAttachment(client, { bidNtceNo: "RA6", index: 1 }, { fetch: fetchFn });
    expect(read1.fileNm).toBe("a.hwpx");
    expect(read1.container).toBe("묶음.zip");
    expect(read1.text).toContain("A본문");
  });
});
