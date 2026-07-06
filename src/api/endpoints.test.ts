import { describe, expect, it } from "vitest";
import {
  ALL_BID_KINDS,
  BID_KIND_LABEL,
  listOperation,
  searchOperation,
} from "./endpoints.js";

describe("endpoints", () => {
  it("전 업무구분 4종을 노출한다", () => {
    expect([...ALL_BID_KINDS].sort()).toEqual(
      ["cnstwk", "frgcpt", "servc", "thng"].sort(),
    );
  });

  it("검색 오퍼레이션명을 매핑한다", () => {
    expect(searchOperation("cnstwk")).toBe("getBidPblancListInfoCnstwkPPSSrch");
    expect(searchOperation("servc")).toBe("getBidPblancListInfoServcPPSSrch");
    expect(searchOperation("thng")).toBe("getBidPblancListInfoThngPPSSrch");
    expect(searchOperation("frgcpt")).toBe("getBidPblancListInfoFrgcptPPSSrch");
  });

  it("기본 목록 오퍼레이션명을 매핑한다", () => {
    expect(listOperation("cnstwk")).toBe("getBidPblancListInfoCnstwk");
    expect(listOperation("frgcpt")).toBe("getBidPblancListInfoFrgcpt");
  });

  it("한국어 라벨을 제공한다", () => {
    expect(BID_KIND_LABEL.cnstwk).toBe("공사");
    expect(BID_KIND_LABEL.servc).toBe("용역");
    expect(BID_KIND_LABEL.thng).toBe("물품");
    expect(BID_KIND_LABEL.frgcpt).toBe("외자");
  });
});
