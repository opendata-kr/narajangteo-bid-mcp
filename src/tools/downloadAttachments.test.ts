import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import type { DataGoKrClient, RawItem } from "@opendata-kr/core";
import { runDownloadAttachments } from "./downloadAttachments.js";

const EORDER_OP = "getBidPblancListInfoEorderAtchFileInfo"; // I e발주
const RFP_OP = "getBidPblancListPPIFnlRfpIssAtchFileInfo"; // J 혁신장터RFP

// 유효 HWPX = Contents/section0.xml 하나를 담은 zip. 추출 텍스트는 innerText 그대로다
// (extractHwpx가 태그 제거·공백 정규화하는데 innerText에 공백을 넣지 않는다).
function makeHwpx(innerText: string): Uint8Array {
  return zipSync({ "Contents/section0.xml": strToU8(`<x>${innerText}</x>`) });
}
// 손상 HWPX = section*.xml이 없는 zip → extractHwpx가 status="error".
function makeCorruptHwpx(): Uint8Array {
  return zipSync({ "junk.txt": strToU8("본문 아님") });
}
const PDF_BYTES = strToU8("%PDF-1.4 not-a-hangul-doc");

// op별 응답을 흉내내는 손 stub. call(op)가 op명으로 분기해 {totalCount, items} 또는 throw.
function makeClient(scenario: {
  eorder?: RawItem[] | "throw";
  rfp?: RawItem[] | "throw";
}): DataGoKrClient {
  const fake = {
    call: async (op: string) => {
      const which = op === EORDER_OP ? scenario.eorder : op === RFP_OP ? scenario.rfp : [];
      if (which === "throw") throw new Error(`${op} 조회 실패`);
      const items = which ?? [];
      return { totalCount: items.length, items };
    },
  };
  return fake as unknown as DataGoKrClient;
}

// eorder 응답 item(eorder* 필드명)·rfp 응답 item(atch* 필드명) 빌더.
const eorderItem = (fileNm: string, fileUrl: string): RawItem =>
  ({ eorderAtchFileNm: fileNm, eorderAtchFileUrl: fileUrl }) as RawItem;
const rfpItem = (fileNm: string, fileUrl: string): RawItem =>
  ({ atchFileNm: fileNm, atchFileUrl: fileUrl }) as RawItem;

// url→바이트 맵으로 fetch를 흉내낸다. "throw"면 다운로드 단계 실패.
function makeFetch(map: Record<string, Uint8Array | "throw">): typeof fetch {
  return (async (input: unknown) => {
    const url = String(input);
    const body = map[url];
    if (body === undefined) throw new Error(`fake fetch 미등록 URL: ${url}`);
    if (body === "throw") throw new Error("네트워크 연결 실패");
    return new Response(body);
  }) as unknown as typeof fetch;
}

let tmpBase: string;
beforeAll(() => {
  tmpBase = mkdtempSync(path.join(os.tmpdir(), "bid-dl-test-"));
  process.env.DATA_GO_KR_DOWNLOAD_DIR = tmpBase;
});
afterAll(() => {
  delete process.env.DATA_GO_KR_DOWNLOAD_DIR;
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("runDownloadAttachments", () => {
  it("파일별 다운로드 실패를 per-file로 격리하고 나머지는 정상 반환한다", async () => {
    const client = makeClient({
      eorder: [
        eorderItem("정상.hwpx", "https://f/ok"),
        eorderItem("실패.hwpx", "https://f/fail"),
      ],
      rfp: [],
    });
    const fetchFn = makeFetch({
      "https://f/ok": makeHwpx("정상본문"),
      "https://f/fail": "throw",
    });

    const out = await runDownloadAttachments(client, { bidNtceNo: "PERFILE1" }, { fetch: fetchFn });

    expect(out.anySucceeded).toBe(true);
    expect(out.files).toHaveLength(2);
    const ok = out.files[0]!;
    const fail = out.files[1]!;
    expect(ok.downloadStatus).toBe("ok");
    expect(fail.downloadStatus).toBe("error");
    if (fail.downloadStatus === "error") expect(fail.error).toContain("네트워크");
  });

  it("두 op가 모두 API 에러면 anySucceeded=false·resolveErrors 존재·files=[]", async () => {
    const client = makeClient({ eorder: "throw", rfp: "throw" });
    const out = await runDownloadAttachments(client, { bidNtceNo: "RESOLVEERR" });

    expect(out.anySucceeded).toBe(false);
    expect(out.files).toEqual([]);
    expect(out.resolveErrors).toBeDefined();
    expect(out.resolveErrors).toHaveProperty("eorder");
    expect(out.resolveErrors).toHaveProperty("innovationRfp");
  });

  it("첨부 0건이면 anySucceeded=true·resolveErrors 없음·files=[]", async () => {
    const client = makeClient({ eorder: [], rfp: [] });
    const out = await runDownloadAttachments(client, { bidNtceNo: "EMPTY" });

    expect(out.anySucceeded).toBe(true);
    expect(out.files).toEqual([]);
    expect(out.resolveErrors).toBeUndefined();
  });

  it("프리뷰 모드: 각 파일 text를 PREVIEW_CHARS로 컷하고 truncated를 반영한다", async () => {
    const longText = "가".repeat(5000);
    const client = makeClient({
      eorder: [
        eorderItem("긴문서.hwpx", "https://f/long"),
        eorderItem("짧은문서.hwpx", "https://f/short"),
      ],
      rfp: [],
    });
    const fetchFn = makeFetch({
      "https://f/long": makeHwpx(longText),
      "https://f/short": makeHwpx("짧은본문"),
    });

    const out = await runDownloadAttachments(client, { bidNtceNo: "PREVIEW" }, { fetch: fetchFn });

    const long = out.files[0]!;
    const short = out.files[1]!;
    if (long.downloadStatus === "ok") {
      expect(long.extractStatus).toBe("full");
      expect(long.text).toHaveLength(3000);
      expect(long.textLength).toBe(5000);
      expect(long.truncated).toBe(true);
    } else throw new Error("long은 ok여야 함");
    if (short.downloadStatus === "ok") {
      expect(short.textLength).toBe(4);
      expect(short.truncated).toBe(false);
    } else throw new Error("short은 ok여야 함");
  });

  it("fileIndex 페이지네이션: 중간·마지막·끝넘음을 각각 처리한다", async () => {
    const longText = "가".repeat(5000);
    const client = makeClient({ eorder: [eorderItem("문서.hwpx", "https://f/p")], rfp: [] });
    const fetchFn = makeFetch({ "https://f/p": makeHwpx(longText) });

    // 중간 페이지: offset 1000, maxChars 1000 → 1000자·truncated true.
    const mid = await runDownloadAttachments(
      client,
      { bidNtceNo: "PAGEMID", fileIndex: 0, offset: 1000, maxChars: 1000 },
      { fetch: fetchFn },
    );
    expect(mid.files).toHaveLength(1);
    const midF = mid.files[0]!;
    if (midF.downloadStatus === "ok") {
      expect(midF.text).toHaveLength(1000);
      expect(midF.textLength).toBe(5000);
      expect(midF.truncated).toBe(true);
    } else throw new Error("ok여야 함");

    // 마지막 페이지: offset 4000, maxChars 5000 → 1000자·truncated false.
    const last = await runDownloadAttachments(
      client,
      { bidNtceNo: "PAGELAST", fileIndex: 0, offset: 4000, maxChars: 5000 },
      { fetch: fetchFn },
    );
    const lastF = last.files[0]!;
    if (lastF.downloadStatus === "ok") {
      expect(lastF.text).toHaveLength(1000);
      expect(lastF.truncated).toBe(false);
    } else throw new Error("ok여야 함");

    // 끝 넘음: offset 5000 → text=""·truncated false.
    const over = await runDownloadAttachments(
      client,
      { bidNtceNo: "PAGEOVER", fileIndex: 0, offset: 5000, maxChars: 100 },
      { fetch: fetchFn },
    );
    const overF = over.files[0]!;
    if (overF.downloadStatus === "ok") {
      expect(overF.text).toBe("");
      expect(overF.truncated).toBe(false);
      expect(overF.textLength).toBe(5000);
    } else throw new Error("ok여야 함");
  });

  it("입력 경계 위반은 회복 지시 에러로 throw한다", async () => {
    const client = makeClient({ eorder: [eorderItem("문서.hwpx", "https://f/b")], rfp: [] });
    const fetchFn = makeFetch({ "https://f/b": makeHwpx("본문") });

    await expect(
      runDownloadAttachments(client, { bidNtceNo: "B1", fileIndex: 5 }, { fetch: fetchFn }),
    ).rejects.toThrow(/fileIndex/);
    await expect(
      runDownloadAttachments(client, { bidNtceNo: "B2", fileIndex: -1 }, { fetch: fetchFn }),
    ).rejects.toThrow(/fileIndex/);
    await expect(
      runDownloadAttachments(
        client,
        { bidNtceNo: "B3", fileIndex: 0, offset: -1 },
        { fetch: fetchFn },
      ),
    ).rejects.toThrow(/offset/);
    await expect(
      runDownloadAttachments(
        client,
        { bidNtceNo: "B4", fileIndex: 0, maxChars: 0 },
        { fetch: fetchFn },
      ),
    ).rejects.toThrow(/maxChars/);
  });

  it("fileIndex가 텍스트 없는 파일을 가리키면 슬라이스 없이 원형 단건 반환", async () => {
    const client = makeClient({ eorder: [eorderItem("스캔.pdf", "https://f/pdf")], rfp: [] });
    const fetchFn = makeFetch({ "https://f/pdf": PDF_BYTES });

    const out = await runDownloadAttachments(
      client,
      { bidNtceNo: "NOTEXT", fileIndex: 0, offset: 10, maxChars: 5 },
      { fetch: fetchFn },
    );
    expect(out.files).toHaveLength(1);
    const f = out.files[0]!;
    if (f.downloadStatus === "ok") {
      expect(f.extractStatus).toBe("unsupported");
      expect(f.text).toBe("");
      expect(f.textLength).toBe(0);
      expect(f.truncated).toBe(false);
    } else throw new Error("ok여야 함");
  });

  it("fileIndex가 다운로드 실패 파일을 가리키면 그 error 엔트리 단건 반환", async () => {
    const client = makeClient({ eorder: [eorderItem("실패.hwpx", "https://f/x")], rfp: [] });
    const fetchFn = makeFetch({ "https://f/x": "throw" });

    const out = await runDownloadAttachments(
      client,
      { bidNtceNo: "IDXERR", fileIndex: 0 },
      { fetch: fetchFn },
    );
    expect(out.files).toHaveLength(1);
    expect(out.files[0]!.downloadStatus).toBe("error");
  });

  it("미지원 포맷(.pdf)은 downloadStatus=ok·extractStatus=unsupported·text=''", async () => {
    const client = makeClient({ eorder: [], rfp: [rfpItem("첨부.pdf", "https://f/pdf2")] });
    const fetchFn = makeFetch({ "https://f/pdf2": PDF_BYTES });

    const out = await runDownloadAttachments(client, { bidNtceNo: "PDF" }, { fetch: fetchFn });
    const f = out.files[0]!;
    if (f.downloadStatus === "ok") {
      expect(f.downloadStatus).toBe("ok");
      expect(f.format).toBe("other");
      expect(f.extractStatus).toBe("unsupported");
      expect(f.text).toBe("");
      expect(f.textLength).toBe(0);
    } else throw new Error("ok여야 함");
  });

  it("추출 실패(손상 hwpx)를 격리해 throw 없이 extractStatus=error·extractError 세팅", async () => {
    const client = makeClient({ eorder: [eorderItem("손상.hwpx", "https://f/corrupt")], rfp: [] });
    const fetchFn = makeFetch({ "https://f/corrupt": makeCorruptHwpx() });

    const out = await runDownloadAttachments(client, { bidNtceNo: "CORRUPT" }, { fetch: fetchFn });
    const f = out.files[0]!;
    if (f.downloadStatus === "ok") {
      expect(f.extractStatus).toBe("error");
      expect(f.extractError).toBeDefined();
      expect(f.savedPath).toBeTruthy();
      expect(f.text).toBe("");
    } else throw new Error("다운로드 자체는 ok여야 함");
  });

  it("첨부 수가 MAX_ATTACHMENTS(20)를 넘으면 files=20·truncatedFileList=true", async () => {
    const items = Array.from({ length: 21 }, (_, i) => eorderItem(`f${i}.hwpx`, `https://f/m${i}`));
    const client = makeClient({ eorder: items, rfp: [] });
    const map: Record<string, Uint8Array> = {};
    for (let i = 0; i < 21; i += 1) map[`https://f/m${i}`] = makeHwpx(`본문${i}`);
    const fetchFn = makeFetch(map);

    const out = await runDownloadAttachments(client, { bidNtceNo: "MAX" }, { fetch: fetchFn });
    expect(out.files).toHaveLength(20);
    expect(out.truncatedFileList).toBe(true);
  });

  it("재호출·페이지네이션은 이미 저장된 파일을 재사용하고 fetch하지 않는다", async () => {
    const client = makeClient({
      eorder: [eorderItem("제안요청서.hwpx", "https://f/rep")],
      rfp: [],
    });
    const urls: string[] = [];
    const countingFetch = (async (input: unknown) => {
      urls.push(String(input));
      return new Response(makeHwpx("반복본문"));
    }) as unknown as typeof fetch;

    const first = await runDownloadAttachments(client, { bidNtceNo: "REUSE1" }, { fetch: countingFetch });
    const second = await runDownloadAttachments(
      client,
      { bidNtceNo: "REUSE1", fileIndex: 0, offset: 0, maxChars: 100 },
      { fetch: countingFetch },
    );
    const f0 = first.files[0]!;
    const s0 = second.files[0]!;
    if (f0.downloadStatus !== "ok" || s0.downloadStatus !== "ok") throw new Error("ok 아님");
    // 첫 호출만 fetch, 둘째(페이지네이션)는 디스크 재사용으로 fetch 없음.
    expect(urls).toEqual(["https://f/rep"]);
    expect(s0.savedPath).toBe(f0.savedPath);
    // 공고 폴더에 첨부 1개만(누적·` (1)` 사본 없음).
    expect(readdirSync(path.join(tmpBase, "REUSE1"))).toEqual(["제안요청서.hwpx"]);
  });

  it("fileIndex 모드는 대상 첨부 하나만 다운로드한다(나머지 fetch 안 함)", async () => {
    const client = makeClient({
      eorder: [
        eorderItem("첫번째.hwpx", "https://f/t0"),
        eorderItem("둘째.hwpx", "https://f/t1"),
        eorderItem("셋째.hwpx", "https://f/t2"),
      ],
      rfp: [],
    });
    const urls: string[] = [];
    const countingFetch = (async (input: unknown) => {
      urls.push(String(input));
      return new Response(makeHwpx("본문"));
    }) as unknown as typeof fetch;

    const out = await runDownloadAttachments(
      client,
      { bidNtceNo: "TARGET1", fileIndex: 1 },
      { fetch: countingFetch },
    );
    // 대상(index 1)만 fetch, index 0·2는 다운로드 안 함.
    expect(urls).toEqual(["https://f/t1"]);
    expect(out.files).toHaveLength(1);
  });
});
