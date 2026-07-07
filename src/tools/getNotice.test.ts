import { describe, expect, it, vi } from "vitest";
import type { DataGoKrClient, OperationResult, Params } from "@opendata-kr/core";
import { runGetNotice } from "./getNotice.js";

function makeClient(
  callImpl: (op: string, params?: Params) => Promise<OperationResult>,
  serviceKeyLooksPreEncoded = false,
): DataGoKrClient {
  return { serviceKeyLooksPreEncoded, call: vi.fn(callImpl) };
}

describe("runGetNotice", () => {
  it("bidKind 미지정 시 매칭되는 구분의 공고를 반환한다", async () => {
    const client = makeClient(async (op): Promise<OperationResult> => {
      if (op === "getBidPblancListInfoThng") {
        return {
          totalCount: 1,
          pageNo: 1,
          items: [{ bidNtceNo: "R25BK0001", bidNtceNm: "물품공고" }],
        };
      }
      return { totalCount: 0, pageNo: 1, items: [] };
    });
    const r = await runGetNotice(client, { bidNtceNo: "R25BK0001" });
    expect(r.found).toBe(true);
    expect(r.bidKind).toBe("thng");
    expect(r.notice?.bidNtceNm).toBe("물품공고");
  });

  it("어디에도 없으면 found=false", async () => {
    const client = makeClient(
      async (): Promise<OperationResult> => ({
        totalCount: 0,
        pageNo: 1,
        items: [],
      }),
    );
    const r = await runGetNotice(client, { bidNtceNo: "X" });
    expect(r.found).toBe(false);
    expect(r.searchedKinds).toHaveLength(4);
  });

  it("모든 구분이 실패하면 found:false이고 errors가 포함된다", async () => {
    const client = makeClient(async (): Promise<OperationResult> => {
      throw new Error("[30] 등록되지 않은 서비스키입니다.");
    });
    const r = await runGetNotice(client, { bidNtceNo: "X" });
    expect(r.found).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/등록되지 않은 서비스키/);
  });

  it("bidKind 지정 시 해당 구분만 조회한다", async () => {
    const client = makeClient(
      async (): Promise<OperationResult> => ({
        totalCount: 1,
        pageNo: 1,
        items: [{ bidNtceNo: "R1" }],
      }),
    );
    const r = await runGetNotice(client, { bidNtceNo: "R1", bidKind: "cnstwk" });
    expect(client.call).toHaveBeenCalledTimes(1);
    expect(r.bidKind).toBe("cnstwk");
  });

  it("bidNtceOrd 포함 반환", async () => {
    const client = makeClient(
      async (): Promise<OperationResult> => ({
        totalCount: 1,
        pageNo: 1,
        items: [{ bidNtceNo: "R25", bidNtceOrd: "003", bidNtceNm: "공고" }],
      }),
    );
    const out = await runGetNotice(client, { bidNtceNo: "R25", bidKind: "thng" });
    expect(out.found).toBe(true);
    expect(out.notice?.bidNtceOrd).toBe("003");
  });

  it("한 kind 에러여도 다른 kind found면 found 우선", async () => {
    let n = 0;
    const client = makeClient(async (): Promise<OperationResult> => {
      n++;
      if (n === 1) throw new Error("일시오류");
      return { totalCount: 1, pageNo: 1, items: [{ bidNtceNo: "R25", bidNtceOrd: "1" }] };
    });
    const out = await runGetNotice(client, { bidNtceNo: "R25" }); // 전 kind
    expect(out.found).toBe(true);
  });

  it("사전인코딩 키 + HTTP 401이면 errors에 Decoding 힌트가 붙는다", async () => {
    const client = makeClient(async (): Promise<OperationResult> => {
      throw new Error("data.go.kr HTTP 401 오류 (operation=x)");
    }, true);
    const r = await runGetNotice(client, { bidNtceNo: "X" });
    expect(r.found).toBe(false);
    expect(r.errors.some((m) => m.includes("Decoding 인증키"))).toBe(true);
  });

  it("사전인코딩이 아니면 HTTP 401에도 힌트가 붙지 않는다", async () => {
    const client = makeClient(async (): Promise<OperationResult> => {
      throw new Error("data.go.kr HTTP 401 오류 (operation=x)");
    }, false);
    const r = await runGetNotice(client, { bidNtceNo: "X" });
    expect(r.found).toBe(false);
    expect(r.errors.some((m) => m.includes("Decoding 인증키"))).toBe(false);
  });
});
