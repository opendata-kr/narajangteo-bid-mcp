import type {
  RawBidNotice, RawBasis, RawEvaluation, RawChange,
  RawEligibility, RawBidItem, RawAttachment,
} from "./api/schema.js";
import type {
  BidNotice, BidBasisAmount, BidEvaluation, BidChange,
  BidEligibility, BidItem, BidAttachment,
} from "./api/types.js";

export function formatItem(raw: RawBidNotice): BidNotice {
  return {
    bidNtceNo: raw.bidNtceNo, bidNtceOrd: raw.bidNtceOrd, bidNtceNm: raw.bidNtceNm,
    ntceInsttNm: raw.ntceInsttNm, dminsttNm: raw.dminsttNm,
    bidNtceDt: raw.bidNtceDt, bidClseDt: raw.bidClseDt, opengDt: raw.opengDt,
    presmptPrce: raw.presmptPrce, bidNtceDtlUrl: raw.bidNtceDtlUrl,
    bidMethdNm: raw.bidMethdNm, cntrctCnclsMthdNm: raw.cntrctCnclsMthdNm,
    bidPrtcptLmtYn: raw.bidPrtcptLmtYn, prtcptLmtRgnNm: raw.prtcptLmtRgnNm,
    cmmnSpldmdMethdNm: raw.cmmnSpldmdMethdNm,
  };
}
export const formatItems = (items: RawBidNotice[]): BidNotice[] => items.map(formatItem);

export const formatBasis = (raw: RawBasis): BidBasisAmount => ({
  bidNtceNo: raw.bidNtceNo, bidNtceOrd: raw.bidNtceOrd,
  bssamt: raw.bssamt, evlBssAmt: raw.evlBssAmt,
  rsrvtnPrceRngBgnRate: raw.rsrvtnPrceRngBgnRate, rsrvtnPrceRngEndRate: raw.rsrvtnPrceRngEndRate,
  bssamtOpenDt: raw.bssamtOpenDt,
});

export const formatEvaluation = (raw: RawEvaluation): BidEvaluation => ({
  bidNtceNo: raw.bidNtceNo, bidNtceOrd: raw.bidNtceOrd,
  prearngPrceDcsnMthdNm: raw.prearngPrceDcsnMthdNm, bidPrceCalclAOpenDt: raw.bidPrceCalclAOpenDt,
  npnInsrprm: raw.npnInsrprm, mrfnHealthInsrprm: raw.mrfnHealthInsrprm,
  qltyMngcst: raw.qltyMngcst, sftyMngcst: raw.sftyMngcst, sftyChckMngcst: raw.sftyChckMngcst,
  tmpNm: raw.tmpNm,
});

export const formatChange = (raw: RawChange): BidChange => ({
  bidNtceNo: raw.bidNtceNo, bidNtceOrd: raw.bidNtceOrd,
  chgDt: raw.chgDt, chgItemNm: raw.chgItemNm,
  bfchgVal: raw.bfchgVal, afchgVal: raw.afchgVal, chgDataDivNm: raw.chgDataDivNm,
});

export const formatEligibility = (raw: RawEligibility): BidEligibility => ({
  bidNtceNo: raw.bidNtceNo, bidNtceOrd: raw.bidNtceOrd,
  lcnsLmtNm: raw.lcnsLmtNm, permsnIndstrytyList: raw.permsnIndstrytyList,
  prtcptPsblRgnNm: raw.prtcptPsblRgnNm,
});

export const formatItemRow = (raw: RawBidItem): BidItem => ({
  bidNtceNo: raw.bidNtceNo, bidNtceOrd: raw.bidNtceOrd,
  prdctClsfcNoNm: raw.prdctClsfcNoNm, dtilPrdctClsfcNoNm: raw.dtilPrdctClsfcNoNm,
  qty: raw.qty, unit: raw.unit, uprc: raw.uprc,
  dlvrPlce: raw.dlvrPlce, dlvrTmlmtDt: raw.dlvrTmlmtDt,
});

// I(eorder*)·J(atch*) 이질 필드명을 공통으로 정규화
export function formatAttachment(raw: RawAttachment): BidAttachment {
  return {
    bidNtceNo: raw.bidNtceNo,
    bidNtceOrd: raw.bidNtceOrd,
    fileNm: raw.eorderAtchFileNm ?? raw.atchFileNm ?? "",
    fileUrl: raw.eorderAtchFileUrl ?? raw.atchFileUrl ?? "",
    docDivNm: raw.eorderDocDivNm ?? raw.atchDocDivNm ?? "",
  };
}

// 기본 목록 응답의 공고 규격첨부(ntceSpecFileNm/DocUrl 1..10 쌍)를 첨부 목록으로 정규화한다.
// 이것이 첨부의 주경로다. 공고문·규격서·제안요청서가 여기로 온다. 전용 첨부 op(e발주·혁신장터RFP)는 드문 특수 케이스라 대부분 공고에서 비어 있다.
export function formatNoticeSpecAttachments(raw: RawBidNotice): BidAttachment[] {
  const { bidNtceNo, bidNtceOrd } = raw;
  const out: BidAttachment[] = [];
  // 공고규격서: ntceSpecDocUrl1~10 (파일명 ntceSpecFileNm 짝 있음)
  const specs: [string | undefined, string | undefined][] = [
    [raw.ntceSpecDocUrl1, raw.ntceSpecFileNm1],
    [raw.ntceSpecDocUrl2, raw.ntceSpecFileNm2],
    [raw.ntceSpecDocUrl3, raw.ntceSpecFileNm3],
    [raw.ntceSpecDocUrl4, raw.ntceSpecFileNm4],
    [raw.ntceSpecDocUrl5, raw.ntceSpecFileNm5],
    [raw.ntceSpecDocUrl6, raw.ntceSpecFileNm6],
    [raw.ntceSpecDocUrl7, raw.ntceSpecFileNm7],
    [raw.ntceSpecDocUrl8, raw.ntceSpecFileNm8],
    [raw.ntceSpecDocUrl9, raw.ntceSpecFileNm9],
    [raw.ntceSpecDocUrl10, raw.ntceSpecFileNm10],
  ];
  for (const [fileUrl, fileNm] of specs) {
    if (!fileUrl) continue;
    out.push({ bidNtceNo, bidNtceOrd, fileNm: fileNm ?? "", fileUrl, docDivNm: "공고규격서" });
  }
  // 현장설명서: sptDscrptDocUrl1~5 (파일명 필드 없음 → 합성명). 명세 정의 필드, 공사 공고에서 드묾.
  const spts = [raw.sptDscrptDocUrl1, raw.sptDscrptDocUrl2, raw.sptDscrptDocUrl3, raw.sptDscrptDocUrl4, raw.sptDscrptDocUrl5];
  spts.forEach((fileUrl, i) => {
    if (!fileUrl) return;
    out.push({ bidNtceNo, bidNtceOrd, fileNm: `현장설명서${i + 1}`, fileUrl, docDivNm: "현장설명서" });
  });
  return out;
}
