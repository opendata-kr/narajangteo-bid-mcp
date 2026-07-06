import { describe, expect, it, vi } from "vitest";
import type { DataGoKrClient, OperationResult, Params } from "@opendata-kr/core";
import { runGetNotice } from "./getNotice.js";

function makeClient(
  callImpl: (op: string, params?: Params) => Promise<OperationResult>,
): DataGoKrClient {
  return { serviceKeyLooksPreEncoded: false, call: vi.fn(callImpl) };
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

  it("모든 구분이 실패하면 found:false로 감추지 않고 오류를 던진다", async () => {
    const client = makeClient(async (): Promise<OperationResult> => {
      throw new Error("[30] 등록되지 않은 서비스키입니다.");
    });
    await expect(
      runGetNotice(client, { bidNtceNo: "X" }),
    ).rejects.toThrow(/등록되지 않은 서비스키/);
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
});
