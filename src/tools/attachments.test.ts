import { describe, it, expect, vi } from "vitest";
import { runAttachments } from "./attachments.js";

const EORDER_OP = "getBidPblancListInfoEorderAtchFileInfo"; // I e발주
const RFP_OP = "getBidPblancListPPIFnlRfpIssAtchFileInfo"; // J 혁신장터RFP
const SERVC_OP = "getBidPblancListInfoServc"; // 용역 목록(규격첨부 소스)

describe("runAttachments", () => {
  it("공고 규격첨부(notice)·e발주·혁신장터RFP 세 소스를 라벨로 구분 반환", async () => {
    // mock이 op명을 표식(bidNtceNo=op)으로 반환 → 라벨↔op 대응 검증 가능.
    // 목록 op는 규격첨부 없는 item을 줘 notice 소스가 0건이 되게 한다.
    const mockClient = {
      call: vi.fn(async (op: string) => {
        if (op === EORDER_OP || op === RFP_OP) {
          return { totalCount: 1, items: [{ bidNtceNo: op, bidNtceOrd: "1" }] };
        }
        return { totalCount: 0, items: [] }; // 목록 op: 공고 미발견
      }),
    } as any;

    const out = await runAttachments(mockClient, { bidNtceNo: "R25" });

    expect(out.anySucceeded).toBe(true);

    // 세 라벨이 모두 results에 존재
    const labels = Object.keys(out.results).sort();
    expect(labels).toEqual(["eorder", "innovationRfp", "notice"]);

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

    // 첨부 op는 inqryDiv 2·3(J만 3), 목록 op(kind fanOut)는 inqryDiv 2로 호출된다.
    const calls = mockClient.call.mock.calls;
    const eorderCall = calls.find((c: any[]) => c[0] === EORDER_OP);
    const rfpCall = calls.find((c: any[]) => c[0] === RFP_OP);
    expect(eorderCall![1]).toMatchObject({ inqryDiv: "2", bidNtceNo: "R25" });
    expect(rfpCall![1]).toMatchObject({ inqryDiv: "3", bidNtceNo: "R25" });
  });

  it("공고 규격첨부(ntceSpecDocUrl1~10)를 notice 소스로 정규화한다", async () => {
    // 용역 목록 op가 규격첨부 2쌍을 가진 공고를 반환 → notice 소스에 2건.
    const mockClient = {
      call: vi.fn(async (op: string) => {
        if (op === SERVC_OP) {
          return {
            totalCount: 1,
            items: [{
              bidNtceNo: "R26", bidNtceOrd: "000",
              ntceSpecFileNm1: "입찰공고문.hwp", ntceSpecDocUrl1: "https://g2b/f1",
              ntceSpecFileNm2: "제안요청서.hwp", ntceSpecDocUrl2: "https://g2b/f2",
            }],
          };
        }
        return { totalCount: 0, items: [] }; // 다른 kind·첨부 op는 0건
      }),
    } as any;

    const out = await runAttachments(mockClient, { bidNtceNo: "R26" });

    const notice = out.results.notice;
    expect(notice).toHaveProperty("status", "ok");
    if (notice?.status === "ok") {
      expect(notice.items).toHaveLength(2);
      expect(notice.items[0]).toMatchObject({ fileNm: "입찰공고문.hwp", fileUrl: "https://g2b/f1" });
      expect(notice.items[1]).toMatchObject({ fileNm: "제안요청서.hwp", fileUrl: "https://g2b/f2" });
    }
  });
});
