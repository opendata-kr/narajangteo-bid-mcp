import { describe, it, expect, vi } from "vitest";
import { runEvaluation } from "./evaluation.js";

const PRICE_FORMULA_OP = "getBidPblancListBidPrceCalclAInfo"; // C 산식A
const TARGET_FIELD_OP = "getBidPblancListEvaluationIndstrytyMfrcInfo"; // G 평가주력분야

describe("runEvaluation", () => {
  it("산식A·평가주력분야 두 op를 라벨로 구분 반환", async () => {
    // mock이 op별로 다른 표식(bidNtceNo=op명)을 반환 → 라벨↔op 대응 검증 가능
    const mockClient = {
      call: vi.fn(async (op: string) => ({
        totalCount: 1,
        items: [{ bidNtceNo: op, bidNtceOrd: "1" }],
      })),
    } as any;

    const out = await runEvaluation(mockClient, { bidNtceNo: "R25" });

    // 두 라벨이 모두 results에 존재
    const labels = Object.keys(out.results).sort();
    expect(labels).toEqual(["priceFormula", "targetField"]);

    // 각 라벨이 성공 응답을 포함
    const priceFormula = out.results.priceFormula;
    const targetField = out.results.targetField;
    expect(priceFormula).toHaveProperty("status", "ok");
    expect(targetField).toHaveProperty("status", "ok");

    // 라벨↔op 대응: priceFormula는 산식A op, targetField는 평가주력분야 op에 붙는다.
    // mock이 op명을 표식으로 반환하므로 라벨이 뒤바뀌면 실패한다.
    if (priceFormula?.status === "ok") {
      expect(priceFormula.items).toHaveLength(1);
      expect(priceFormula.items[0]).toHaveProperty("bidNtceNo", PRICE_FORMULA_OP);
    }
    if (targetField?.status === "ok") {
      expect(targetField.items).toHaveLength(1);
      expect(targetField.items[0]).toHaveProperty("bidNtceNo", TARGET_FIELD_OP);
    }

    // 호출된 op가 EVAL_OPS 순서(C, G)와 일치하고 각각 inqryDiv="2"·bidNtceNo 전달
    const calls = mockClient.call.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(PRICE_FORMULA_OP);
    expect(calls[1][0]).toBe(TARGET_FIELD_OP);
    expect(calls[0][1]).toMatchObject({ inqryDiv: "2", bidNtceNo: "R25" });
    expect(calls[1][1]).toMatchObject({ inqryDiv: "2", bidNtceNo: "R25" });
  });
});
