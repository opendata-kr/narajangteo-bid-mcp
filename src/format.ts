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

// 기본 목록 응답의 공고 규격첨부(ntceSpecFileNm/DocUrl 1..10 쌍)를 첨부 목록으로 정규화한다.
// 이것이 첨부의 주경로다. 공고문·규격서·제안요청서가 여기로 온다. 전용 첨부 op(e발주·혁신장터RFP)는 드문 특수 케이스라 대부분 공고에서 비어 있다.
export function formatNoticeSpecAttachments(raw: RawItem): BidAttachment[] {
  const bidNtceNo = pick(raw, "bidNtceNo");
  const bidNtceOrd = pick(raw, "bidNtceOrd");
  const out: BidAttachment[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const fileUrl = pick(raw, `ntceSpecDocUrl${i}`);
    if (!fileUrl) continue;
    out.push({
      bidNtceNo,
      bidNtceOrd,
      fileNm: pick(raw, `ntceSpecFileNm${i}`) ?? "",
      fileUrl,
      docDivNm: "",
    });
  }
  return out;
}
