import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RawItem } from "@opendata-kr/core";
import {
  formatItem, formatItems, formatBasis, formatAttachment,
  formatEvaluation, formatChange, formatEligibility, formatItemRow,
} from "./format.js";

interface Fixture {
  response: { body: { items: RawItem[] } };
}

function loadFixture(name: string): Fixture {
  const url = new URL(`../tests/fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as Fixture;
}

describe("format", () => {
  it("원본 item을 핵심 필드로 정제한다", () => {
    const fx = loadFixture("search-cnstwk.json");
    const first = formatItem(fx.response.body.items[0]!);
    expect(first.bidNtceNo).toBe("R25BK00932003");
    expect(first.bidNtceNm).toBe("문성고등학교 비탈면공사 수의계약 안내공고");
    expect(first.presmptPrce).toBe("180645355");
    expect(first.bidNtceDtlUrl).toBe("https://www.g2b.go.kr/example1");
  });

  it("누락 필드는 undefined", () => {
    const result = formatItem({ bidNtceNo: "X1" });
    expect(result.bidNtceNo).toBe("X1");
    expect(result.bidNtceNm).toBeUndefined();
    expect(result.dminsttNm).toBeUndefined();
  });

  it("formatItems는 배열을 매핑한다", () => {
    const fx = loadFixture("search-cnstwk.json");
    const out = formatItems(fx.response.body.items);
    expect(out).toHaveLength(2);
    expect(out[1]!.bidNtceNo).toBe("R25BK00932010");
  });

  it("부재 키는 undefined (빈 문자열 강제 아님)", () => {
    const out = formatItem({ bidNtceNo: "R25BK0001", bidNtceOrd: "000" } as any);
    expect(out.bidNtceNo).toBe("R25BK0001");
    expect(out.bidMethdNm).toBeUndefined();
  });

  it("기초금액 매핑", () => {
    const out = formatBasis({ bidNtceNo: "A", bidNtceOrd: "1", bssamt: "1000", evlBssAmt: "900" } as any);
    expect(out.bssamt).toBe("1000");
    expect(out.evlBssAmt).toBe("900");
  });

  it("첨부는 I/J 이질 필드명을 공통 fileNm/fileUrl로 정규화", () => {
    const i = formatAttachment({ bidNtceNo: "A", bidNtceOrd: "1", eorderAtchFileNm: "규격서", eorderAtchFileUrl: "http://x", eorderDocDivNm: "e발주" } as any);
    expect(i.fileNm).toBe("규격서");
    expect(i.fileUrl).toBe("http://x");
    const j = formatAttachment({ bidNtceNo: "A", bidNtceOrd: "1", atchFileNm: "RFP", atchFileUrl: "http://y", atchDocDivNm: "제안요청" } as any);
    expect(j.fileNm).toBe("RFP");
    expect(j.fileUrl).toBe("http://y");
  });

  it("평가정보 매핑", () => {
    const out = formatEvaluation({ bidNtceNo: "A", bidNtceOrd: "1", prearngPrceDcsnMthdNm: "예정가격산정", sftyMngcst: "500" } as any);
    expect(out.prearngPrceDcsnMthdNm).toBe("예정가격산정");
    expect(out.sftyMngcst).toBe("500");
  });

  it("변경정보 매핑", () => {
    const out = formatChange({ bidNtceNo: "A", bidNtceOrd: "1", chgDt: "20250101", chgItemNm: "개찰일시", afchgVal: "변경후" } as any);
    expect(out.chgDt).toBe("20250101");
    expect(out.chgItemNm).toBe("개찰일시");
    expect(out.afchgVal).toBe("변경후");
  });

  it("참가자격 매핑", () => {
    const out = formatEligibility({ bidNtceNo: "A", bidNtceOrd: "1", lcnsLmtNm: "건설업", prtcptPsblRgnNm: "서울" } as any);
    expect(out.lcnsLmtNm).toBe("건설업");
    expect(out.prtcptPsblRgnNm).toBe("서울");
  });

  it("품목 매핑", () => {
    const out = formatItemRow({ bidNtceNo: "A", bidNtceOrd: "1", prdctClsfcNoNm: "책상", qty: "10", unit: "EA" } as any);
    expect(out.prdctClsfcNoNm).toBe("책상");
    expect(out.qty).toBe("10");
    expect(out.unit).toBe("EA");
  });
});
