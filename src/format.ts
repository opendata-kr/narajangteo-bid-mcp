import type { RawItem } from "@opendata-kr/core";
import type { BidNotice } from "./api/types.js";

export function formatItem(raw: RawItem): BidNotice {
  const pick = (k: string): string => raw[k] ?? "";
  return {
    bidNtceNo: pick("bidNtceNo"),
    bidNtceNm: pick("bidNtceNm"),
    ntceInsttNm: pick("ntceInsttNm"),
    dminsttNm: pick("dminsttNm"),
    bidNtceDt: pick("bidNtceDt"),
    bidClseDt: pick("bidClseDt"),
    opengDt: pick("opengDt"),
    presmptPrce: pick("presmptPrce"),
    bidNtceDtlUrl: pick("bidNtceDtlUrl"),
  };
}

export function formatItems(items: RawItem[]): BidNotice[] {
  return items.map(formatItem);
}
