import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import type { DataGoKrClient, RawItem } from "@opendata-kr/core";
import { runDownloadAttachments } from "./downloadAttachments.js";

const SERVC_OP = "getBidPblancListInfoServc";
const EORDER_OP = "getBidPblancListInfoEorderAtchFileInfo";
const RFP_OP = "getBidPblancListPPIFnlRfpIssAtchFileInfo";

// 공고 규격첨부(notice) item = ntceSpec 쌍. resolveAttachments가 이를 top-level 첨부로 편다.
function noticeItem(pairs: [string, string][]): RawItem {
  const o: Record<string, string> = { bidNtceNo: "R26", bidNtceOrd: "000" };
  pairs.forEach(([nm, url], i) => {
    o[`ntceSpecFileNm${i + 1}`] = nm;
    o[`ntceSpecDocUrl${i + 1}`] = url;
  });
  return o as RawItem;
}

// servc 목록 op가 규격첨부를, 첨부 op는 빈 응답을 준다.
function makeClient(noticePairs: [string, string][]): DataGoKrClient {
  return {
    call: async (op: string) => {
      if (op === EORDER_OP || op === RFP_OP) return { totalCount: 0, items: [] };
      if (op === SERVC_OP) return { totalCount: 1, items: [noticeItem(noticePairs)] };
      return { totalCount: 0, items: [] };
    },
  } as unknown as DataGoKrClient;
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
  tmp = mkdtempSync(path.join(os.tmpdir(), "dl-manifest-"));
  process.env.DATA_GO_KR_DOWNLOAD_DIR = tmp;
});
afterAll(() => {
  delete process.env.DATA_GO_KR_DOWNLOAD_DIR;
  rmSync(tmp, { recursive: true, force: true });
});

describe("runDownloadAttachments (매니페스트)", () => {
  it("최상위 파일을 매니페스트로 반환한다(본문 텍스트 없음)", async () => {
    const client = makeClient([
      ["제안요청서.hwpx", "https://f/a"],
      ["안내.pdf", "https://f/b"],
    ]);
    const fetchFn = makeFetch({ "https://f/a": makeHwpx("x"), "https://f/b": strToU8("%PDF") });
    const out = await runDownloadAttachments(client, { bidNtceNo: "R26A" }, { fetch: fetchFn });

    expect(out.files.map((f) => f.fileNm)).toEqual(["제안요청서.hwpx", "안내.pdf"]);
    expect(out.files[0]).toMatchObject({ index: 0, format: "hwpx", extractable: true });
    expect(out.files[1]).toMatchObject({ index: 1, format: "other", extractable: false });
    expect(out.files[0]!.byteSize).toBeGreaterThan(0);
    // 매니페스트엔 본문 텍스트가 없다.
    expect((out.files[0] as unknown as Record<string, unknown>).text).toBeUndefined();
  });

  it("zip은 내부 파일로 펼치고 container에 원본 zip명을 담는다", async () => {
    const zip = zipSync({
      "제안요청서.hwpx": makeHwpx("본문"),
      "공고.doc": strToU8("x"),
      "스캔.pdf": strToU8("y"),
    });
    const client = makeClient([["공고파일.zip", "https://f/zip"]]);
    const fetchFn = makeFetch({ "https://f/zip": zip });
    const out = await runDownloadAttachments(client, { bidNtceNo: "R26Z" }, { fetch: fetchFn });

    // zip 컨테이너는 목록에 없고 내부 3개가 펼쳐진다.
    expect(out.files.map((f) => f.fileNm)).toEqual(["제안요청서.hwpx", "공고.doc", "스캔.pdf"]);
    expect(out.files.every((f) => f.container === "공고파일.zip")).toBe(true);
    expect(out.files[0]).toMatchObject({ format: "hwpx", extractable: true });
    expect(out.files[1]).toMatchObject({ format: "doc", extractable: true });
    expect(out.files[2]).toMatchObject({ format: "other", extractable: false, note: "미지원 포맷" });
    // index는 0..2로 평평하다.
    expect(out.files.map((f) => f.index)).toEqual([0, 1, 2]);
  });

  it("첨부 0건이면 files=[]·anySucceeded=true", async () => {
    const out = await runDownloadAttachments(makeClient([]), { bidNtceNo: "EMPTY" });
    expect(out.files).toEqual([]);
    expect(out.anySucceeded).toBe(true);
  });

  it("refresh=true면 캐시를 무시하고 재다운로드한다", async () => {
    let hits = 0;
    const fetchFn = (async () => {
      hits += 1;
      return new Response(makeHwpx("x"));
    }) as unknown as typeof fetch;
    const client = makeClient([["문서.hwpx", "https://f/r"]]);

    await runDownloadAttachments(client, { bidNtceNo: "REF" }, { fetch: fetchFn });
    await runDownloadAttachments(client, { bidNtceNo: "REF" }, { fetch: fetchFn }); // 재사용
    expect(hits).toBe(1);
    await runDownloadAttachments(client, { bidNtceNo: "REF", refresh: true }, { fetch: fetchFn }); // 강제
    expect(hits).toBe(2);
  });
});
