import { describe, it, expect, vi } from "vitest";
import { runChangeHistory } from "./changeHistory.js";

describe("runChangeHistory", () => {
  it("kind 미지정 시 물품/공사/용역 병렬, 각 op가 kind에 정확 대응, inqryDiv=2+bidNtceNo", async () => {
    const calls: any[] = [];
    // mock이 호출된 op를 chgItemNm에 실어 반환 → results[kind]로 kind↔op 대응을 순서 무관하게 검증
    const client = { call: vi.fn(async (op, p) => { calls.push({ op, p }); return { totalCount: 1, items: [{ bidNtceNo: "R25", bidNtceOrd: "1", chgItemNm: op }] }; }) } as any;
    const out = await runChangeHistory(client, { bidNtceNo: "R25" });
    expect(Object.keys(out.results)).toEqual(["thng", "cnstwk", "servc"]);
    // 각 kind의 결과가 정확히 대응하는 op에서 왔는지 (op 뒤바뀜 방어)
    expect((out.results.thng as any).items[0].chgItemNm).toBe("getBidPblancListInfoChgHstryThng");
    expect((out.results.cnstwk as any).items[0].chgItemNm).toBe("getBidPblancListInfoChgHstryCnstwk");
    expect((out.results.servc as any).items[0].chgItemNm).toBe("getBidPblancListInfoChgHstryServc");
    // 모든 호출에 inqryDiv=2와 bidNtceNo 전달
    expect(calls).toHaveLength(3);
    calls.forEach((c) => {
      expect(c.p.inqryDiv).toBe("2");
      expect(c.p.bidNtceNo).toBe("R25");
    });
    expect(out.results.thng).toMatchObject({ status: "ok" });
  });

  it("kind 명시 시 해당 구분만 단일 조회", async () => {
    const calls: any[] = [];
    const client = { call: vi.fn(async (op, p) => { calls.push({ op, p }); return { totalCount: 1, items: [{ bidNtceNo: "R25", bidNtceOrd: "1", chgDt: "20250601" }] }; }) } as any;
    const out = await runChangeHistory(client, { bidNtceNo: "R25", bidKind: "cnstwk" });
    expect(client.call).toHaveBeenCalledTimes(1);
    expect(calls[0]!.op).toBe("getBidPblancListInfoChgHstryCnstwk");
    expect(Object.keys(out.results)).toEqual(["cnstwk"]);
  });
});
