import { describe, it, expect, vi } from "vitest";
import { runBasisAmount } from "./basisAmount.js";

describe("runBasisAmount", () => {
  it("kind 미지정 시 물품/공사/용역 병렬, inqryDiv=2+bidNtceNo", async () => {
    const calls: any[] = [];
    const client = { call: vi.fn(async (op, p) => { calls.push({ op, p }); return { totalCount: 1, items: [{ bidNtceNo: "R25", bidNtceOrd: "1", bssamt: "1000" }] }; }) } as any;
    const out = await runBasisAmount(client, { bidNtceNo: "R25" });
    expect(Object.keys(out.results)).toEqual(["thng", "cnstwk", "servc"]);
    expect(calls[0]!.p.inqryDiv).toBe("2");
    expect(calls[0]!.p.bidNtceNo).toBe("R25");
    expect(out.results.thng).toMatchObject({ status: "ok" });
  });

  it("kind 명시 시 해당 구분만 단일 조회", async () => {
    const calls: any[] = [];
    const client = { call: vi.fn(async (op, p) => { calls.push({ op, p }); return { totalCount: 1, items: [{ bidNtceNo: "R25", bidNtceOrd: "1", bssamt: "1000" }] }; }) } as any;
    const out = await runBasisAmount(client, { bidNtceNo: "R25", bidKind: "cnstwk" });
    expect(client.call).toHaveBeenCalledTimes(1);
    expect(calls[0]!.op).toBe("getBidPblancListInfoCnstwkBsisAmount");
    expect(Object.keys(out.results)).toEqual(["cnstwk"]);
  });
});
