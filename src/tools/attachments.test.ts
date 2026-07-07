import { describe, it, expect, vi } from "vitest";
import { runAttachments } from "./attachments.js";

const EORDER_OP = "getBidPblancListInfoEorderAtchFileInfo"; // I e발주
const RFP_OP = "getBidPblancListPPIFnlRfpIssAtchFileInfo"; // J 혁신장터RFP

describe("runAttachments", () => {
  it("e발주(inqryDiv2)·혁신장터RFP(inqryDiv3) 두 op를 라벨로 구분 반환", async () => {
    // mock이 op명을 표식(bidNtceNo=op)으로 반환 → 라벨↔op 대응 검증 가능.
    // formatAttachment가 bidNtceNo를 보존하므로 라벨이 뒤바뀌면 실패한다.
    const mockClient = {
      call: vi.fn(async (op: string) => ({
        totalCount: 1,
        items: [{ bidNtceNo: op, bidNtceOrd: "1" }],
      })),
    } as any;

    const out = await runAttachments(mockClient, { bidNtceNo: "R25" });

    expect(out.anySucceeded).toBe(true);

    // 두 라벨이 모두 results에 존재
    const labels = Object.keys(out.results).sort();
    expect(labels).toEqual(["eorder", "innovationRfp"]);

    // 라벨↔op 대응: eorder는 I op, innovationRfp는 J op에 붙는다.
    const eorder = out.results.eorder;
    const rfp = out.results.innovationRfp;
    expect(eorder).toHaveProperty("status", "ok");
    expect(rfp).toHaveProperty("status", "ok");
    if (eorder?.status === "ok") {
      expect(eorder.items).toHaveLength(1);
      expect(eorder.items[0]).toHaveProperty("bidNtceNo", EORDER_OP);
    }
    if (rfp?.status === "ok") {
      expect(rfp.items).toHaveLength(1);
      expect(rfp.items[0]).toHaveProperty("bidNtceNo", RFP_OP);
    }

    // 호출된 op가 ATTACH_OPS 순서(I, J)와 일치하고 inqryDiv는 op별로 2·3(J만 3)
    const calls = mockClient.call.mock.calls;
    expect(calls).toHaveLength(2);
    const eorderCall = calls.find((c: any[]) => c[0] === EORDER_OP);
    const rfpCall = calls.find((c: any[]) => c[0] === RFP_OP);
    expect(eorderCall![1]).toMatchObject({ inqryDiv: "2", bidNtceNo: "R25" });
    expect(rfpCall![1]).toMatchObject({ inqryDiv: "3", bidNtceNo: "R25" });
  });
});
