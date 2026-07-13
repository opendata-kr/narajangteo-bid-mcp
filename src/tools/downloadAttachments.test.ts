import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, readdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import type { DataGoKrClient, RawItem } from "@opendata-kr/core";
import { runDownloadAttachments } from "./downloadAttachments.js";

const SERVC_OP = "getBidPblancListInfoServc";
const EORDER_OP = "getBidPblancListInfoEorderAtchFileInfo";
const RFP_OP = "getBidPblancListPPIFnlRfpIssAtchFileInfo";

function noticeItem(pairs: [string, string][]): RawItem {
  const o: Record<string, string> = { bidNtceNo: "R26", bidNtceOrd: "000" };
  pairs.forEach(([nm, url], i) => {
    o[`ntceSpecFileNm${i + 1}`] = nm;
    o[`ntceSpecDocUrl${i + 1}`] = url;
  });
  return o as RawItem;
}

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
  tmp = mkdtempSync(path.join(os.tmpdir(), "dl-catalog-"));
  process.env.DATA_GO_KR_DOWNLOAD_DIR = tmp;
});
afterAll(() => {
  delete process.env.DATA_GO_KR_DOWNLOAD_DIR;
  rmSync(tmp, { recursive: true, force: true });
});

describe("runDownloadAttachments (파일 카탈로그)", () => {
  it("최상위 파일을 디스크에 받고 카탈로그로 반환한다(savedPath=실제 파일)", async () => {
    const client = makeClient([
      ["제안요청서.hwpx", "https://f/a"],
      ["안내.pdf", "https://f/b"],
    ]);
    const fetchFn = makeFetch({ "https://f/a": makeHwpx("x"), "https://f/b": strToU8("%PDF") });
    const out = await runDownloadAttachments(client, { bidNtceNo: "C1" }, { fetch: fetchFn });

    expect(out.files.map((f) => f.fileNm)).toEqual(["제안요청서.hwpx", "안내.pdf"]);
    expect(out.files[0]).toMatchObject({ index: 0, format: "hwpx", extractable: true });
    expect(out.files[1]).toMatchObject({ index: 1, format: "other", extractable: false });
    // savedPath가 실제 디스크 파일을 가리키고 존재한다.
    expect(existsSync(out.files[0]!.savedPath)).toBe(true);
    expect(out.files[0]!.byteSize).toBeGreaterThan(0);
    // 카탈로그가 영속된다.
    expect(existsSync(path.join(tmp, "C1", ".attachments-manifest.json"))).toBe(true);
  });

  it("zip은 내부 파일로 평탄하게 풀고 원본 zip은 삭제한다", async () => {
    const zip = zipSync({
      "제안요청서.hwpx": makeHwpx("본문"),
      "공고.doc": strToU8("D"),
      "스캔.pdf": strToU8("P"),
    });
    const client = makeClient([["공고파일.zip", "https://f/zip"]]);
    const out = await runDownloadAttachments(client, { bidNtceNo: "CZ" }, { fetch: makeFetch({ "https://f/zip": zip }) });

    // zip 컨테이너는 목록에 없고 내부 3개가 펼쳐진다(container 표기).
    expect(out.files.map((f) => f.fileNm)).toEqual(["제안요청서.hwpx", "공고.doc", "스캔.pdf"]);
    expect(out.files.every((f) => f.container === "공고파일.zip")).toBe(true);
    // 디스크엔 풀린 파일만, 원본 zip은 없다.
    const onDisk = readdirSync(path.join(tmp, "CZ")).filter((n) => !n.startsWith("."));
    expect(onDisk.sort()).toEqual(["공고.doc", "스캔.pdf", "제안요청서.hwpx"]);
    expect(onDisk).not.toContain("공고파일.zip");
    // 내부 파일도 savedPath로 디스크에 존재.
    expect(existsSync(out.files[0]!.savedPath)).toBe(true);
  });

  it("첨부 0건이면 files=[]·anySucceeded=true", async () => {
    const out = await runDownloadAttachments(makeClient([]), { bidNtceNo: "CE" });
    expect(out.files).toEqual([]);
    expect(out.anySucceeded).toBe(true);
  });

  it("캐시 재사용: 두 번째 호출은 재다운로드하지 않고, refresh=true는 다시 받는다", async () => {
    let hits = 0;
    const fetchFn = (async () => {
      hits += 1;
      return new Response(makeHwpx("x"));
    }) as unknown as typeof fetch;
    const client = makeClient([["문서.hwpx", "https://f/r"]]);

    await runDownloadAttachments(client, { bidNtceNo: "CR" }, { fetch: fetchFn });
    await runDownloadAttachments(client, { bidNtceNo: "CR" }, { fetch: fetchFn }); // 카탈로그 재사용
    expect(hits).toBe(1);
    await runDownloadAttachments(client, { bidNtceNo: "CR", refresh: true }, { fetch: fetchFn });
    expect(hits).toBe(2);
  });
});
