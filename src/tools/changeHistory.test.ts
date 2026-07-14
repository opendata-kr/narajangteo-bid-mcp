import { describe, it, expect } from "vitest";
import { CHANGE_OP } from "../api/endpoints.js";
import { makeTestClient, type OpStub } from "../test-helpers.js";
import { runChangeHistory } from "./changeHistory.js";

// 스텁이 op명을 chgItemNm에 실어 반환 → results[kind]로 kind↔op 대응을 순서 무관하게 검증
function echoStub(op: string): OpStub {
  return { items: [{ bidNtceNo: "R25", bidNtceOrd: "1", chgItemNm: op }], totalCount: 1 };
}

describe("runChangeHistory", () => {
  it("kind 미지정 시 물품/공사/용역 병렬, 각 op가 kind에 정확 대응, inqryDiv=2+bidNtceNo", async () => {
    const { client, requests } = makeTestClient({
      [CHANGE_OP.thng]: echoStub(CHANGE_OP.thng),
      [CHANGE_OP.cnstwk]: echoStub(CHANGE_OP.cnstwk),
      [CHANGE_OP.servc]: echoStub(CHANGE_OP.servc),
    });
    const out = await runChangeHistory(client, { bidNtceNo: "R25" });
    expect(Object.keys(out.results)).toEqual(["thng", "cnstwk", "servc"]);
    // 각 kind의 결과가 정확히 대응하는 op에서 왔는지 (op 뒤바뀜 방어)
    const item = (kind: "thng" | "cnstwk" | "servc") => {
      const r = out.results[kind]!;
      if (r.status !== "ok") throw new Error(r.error);
      return r.items[0]!;
    };
    expect(item("thng").chgItemNm).toBe("getBidPblancListInfoChgHstryThng");
    expect(item("cnstwk").chgItemNm).toBe("getBidPblancListInfoChgHstryCnstwk");
    expect(item("servc").chgItemNm).toBe("getBidPblancListInfoChgHstryServc");
    // 모든 호출에 inqryDiv=2와 bidNtceNo 전달
    expect(requests).toHaveLength(3);
    for (const q of requests) {
      expect(q.params.get("inqryDiv")).toBe("2");
      expect(q.params.get("bidNtceNo")).toBe("R25");
    }
    expect(out.results.thng).toMatchObject({ status: "ok" });
  });

  it("kind 명시 시 해당 구분만 단일 조회", async () => {
    const { client, requests } = makeTestClient({
      [CHANGE_OP.cnstwk]: { items: [{ bidNtceNo: "R25", bidNtceOrd: "1", chgDt: "20250601" }], totalCount: 1 },
    });
    const out = await runChangeHistory(client, { bidNtceNo: "R25", bidKind: "cnstwk" });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.op).toBe("getBidPblancListInfoChgHstryCnstwk");
    expect(Object.keys(out.results)).toEqual(["cnstwk"]);
  });
});
