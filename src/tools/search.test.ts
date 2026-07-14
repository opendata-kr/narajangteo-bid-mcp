import { describe, expect, it } from "vitest";
import { searchOperation, type BidKind } from "../api/endpoints.js";
import { makeTestClient, type OpStub } from "../test-helpers.js";
import { runSearch } from "./search.js";

// kind 키 스텁을 PPSSrch 오퍼레이션명 키로 펼친다.
function makeClient(perKind: Partial<Record<BidKind, OpStub>>) {
  const perOp: Record<string, OpStub> = {};
  for (const [kind, stub] of Object.entries(perKind)) {
    perOp[searchOperation(kind as BidKind)] = stub;
  }
  return makeTestClient(perOp);
}

describe("runSearch", () => {
  it("bidKind 미지정 시 4개 업무구분에 fan-out한다", async () => {
    const { client, requests } = makeClient({
      cnstwk: { items: [{ bidNtceNo: "C1" }], totalCount: 1 },
    });
    const r = await runSearch(client, { keyword: "학교" });
    expect(requests).toHaveLength(4);
    const cnstwk = r.results.cnstwk!;
    expect("items" in cnstwk && cnstwk.items[0]!.bidNtceNo).toBe("C1");
  });

  it("bidKind 지정 시 해당 구분만 호출한다", async () => {
    const { client, requests } = makeClient({
      servc: { items: [{ bidNtceNo: "S1" }], totalCount: 2 },
    });
    const r = await runSearch(client, { bidKind: ["servc"] });
    expect(requests).toHaveLength(1);
    expect(Object.keys(r.results)).toEqual(["servc"]);
  });

  it("startDate를 inqryDiv=1 + inqryBgnDt로 변환한다", async () => {
    const { client, requests } = makeClient({});
    await runSearch(client, {
      bidKind: ["thng"],
      startDate: "20250701",
      endDate: "20250705",
    });
    const seen = requests[0]!.params;
    expect(seen.get("inqryDiv")).toBe("1");
    expect(seen.get("inqryBgnDt")).toBe("202507010000");
    expect(seen.get("inqryEndDt")).toBe("202507052359");
  });

  it("한 업무구분 실패 시 나머지는 정상 반환한다", async () => {
    const { client } = makeClient({
      cnstwk: { errorCode: "99", errorMsg: "boom" },
      servc: { items: [{ bidNtceNo: "S1" }], totalCount: 1 },
    });
    const r = await runSearch(client, {});
    expect("error" in r.results.cnstwk!).toBe(true);
    expect("items" in r.results.servc!).toBe(true);
  });

  it("날짜 미지정이어도 inqryDiv=1 + 기본 윈도우 전송", async () => {
    const { client, requests } = makeClient({});
    await runSearch(client, { keyword: "관로", bidKind: ["thng"] });
    const seen = requests[0]!.params;
    expect(seen.get("inqryDiv")).toBe("1");
    expect(seen.get("inqryBgnDt")).toMatch(/^\d{12}$/);
    expect(seen.get("inqryEndDt")).toMatch(/^\d{12}$/);
  });

  it("etc는 기본 집합에서 제외, 명시 지정 시에만 호출", async () => {
    const { client, requests } = makeClient({});
    const r = await runSearch(client, {});
    expect(Object.keys(r.results)).not.toContain("etc");
    expect(requests).toHaveLength(4);
  });

  it("etc는 명시 지정 시에만 호출한다", async () => {
    const { client, requests } = makeClient({
      etc: { items: [{ bidNtceNo: "E1" }], totalCount: 1 },
    });
    const r = await runSearch(client, { bidKind: ["etc"] });
    expect(Object.keys(r.results)).toContain("etc");
    expect(requests).toHaveLength(1);
  });

  it("demandInstitution은 dminsttNm으로 전송", async () => {
    const { client, requests } = makeClient({});
    await runSearch(client, { demandInstitution: "조달청", bidKind: ["thng"] });
    expect(requests[0]!.params.get("dminsttNm")).toBe("조달청");
  });

  it("endDate만 지정 시 윈도우가 역전되지 않는다", async () => {
    const { client, requests } = makeClient({});
    await runSearch(client, { endDate: "20260601", bidKind: ["thng"] });
    const seen = requests[0]!.params;
    expect(seen.get("inqryEndDt")).toBe("202606012359");
    expect(String(seen.get("inqryBgnDt")) < String(seen.get("inqryEndDt"))).toBe(true);
  });

  it("startDate만 지정 시 윈도우가 역전되지 않는다", async () => {
    const { client, requests } = makeClient({});
    await runSearch(client, { startDate: "20260601", bidKind: ["thng"] });
    const seen = requests[0]!.params;
    expect(seen.get("inqryBgnDt")).toBe("202606010000");
    expect(String(seen.get("inqryEndDt")) > String(seen.get("inqryBgnDt"))).toBe(true);
    expect(seen.get("inqryEndDt")).toBe("202607012359");
  });

  it("잘못된 날짜 포맷은 에러", async () => {
    const { client } = makeClient({});
    await expect(
      runSearch(client, { startDate: "2026-07-01", bidKind: ["thng"] }),
    ).rejects.toThrow(/YYYYMMDD/);
  });

  it("endDate 잘못된 포맷도 에러", async () => {
    const { client } = makeClient({});
    await expect(
      runSearch(client, { endDate: "2026/07/01", bidKind: ["thng"] }),
    ).rejects.toThrow(/YYYYMMDD/);
  });

  it("조회창이 31일을 초과하면 에러", async () => {
    const { client, requests } = makeClient({});
    await expect(
      runSearch(client, {
        startDate: "20260401",
        endDate: "20260607",
        bidKind: ["thng"],
      }),
    ).rejects.toThrow(/1개월|31일/);
    expect(requests).toHaveLength(0);
  });

  it("조회창이 31일이면 정상 호출된다", async () => {
    const { client, requests } = makeClient({});
    await expect(
      runSearch(client, {
        startDate: "20260507",
        endDate: "20260607",
        bidKind: ["thng"],
      }),
    ).resolves.toBeDefined();
    expect(requests).toHaveLength(1);
  });

  it("startDate가 endDate보다 뒤면 에러", async () => {
    const { client, requests } = makeClient({});
    await expect(
      runSearch(client, {
        startDate: "20260607",
        endDate: "20260601",
        bidKind: ["thng"],
      }),
    ).rejects.toThrow(/순서|뒤/);
    expect(requests).toHaveLength(0);
  });
});
