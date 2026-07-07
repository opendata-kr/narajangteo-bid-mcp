import type { RawItem } from "@opendata-kr/core";
import type { BidNotice } from "./api/types.js";

export function formatItem(raw: RawItem): BidNotice {
  const pick = (k: string): string => raw[k] ?? "";
  return {
    bidNtceNo: pick("bidNtceNo"),
    bidNtceOrd: pick("bidNtceOrd"),
    bidNtceNm: pick("bidNtceNm"),
    ntceInsttNm: pick("ntceInsttNm"),
    dminsttNm: pick("dminsttNm"),
    bidNtceDt: pick("bidNtceDt"),
    bidClseDt: pick("bidClseDt"),
    opengDt: pick("opengDt"),
    presmptPrce: pick("presmptPrce"),
    bidNtceDtlUrl: pick("bidNtceDtlUrl"),
    bidMethdNm: pick("bidMethdNm"),
    cntrctCnclsMthdNm: pick("cntrctCnclsMthdNm"),
    bidPrtcptLmtYn: pick("bidPrtcptLmtYn"),
    prtcptLmtRgnNm: pick("prtcptLmtRgnNm"),
    cmmnSpldmdMethdNm: pick("cmmnSpldmdMethdNm"),
  };
}

export function formatItems(items: RawItem[]): BidNotice[] {
  return items.map(formatItem);
}
