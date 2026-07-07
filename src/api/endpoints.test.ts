import { describe, it, expect } from "vitest";
import {
  BID_KIND_LABEL, NOTICE_KINDS, BASIS_KINDS, CHANGE_KINDS, ITEM_KINDS,
  listOperation, searchOperation, BASIS_OP, CHANGE_OP, ITEM_OP,
  EVAL_OPS, ELIG_OPS, ATTACH_OPS,
} from "./endpoints.js";

describe("endpoints", () => {
  it("etc kind 포함, 도구별 kind 집합 분리", () => {
    expect(BID_KIND_LABEL.etc).toBe("기타");
    expect(NOTICE_KINDS).toContain("etc");
    expect(BASIS_KINDS).toEqual(["thng", "cnstwk", "servc"]);
    expect(ITEM_KINDS).toEqual(["thng", "servc", "frgcpt"]); // 공사 없음
  });

  it("오퍼레이션명 개별 박제 (SUFFIX 파생 아님)", () => {
    expect(listOperation("etc")).toBe("getBidPblancListInfoEtc");
    expect(searchOperation("etc")).toBe("getBidPblancListInfoEtcPPSSrch");
    expect(BASIS_OP.thng).toBe("getBidPblancListInfoThngBsisAmount");
    expect(CHANGE_OP.cnstwk).toBe("getBidPblancListInfoChgHstryCnstwk");
    expect(ITEM_OP.frgcpt).toBe("getBidPblancListInfoFrgcptPurchsObjPrdct");
  });

  it("J 첨부는 bidNtceNo 조회 inqryDiv=3", () => {
    const j = ATTACH_OPS.find((o) => o.op === "getBidPblancListPPIFnlRfpIssAtchFileInfo");
    expect(j?.byNoInqryDiv).toBe("3");
    const i = ATTACH_OPS.find((o) => o.op === "getBidPblancListInfoEorderAtchFileInfo");
    expect(i?.byNoInqryDiv).toBe("2");
  });

  it("listOperation을 5개 kind 전부 정확히 매핑 (회귀 방지)", () => {
    expect(listOperation("cnstwk")).toBe("getBidPblancListInfoCnstwk");
    expect(listOperation("servc")).toBe("getBidPblancListInfoServc");
    expect(listOperation("thng")).toBe("getBidPblancListInfoThng");
    expect(listOperation("frgcpt")).toBe("getBidPblancListInfoFrgcpt");
    expect(listOperation("etc")).toBe("getBidPblancListInfoEtc");
  });

  it("searchOperation을 5개 kind 전부 정확히 매핑 (회귀 방지)", () => {
    expect(searchOperation("cnstwk")).toBe("getBidPblancListInfoCnstwkPPSSrch");
    expect(searchOperation("servc")).toBe("getBidPblancListInfoServcPPSSrch");
    expect(searchOperation("thng")).toBe("getBidPblancListInfoThngPPSSrch");
    expect(searchOperation("frgcpt")).toBe("getBidPblancListInfoFrgcptPPSSrch");
    expect(searchOperation("etc")).toBe("getBidPblancListInfoEtcPPSSrch");
  });

  it("BID_KIND_LABEL을 5개 kind 전부 정확히 매핑 (회귀 방지)", () => {
    expect(BID_KIND_LABEL.cnstwk).toBe("공사");
    expect(BID_KIND_LABEL.servc).toBe("용역");
    expect(BID_KIND_LABEL.thng).toBe("물품");
    expect(BID_KIND_LABEL.frgcpt).toBe("외자");
    expect(BID_KIND_LABEL.etc).toBe("기타");
  });

  it("CHANGE_KINDS 순서·구성 고정 (회귀 방지)", () => {
    expect(CHANGE_KINDS).toEqual(["thng", "cnstwk", "servc"]);
  });

  it("EVAL_OPS op·byNoInqryDiv 정확 비교 (회귀 방지)", () => {
    expect(EVAL_OPS.map((o) => o.op)).toEqual([
      "getBidPblancListBidPrceCalclAInfo",
      "getBidPblancListEvaluationIndstrytyMfrcInfo",
    ]);
    expect(
      EVAL_OPS.find((o) => o.op === "getBidPblancListBidPrceCalclAInfo")?.byNoInqryDiv,
    ).toBe("2");
    expect(
      EVAL_OPS.find((o) => o.op === "getBidPblancListEvaluationIndstrytyMfrcInfo")?.byNoInqryDiv,
    ).toBe("2");
  });

  it("ELIG_OPS op·byNoInqryDiv 정확 비교 (회귀 방지)", () => {
    expect(ELIG_OPS.map((o) => o.op)).toEqual([
      "getBidPblancListInfoLicenseLimit",
      "getBidPblancListInfoPrtcptPsblRgn",
    ]);
    expect(
      ELIG_OPS.find((o) => o.op === "getBidPblancListInfoLicenseLimit")?.byNoInqryDiv,
    ).toBe("2");
    expect(
      ELIG_OPS.find((o) => o.op === "getBidPblancListInfoPrtcptPsblRgn")?.byNoInqryDiv,
    ).toBe("2");
  });
});
