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

  it("날짜 미지정이어도 inqryDiv=1 + 기본 윈도우 전송", async () => {
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
    await runSearch(client, { keyword: "관로", bidKind: ["thng"] });
    const seen = (client.call as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Params;
    expect(seen.inqryDiv).toBe("1");
    expect(seen.inqryBgnDt).toMatch(/^\d{12}$/);
    expect(seen.inqryEndDt).toMatch(/^\d{12}$/);
  });

  it("etc는 기본 집합에서 제외, 명시 지정 시에만 호출", async () => {
    const client = makeClient({
      cnstwk: { totalCount: 0, pageNo: 1, items: [] },
      servc: { totalCount: 0, pageNo: 1, items: [] },
      thng: { totalCount: 0, pageNo: 1, items: [] },
      frgcpt: { totalCount: 0, pageNo: 1, items: [] },
    });
    const r = await runSearch(client, {});
    expect(Object.keys(r.results)).not.toContain("etc");
    expect(client.call).toHaveBeenCalledTimes(4);
  });

  it("etc는 명시 지정 시에만 호출한다", async () => {
    const client = makeClient({
      etc: { totalCount: 1, pageNo: 1, items: [{ bidNtceNo: "E1" }] },
    });
    const r = await runSearch(client, { bidKind: ["etc"] });
    expect(Object.keys(r.results)).toContain("etc");
    expect(client.call).toHaveBeenCalledTimes(1);
  });

  it("demandInstitution은 dminsttNm으로 전송", async () => {
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
    await runSearch(client, { demandInstitution: "조달청", bidKind: ["thng"] });
    const seen = (client.call as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Params;
    expect(seen.dminsttNm).toBe("조달청");
  });

  it("endDate만 지정 시 윈도우가 역전되지 않는다", async () => {
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
    await runSearch(client, { endDate: "20260601", bidKind: ["thng"] });
    const seen = (client.call as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Params;
    expect(seen.inqryEndDt).toBe("202606012359");
    expect(String(seen.inqryBgnDt) < String(seen.inqryEndDt)).toBe(true);
  });

  it("startDate만 지정 시 윈도우가 역전되지 않는다", async () => {
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
    await runSearch(client, { startDate: "20260601", bidKind: ["thng"] });
    const seen = (client.call as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Params;
    expect(seen.inqryBgnDt).toBe("202606010000");
    expect(String(seen.inqryEndDt) > String(seen.inqryBgnDt)).toBe(true);
    expect(seen.inqryEndDt).toBe("202607010000".slice(0, 8) + "2359");
  });

  it("잘못된 날짜 포맷은 에러", async () => {
    const client = makeClient({});
    await expect(
      runSearch(client, { startDate: "2026-07-01", bidKind: ["thng"] }),
    ).rejects.toThrow(/YYYYMMDD/);
  });

  it("endDate 잘못된 포맷도 에러", async () => {
    const client = makeClient({});
    await expect(
      runSearch(client, { endDate: "2026/07/01", bidKind: ["thng"] }),
    ).rejects.toThrow(/YYYYMMDD/);
  });

  it("조회창이 31일을 초과하면 에러", async () => {
    const client = makeClient({});
    await expect(
      runSearch(client, {
        startDate: "20260401",
        endDate: "20260607",
        bidKind: ["thng"],
      }),
    ).rejects.toThrow(/1개월|31일/);
    expect(client.call).not.toHaveBeenCalled();
  });

  it("조회창이 31일이면 정상 호출된다", async () => {
    const client = makeClient({});
    await expect(
      runSearch(client, {
        startDate: "20260507",
        endDate: "20260607",
        bidKind: ["thng"],
      }),
    ).resolves.toBeDefined();
    expect(client.call).toHaveBeenCalledTimes(1);
  });

  it("startDate가 endDate보다 뒤면 에러", async () => {
    const client = makeClient({});
    await expect(
      runSearch(client, {
        startDate: "20260607",
        endDate: "20260601",
        bidKind: ["thng"],
      }),
    ).rejects.toThrow(/순서|뒤/);
    expect(client.call).not.toHaveBeenCalled();
  });
});
