import { describe, it, expect, vi } from "vitest";
import { runItems } from "./items.js";

const THNG_OP = "getBidPblancListInfoThngPurchsObjPrdct";
const SERVC_OP = "getBidPblancListInfoServcPurchsObjPrdct";
const FRGCPT_OP = "getBidPblancListInfoFrgcptPurchsObjPrdct";

describe("runItems", () => {
  it("kind 미지정 시 물품/용역/외자 병렬, 각 op가 kind에 정확 대응, 공사(Cnstwk) 미호출", async () => {
    const calls: any[] = [];
    // mock이 호출된 op를 prdctClsfcNoNm에 실어 반환 → results[kind]로 kind↔op 대응을 순서 무관하게 검증
    const client = { call: vi.fn(async (op, p) => { calls.push({ op, p }); return { totalCount: 1, items: [{ bidNtceNo: "R25", bidNtceOrd: "3", prdctClsfcNoNm: op }] }; }) } as any;
    const out = await runItems(client, { bidNtceNo: "R25", bidNtceOrd: "003" });

    expect(Object.keys(out.results)).toEqual(["thng", "servc", "frgcpt"]);
    // 각 kind의 결과가 정확히 대응하는 op에서 왔는지 (op 뒤바뀜 방어)
    expect((out.results.thng as any).items[0].prdctClsfcNoNm).toBe(THNG_OP);
    expect((out.results.servc as any).items[0].prdctClsfcNoNm).toBe(SERVC_OP);
    expect((out.results.frgcpt as any).items[0].prdctClsfcNoNm).toBe(FRGCPT_OP);
    // 공사(Cnstwk) op는 호출되지 않는다
    expect(calls.some((c) => c.op.includes("Cnstwk"))).toBe(false);
    expect(calls).toHaveLength(3);
  });

  it("모든 호출에 inqryDiv=2와 지정한 bidNtceOrd 전달", async () => {
    const calls: any[] = [];
    const client = { call: vi.fn(async (op, p) => { calls.push({ op, p }); return { totalCount: 0, items: [] }; }) } as any;
    await runItems(client, { bidNtceNo: "R25", bidNtceOrd: "003" });

    expect(calls).toHaveLength(3);
    calls.forEach((c) => {
      expect(c.p.inqryDiv).toBe("2");
      expect(c.p.bidNtceNo).toBe("R25");
      expect(c.p.bidNtceOrd).toBe("003");
    });
  });

  it("bidNtceOrd 미지정 시 기본 000", async () => {
    const calls: any[] = [];
    const client = { call: vi.fn(async (op, p) => { calls.push({ op, p }); return { totalCount: 0, items: [] }; }) } as any;
    const out = await runItems(client, { bidNtceNo: "R25" });

    expect(out.bidNtceOrd).toBe("000");
    calls.forEach((c) => expect(c.p.bidNtceOrd).toBe("000"));
  });

  it("kind 명시 시 해당 구분만 단일 조회", async () => {
    const calls: any[] = [];
    const client = { call: vi.fn(async (op, p) => { calls.push({ op, p }); return { totalCount: 1, items: [{ bidNtceNo: "R25", bidNtceOrd: "3" }] }; }) } as any;
    const out = await runItems(client, { bidNtceNo: "R25", bidKind: "thng" });

    expect(client.call).toHaveBeenCalledTimes(1);
    expect(calls[0]!.op).toBe(THNG_OP);
    expect(Object.keys(out.results)).toEqual(["thng"]);
  });
});
