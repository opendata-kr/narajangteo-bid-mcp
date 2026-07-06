import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config.js";
import type { OperationResult } from "../api/client.js";
import { runGetNotice } from "./getNotice.js";

const config: AppConfig = {
  serviceKey: "k",
  baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
  looksPreEncoded: false,
};

describe("runGetNotice", () => {
  it("bidKind 미지정 시 매칭되는 구분의 공고를 반환한다", async () => {
    const callFn = vi.fn(
      async (
        _c: AppConfig,
        op: string,
      ): Promise<OperationResult> => {
        if (op === "getBidPblancListInfoThng") {
          return {
            totalCount: 1,
            pageNo: 1,
            items: [{ bidNtceNo: "R25BK0001", bidNtceNm: "물품공고" }],
          };
        }
        return { totalCount: 0, pageNo: 1, items: [] };
      },
    );
    const r = await runGetNotice(
      config,
      { bidNtceNo: "R25BK0001" },
      { callFn },
    );
    expect(r.found).toBe(true);
    expect(r.bidKind).toBe("thng");
    expect(r.notice?.bidNtceNm).toBe("물품공고");
  });

  it("어디에도 없으면 found=false", async () => {
    const callFn = vi.fn(
      async (): Promise<OperationResult> => ({
        totalCount: 0,
        pageNo: 1,
        items: [],
      }),
    );
    const r = await runGetNotice(config, { bidNtceNo: "X" }, { callFn });
    expect(r.found).toBe(false);
    expect(r.searchedKinds).toHaveLength(4);
  });

  it("bidKind 지정 시 해당 구분만 조회한다", async () => {
    const callFn = vi.fn(
      async (): Promise<OperationResult> => ({
        totalCount: 1,
        pageNo: 1,
        items: [{ bidNtceNo: "R1" }],
      }),
    );
    const r = await runGetNotice(
      config,
      { bidNtceNo: "R1", bidKind: "cnstwk" },
      { callFn },
    );
    expect(callFn).toHaveBeenCalledTimes(1);
    expect(r.bidKind).toBe("cnstwk");
  });
});
