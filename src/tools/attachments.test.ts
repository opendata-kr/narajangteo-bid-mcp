import { describe, it, expect } from "vitest";
import { makeTestClient } from "../test-helpers.js";
import { runAttachments } from "./attachments.js";

const EORDER_OP = "getBidPblancListInfoEorderAtchFileInfo"; // I e발주
const RFP_OP = "getBidPblancListPPIFnlRfpIssAtchFileInfo"; // J 혁신장터RFP
const SERVC_OP = "getBidPblancListInfoServc"; // 용역 목록(규격첨부 소스)

describe("runAttachments", () => {
  it("공고 규격첨부(notice)·e발주·혁신장터RFP 세 소스를 라벨로 구분 반환", async () => {
    // 스텁이 op명을 표식(bidNtceNo=op)으로 반환 → 라벨↔op 대응 검증 가능.
    // 목록 op는 0건이라 notice 소스가 공고 미발견(0건 성공)이 된다.
    const { client, requests } = makeTestClient({
      [EORDER_OP]: { items: [{ bidNtceNo: EORDER_OP, bidNtceOrd: "1" }], totalCount: 1 },
      [RFP_OP]: { items: [{ bidNtceNo: RFP_OP, bidNtceOrd: "1" }], totalCount: 1 },
    });

    const out = await runAttachments(client, { bidNtceNo: "R25" });

    expect(out.anySucceeded).toBe(true);

    // 세 라벨이 모두 results에 존재
    const labels = Object.keys(out.results).sort();
    expect(labels).toEqual(["eorder", "innovationRfp", "notice"]);

    // 라벨↔op 대응: eorder는 I op, innovationRfp는 J op에 붙는다.
    const eorder = out.results.eorder;
    const rfp = out.results.innovationRfp;
    expect(eorder).toHaveProperty("status", "ok");
    expect(rfp).toHaveProperty("status", "ok");
    if (eorder.status === "ok") {
      expect(eorder.items).toHaveLength(1);
      expect(eorder.items[0]).toHaveProperty("bidNtceNo", EORDER_OP);
    }
    if (rfp.status === "ok") {
      expect(rfp.items).toHaveLength(1);
      expect(rfp.items[0]).toHaveProperty("bidNtceNo", RFP_OP);
    }

    // 첨부 op는 inqryDiv 2·3(J만 3), 목록 op(kind fanOut)는 inqryDiv 2로 호출된다.
    const eorderCall = requests.find((q) => q.op === EORDER_OP)!;
    const rfpCall = requests.find((q) => q.op === RFP_OP)!;
    expect(eorderCall.params.get("inqryDiv")).toBe("2");
    expect(eorderCall.params.get("bidNtceNo")).toBe("R25");
    expect(rfpCall.params.get("inqryDiv")).toBe("3");
    expect(rfpCall.params.get("bidNtceNo")).toBe("R25");
  });

  it("공고 규격첨부(ntceSpecDocUrl1~10)를 notice 소스로 정규화한다", async () => {
    // 용역 목록 op가 규격첨부 2쌍을 가진 공고를 반환 → notice 소스에 2건.
    const { client } = makeTestClient({
      [SERVC_OP]: {
        totalCount: 1,
        items: [{
          bidNtceNo: "R26", bidNtceOrd: "000",
          ntceSpecFileNm1: "입찰공고문.hwp", ntceSpecDocUrl1: "https://g2b/f1",
          ntceSpecFileNm2: "제안요청서.hwp", ntceSpecDocUrl2: "https://g2b/f2",
        }],
      },
    });

    const out = await runAttachments(client, { bidNtceNo: "R26" });

    const notice = out.results.notice;
    expect(notice).toHaveProperty("status", "ok");
    if (notice.status === "ok") {
      expect(notice.items).toHaveLength(2);
      expect(notice.items[0]).toMatchObject({ fileNm: "입찰공고문.hwp", fileUrl: "https://g2b/f1" });
      expect(notice.items[1]).toMatchObject({ fileNm: "제안요청서.hwp", fileUrl: "https://g2b/f2" });
    }
  });
});
