import type { RawItem } from "@opendata-kr/core";
import type {
  BidNotice, BidBasisAmount, BidEvaluation, BidChange,
  BidEligibility, BidItem, BidAttachment,
} from "./api/types.js";

// 부재 키는 undefined. 존재 키만 반환값에 남긴다.
const pick = (raw: RawItem, k: string): string | undefined =>
  raw[k] === undefined || raw[k] === null ? undefined : String(raw[k]);

const mapKeys = <T>(raw: RawItem, keys: (keyof T & string)[]): T => {
  const out = {} as Record<string, string | undefined>;
  for (const k of keys) out[k] = pick(raw, k);
  return out as T;
};

export function formatItem(raw: RawItem): BidNotice {
  return mapKeys<BidNotice>(raw, [
    "bidNtceNo", "bidNtceOrd", "bidNtceNm", "ntceInsttNm", "dminsttNm",
    "bidNtceDt", "bidClseDt", "opengDt", "presmptPrce", "bidNtceDtlUrl",
    "bidMethdNm", "cntrctCnclsMthdNm", "bidPrtcptLmtYn", "prtcptLmtRgnNm",
    "cmmnSpldmdMethdNm",
  ]);
}
export const formatItems = (items: RawItem[]): BidNotice[] => items.map(formatItem);

export const formatBasis = (raw: RawItem): BidBasisAmount =>
  mapKeys<BidBasisAmount>(raw, ["bidNtceNo", "bidNtceOrd", "bssamt", "evlBssAmt", "rsrvtnPrceRngBgnRate", "rsrvtnPrceRngEndRate", "bssamtOpenDt"]);

export const formatEvaluation = (raw: RawItem): BidEvaluation =>
  mapKeys<BidEvaluation>(raw, ["bidNtceNo", "bidNtceOrd", "prearngPrceDcsnMthdNm", "bidPrceCalclAOpenDt", "npnInsrprm", "mrfnHealthInsrprm", "qltyMngcst", "sftyMngcst", "sftyChckMngcst", "tmpNm"]);

export const formatChange = (raw: RawItem): BidChange =>
  mapKeys<BidChange>(raw, ["bidNtceNo", "bidNtceOrd", "chgDt", "chgItemNm", "bfchgVal", "afchgVal", "chgDataDivNm"]);

export const formatEligibility = (raw: RawItem): BidEligibility =>
  mapKeys<BidEligibility>(raw, ["bidNtceNo", "bidNtceOrd", "lcnsLmtNm", "permsnIndstrytyList", "prtcptPsblRgnNm"]);

export const formatItemRow = (raw: RawItem): BidItem =>
  mapKeys<BidItem>(raw, ["bidNtceNo", "bidNtceOrd", "prdctClsfcNoNm", "dtilPrdctClsfcNoNm", "qty", "unit", "uprc", "dlvrPlce", "dlvrTmlmtDt"]);

// I(eorder*)·J(atch*) 이질 필드명을 공통으로 정규화
export function formatAttachment(raw: RawItem): BidAttachment {
  return {
    bidNtceNo: pick(raw, "bidNtceNo"),
    bidNtceOrd: pick(raw, "bidNtceOrd"),
    fileNm: pick(raw, "eorderAtchFileNm") ?? pick(raw, "atchFileNm") ?? "",
    fileUrl: pick(raw, "eorderAtchFileUrl") ?? pick(raw, "atchFileUrl") ?? "",
    docDivNm: pick(raw, "eorderDocDivNm") ?? pick(raw, "atchDocDivNm") ?? "",
  };
}
