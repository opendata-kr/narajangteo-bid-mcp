import { describe, it, expect } from "vitest";
import { makeTestClient } from "../test-helpers.js";
import { runEvaluation } from "./evaluation.js";

const PRICE_FORMULA_OP = "getBidPblancListBidPrceCalclAInfo"; // C 산식A
const TARGET_FIELD_OP = "getBidPblancListEvaluationIndstrytyMfrcInfo"; // G 평가주력분야

describe("runEvaluation", () => {
  it("산식A·평가주력분야 두 op를 라벨로 구분 반환", async () => {
    // 스텁이 op별로 다른 표식(bidNtceNo=op명)을 반환 → 라벨↔op 대응 검증 가능
    const { client, requests } = makeTestClient({
      [PRICE_FORMULA_OP]: { items: [{ bidNtceNo: PRICE_FORMULA_OP, bidNtceOrd: "1" }], totalCount: 1 },
      [TARGET_FIELD_OP]: { items: [{ bidNtceNo: TARGET_FIELD_OP, bidNtceOrd: "1" }], totalCount: 1 },
    });

    const out = await runEvaluation(client, { bidNtceNo: "R25" });

    // 두 라벨이 모두 results에 존재
    const labels = Object.keys(out.results).sort();
    expect(labels).toEqual(["priceFormula", "targetField"]);

    // 라벨↔op 대응: priceFormula는 산식A op, targetField는 평가주력분야 op에 붙는다.
    const priceFormula = out.results.priceFormula;
    const targetField = out.results.targetField;
    expect(priceFormula).toHaveProperty("status", "ok");
    expect(targetField).toHaveProperty("status", "ok");
    if (priceFormula.status === "ok") {
      expect(priceFormula.items).toHaveLength(1);
      expect(priceFormula.items[0]).toHaveProperty("bidNtceNo", PRICE_FORMULA_OP);
    }
    if (targetField.status === "ok") {
      expect(targetField.items).toHaveLength(1);
      expect(targetField.items[0]).toHaveProperty("bidNtceNo", TARGET_FIELD_OP);
    }

    // 호출된 op가 EVAL_OPS와 일치하고 각각 inqryDiv="2"·bidNtceNo 전달
    expect(requests).toHaveLength(2);
    expect(requests.map((q) => q.op).sort()).toEqual([PRICE_FORMULA_OP, TARGET_FIELD_OP].sort());
    for (const q of requests) {
      expect(q.params.get("inqryDiv")).toBe("2");
      expect(q.params.get("bidNtceNo")).toBe("R25");
    }
  });
});
