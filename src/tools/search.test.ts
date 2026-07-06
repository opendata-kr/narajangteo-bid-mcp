import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config.js";
import type { OperationResult } from "../api/client.js";
import { runSearch } from "./search.js";

const config: AppConfig = {
  serviceKey: "k",
  baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
  looksPreEncoded: false,
};

function makeCall(
  perKind: Record<string, OperationResult | Error>,
): (
  cfg: AppConfig,
  op: string,
  params: Record<string, string | number | undefined>,
) => Promise<OperationResult> {
  return async (_cfg, op) => {
    // op 예: getBidPblancListInfoCnstwkPPSSrch
    const kind = Object.keys(perKind).find((k) =>
      op.includes(k.charAt(0).toUpperCase() + k.slice(1)),
    );
    const v = kind ? perKind[kind] : undefined;
    if (v instanceof Error) throw v;
    if (!v) return { totalCount: 0, pageNo: 1, items: [] };
    return v;
  };
}

describe("runSearch", () => {
  it("bidKind 미지정 시 4개 업무구분에 fan-out한다", async () => {
    const callFn = vi.fn(
      makeCall({
        cnstwk: { totalCount: 1, pageNo: 1, items: [{ bidNtceNo: "C1" }] },
        servc: { totalCount: 0, pageNo: 1, items: [] },
        thng: { totalCount: 0, pageNo: 1, items: [] },
        frgcpt: { totalCount: 0, pageNo: 1, items: [] },
      }),
    );
    const r = await runSearch(config, { keyword: "학교" }, { callFn });
    expect(callFn).toHaveBeenCalledTimes(4);
    const cnstwk = r.results.cnstwk!;
    expect("items" in cnstwk && cnstwk.items[0]!.bidNtceNo).toBe("C1");
  });

  it("bidKind 지정 시 해당 구분만 호출한다", async () => {
    const callFn = vi.fn(
      makeCall({
        servc: { totalCount: 2, pageNo: 1, items: [{ bidNtceNo: "S1" }] },
      }),
    );
    const r = await runSearch(config, { bidKind: ["servc"] }, { callFn });
    expect(callFn).toHaveBeenCalledTimes(1);
    expect(Object.keys(r.results)).toEqual(["servc"]);
  });

  it("startDate를 inqryDiv=1 + inqryBgnDt로 변환한다", async () => {
    const seen: Record<string, string | number | undefined>[] = [];
    const callFn = vi.fn(
      async (
        _c: AppConfig,
        _op: string,
        params: Record<string, string | number | undefined>,
      ) => {
        seen.push(params);
        return { totalCount: 0, pageNo: 1, items: [] } as OperationResult;
      },
    );
    await runSearch(
      config,
      { bidKind: ["thng"], startDate: "20250701", endDate: "20250705" },
      { callFn },
    );
    expect(seen[0]!.inqryDiv).toBe("1");
    expect(seen[0]!.inqryBgnDt).toBe("202507010000");
    expect(seen[0]!.inqryEndDt).toBe("202507052359");
  });

  it("한 업무구분 실패 시 나머지는 정상 반환한다", async () => {
    const callFn = vi.fn(
      makeCall({
        cnstwk: new Error("boom"),
        servc: { totalCount: 1, pageNo: 1, items: [{ bidNtceNo: "S1" }] },
        thng: { totalCount: 0, pageNo: 1, items: [] },
        frgcpt: { totalCount: 0, pageNo: 1, items: [] },
      }),
    );
    const r = await runSearch(config, {}, { callFn });
    expect("error" in r.results.cnstwk!).toBe(true);
    expect("items" in r.results.servc!).toBe(true);
  });
});
