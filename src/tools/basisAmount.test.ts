import { describe, it, expect } from "vitest";
import { BASIS_OP } from "../api/endpoints.js";
import { makeTestClient, type OpStub } from "../test-helpers.js";
import { runBasisAmount } from "./basisAmount.js";

const stub: OpStub = { items: [{ bidNtceNo: "R25", bidNtceOrd: "1", bssamt: "1000" }], totalCount: 1 };

describe("runBasisAmount", () => {
  it("kind 미지정 시 물품/공사/용역 병렬, inqryDiv=2+bidNtceNo", async () => {
    const { client, requests } = makeTestClient({
      [BASIS_OP.thng]: stub, [BASIS_OP.cnstwk]: stub, [BASIS_OP.servc]: stub,
    });
    const out = await runBasisAmount(client, { bidNtceNo: "R25" });
    expect(Object.keys(out.results)).toEqual(["thng", "cnstwk", "servc"]);
    expect(requests[0]!.params.get("inqryDiv")).toBe("2");
    expect(requests[0]!.params.get("bidNtceNo")).toBe("R25");
    expect(out.results.thng).toMatchObject({ status: "ok", invalidCount: 0 });
  });

  it("kind 명시 시 해당 구분만 단일 조회", async () => {
    const { client, requests } = makeTestClient({ [BASIS_OP.cnstwk]: stub });
    const out = await runBasisAmount(client, { bidNtceNo: "R25", bidKind: "cnstwk" });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.op).toBe("getBidPblancListInfoCnstwkBsisAmount");
    expect(Object.keys(out.results)).toEqual(["cnstwk"]);
  });
});
