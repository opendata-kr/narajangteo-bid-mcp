import { describe, expect, it, vi } from "vitest";
import type { DataGoKrClient, OperationResult, Params } from "@opendata-kr/core";
import { runSearch } from "./search.js";

function makeClient(
  perKind: Record<string, OperationResult | Error>,
): DataGoKrClient {
  return {
    serviceKeyLooksPreEncoded: false,
    call: vi.fn(async (op: string, _params?: Params): Promise<OperationResult> => {
      // op 예: getBidPblancListInfoCnstwkPPSSrch
      const kind = Object.keys(perKind).find((k) =>
        op.includes(k.charAt(0).toUpperCase() + k.slice(1)),
      );
      const v = kind ? perKind[kind] : undefined;
      if (v instanceof Error) throw v;
      if (!v) return { totalCount: 0, pageNo: 1, items: [] };
      return v;
    }),
  };
}

describe("runSearch", () => {
  it("bidKind 미지정 시 4개 업무구분에 fan-out한다", async () => {
    const client = makeClient({
      cnstwk: { totalCount: 1, pageNo: 1, items: [{ bidNtceNo: "C1" }] },
      servc: { totalCount: 0, pageNo: 1, items: [] },
      thng: { totalCount: 0, pageNo: 1, items: [] },
      frgcpt: { totalCount: 0, pageNo: 1, items: [] },
    });
    const r = await runSearch(client, { keyword: "학교" });
    expect(client.call).toHaveBeenCalledTimes(4);
    const cnstwk = r.results.cnstwk!;
    expect("items" in cnstwk && cnstwk.items[0]!.bidNtceNo).toBe("C1");
  });

  it("bidKind 지정 시 해당 구분만 호출한다", async () => {
    const client = makeClient({
      servc: { totalCount: 2, pageNo: 1, items: [{ bidNtceNo: "S1" }] },
    });
    const r = await runSearch(client, { bidKind: ["servc"] });
    expect(client.call).toHaveBeenCalledTimes(1);
    expect(Object.keys(r.results)).toEqual(["servc"]);
  });

  it("startDate를 inqryDiv=1 + inqryBgnDt로 변환한다", async () => {
    const client: DataGoKrClient = {
      serviceKeyLooksPreEncoded: false,
      call: vi.fn(
        async (_op: string, _params?: Params): Promise<OperationResult> => ({
          totalCount: 0,
          pageNo: 1,
          items: [],
        }),
      ),
    };
    await runSearch(client, {
      bidKind: ["thng"],
      startDate: "20250701",
      endDate: "20250705",
    });
    const seen = (client.call as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Params;
    expect(seen.inqryDiv).toBe("1");
    expect(seen.inqryBgnDt).toBe("202507010000");
    expect(seen.inqryEndDt).toBe("202507052359");
  });

  it("한 업무구분 실패 시 나머지는 정상 반환한다", async () => {
    const client = makeClient({
      cnstwk: new Error("boom"),
      servc: { totalCount: 1, pageNo: 1, items: [{ bidNtceNo: "S1" }] },
      thng: { totalCount: 0, pageNo: 1, items: [] },
      frgcpt: { totalCount: 0, pageNo: 1, items: [] },
    });
    const r = await runSearch(client, {});
    expect("error" in r.results.cnstwk!).toBe(true);
    expect("items" in r.results.servc!).toBe(true);
  });
});
