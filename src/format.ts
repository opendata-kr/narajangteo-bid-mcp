import type { BidNotice, RawApiResponse, RawItem } from "./api/types.js";

export function extractItems(
  body: RawApiResponse["response"]["body"],
): RawItem[] {
  return Array.isArray(body.items) ? body.items : [];
}

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
