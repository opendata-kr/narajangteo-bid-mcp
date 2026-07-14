import { describe, it, expect } from "vitest";
import { ITEM_OP } from "../api/endpoints.js";
import { makeTestClient, type OpStub } from "../test-helpers.js";
import { runItems } from "./items.js";

const THNG_OP = "getBidPblancListInfoThngPurchsObjPrdct";
const SERVC_OP = "getBidPblancListInfoServcPurchsObjPrdct";
const FRGCPT_OP = "getBidPblancListInfoFrgcptPurchsObjPrdct";

// 스텁이 op명을 prdctClsfcNoNm에 실어 반환 → results[kind]로 kind↔op 대응을 순서 무관하게 검증
function echoStub(op: string): OpStub {
  return { items: [{ bidNtceNo: "R25", bidNtceOrd: "3", prdctClsfcNoNm: op }], totalCount: 1 };
}

describe("runItems", () => {
  it("kind 미지정 시 물품/용역/외자 병렬, 각 op가 kind에 정확 대응, 공사(Cnstwk) 미호출", async () => {
    const { client, requests } = makeTestClient({
      [ITEM_OP.thng]: echoStub(THNG_OP),
      [ITEM_OP.servc]: echoStub(SERVC_OP),
      [ITEM_OP.frgcpt]: echoStub(FRGCPT_OP),
    });
    const out = await runItems(client, { bidNtceNo: "R25", bidNtceOrd: "003" });

    expect(Object.keys(out.results)).toEqual(["thng", "servc", "frgcpt"]);
    // 각 kind의 결과가 정확히 대응하는 op에서 왔는지 (op 뒤바뀜 방어)
    const item = (kind: "thng" | "servc" | "frgcpt") => {
      const r = out.results[kind]!;
      if (r.status !== "ok") throw new Error(r.error);
      return r.items[0]!;
    };
    expect(item("thng").prdctClsfcNoNm).toBe(THNG_OP);
    expect(item("servc").prdctClsfcNoNm).toBe(SERVC_OP);
    expect(item("frgcpt").prdctClsfcNoNm).toBe(FRGCPT_OP);
    // 공사(Cnstwk) op는 호출되지 않는다
    expect(requests.some((q) => q.op.includes("Cnstwk"))).toBe(false);
    expect(requests).toHaveLength(3);
  });

  it("모든 호출에 inqryDiv=2와 지정한 bidNtceOrd 전달", async () => {
    const { client, requests } = makeTestClient({});
    await runItems(client, { bidNtceNo: "R25", bidNtceOrd: "003" });

    expect(requests).toHaveLength(3);
    for (const q of requests) {
      expect(q.params.get("inqryDiv")).toBe("2");
      expect(q.params.get("bidNtceNo")).toBe("R25");
      expect(q.params.get("bidNtceOrd")).toBe("003");
    }
  });

  it("bidNtceOrd 미지정 시 기본 000", async () => {
    const { client, requests } = makeTestClient({});
    const out = await runItems(client, { bidNtceNo: "R25" });

    expect(out.bidNtceOrd).toBe("000");
    for (const q of requests) expect(q.params.get("bidNtceOrd")).toBe("000");
  });

  it("kind 명시 시 해당 구분만 단일 조회", async () => {
    const { client, requests } = makeTestClient({
      [ITEM_OP.thng]: { items: [{ bidNtceNo: "R25", bidNtceOrd: "3" }], totalCount: 1 },
    });
    const out = await runItems(client, { bidNtceNo: "R25", bidKind: "thng" });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.op).toBe(THNG_OP);
    expect(Object.keys(out.results)).toEqual(["thng"]);
  });
});
