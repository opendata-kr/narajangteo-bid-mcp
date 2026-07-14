import { z } from "zod";

// data.go.kr 응답 item 검증 스키마. core README 규약대로 관용적으로 짠다.
// looseObject로 미선언 필드를 통과시킨다. 이 리포의 발행 출력계약은 전 필드 optional이라
// (단건 조회는 쿼리가 공고번호를 이미 알고, 목록 item의 결손도 기존에 허용) 필수 필드를 두지 않는다.
// 금액·수량·율·보험료처럼 숫자·문자열이 섞여 올 수 있는 필드는 coerce.string으로 수렴시킨다.

const noticeKeyFields = {
  bidNtceNo: z.coerce.string().optional(),
  bidNtceOrd: z.coerce.string().optional(),
};

// 공고 목록 item (기본판·PPSSrch 공통). ntceSpec*·sptDscrpt* 인라인 규격첨부 포함.
export const RawBidNoticeSchema = z.looseObject({
  ...noticeKeyFields,
  bidNtceNm: z.string().optional(),
  ntceInsttNm: z.string().optional(),
  dminsttNm: z.string().optional(),
  bidNtceDt: z.string().optional(),
  bidClseDt: z.string().optional(),
  opengDt: z.string().optional(),
  presmptPrce: z.coerce.string().optional(),
  bidNtceDtlUrl: z.string().optional(),
  bidMethdNm: z.string().optional(),
  cntrctCnclsMthdNm: z.string().optional(),
  bidPrtcptLmtYn: z.string().optional(),
  prtcptLmtRgnNm: z.string().optional(),
  cmmnSpldmdMethdNm: z.string().optional(),
  ntceSpecFileNm1: z.string().optional(),
  ntceSpecFileNm2: z.string().optional(),
  ntceSpecFileNm3: z.string().optional(),
  ntceSpecFileNm4: z.string().optional(),
  ntceSpecFileNm5: z.string().optional(),
  ntceSpecFileNm6: z.string().optional(),
  ntceSpecFileNm7: z.string().optional(),
  ntceSpecFileNm8: z.string().optional(),
  ntceSpecFileNm9: z.string().optional(),
  ntceSpecFileNm10: z.string().optional(),
  ntceSpecDocUrl1: z.string().optional(),
  ntceSpecDocUrl2: z.string().optional(),
  ntceSpecDocUrl3: z.string().optional(),
  ntceSpecDocUrl4: z.string().optional(),
  ntceSpecDocUrl5: z.string().optional(),
  ntceSpecDocUrl6: z.string().optional(),
  ntceSpecDocUrl7: z.string().optional(),
  ntceSpecDocUrl8: z.string().optional(),
  ntceSpecDocUrl9: z.string().optional(),
  ntceSpecDocUrl10: z.string().optional(),
  sptDscrptDocUrl1: z.string().optional(),
  sptDscrptDocUrl2: z.string().optional(),
  sptDscrptDocUrl3: z.string().optional(),
  sptDscrptDocUrl4: z.string().optional(),
  sptDscrptDocUrl5: z.string().optional(),
});
export type RawBidNotice = z.infer<typeof RawBidNoticeSchema>;

// 기초금액 (B)
export const RawBasisSchema = z.looseObject({
  ...noticeKeyFields,
  bssamt: z.coerce.string().optional(),
  evlBssAmt: z.coerce.string().optional(),
  rsrvtnPrceRngBgnRate: z.coerce.string().optional(),
  rsrvtnPrceRngEndRate: z.coerce.string().optional(),
  bssamtOpenDt: z.string().optional(),
});
export type RawBasis = z.infer<typeof RawBasisSchema>;

// 산식A(C)·평가주력분야(G)
export const RawEvaluationSchema = z.looseObject({
  ...noticeKeyFields,
  prearngPrceDcsnMthdNm: z.string().optional(),
  bidPrceCalclAOpenDt: z.string().optional(),
  npnInsrprm: z.coerce.string().optional(),
  mrfnHealthInsrprm: z.coerce.string().optional(),
  qltyMngcst: z.coerce.string().optional(),
  sftyMngcst: z.coerce.string().optional(),
  sftyChckMngcst: z.coerce.string().optional(),
  tmpNm: z.string().optional(),
});
export type RawEvaluation = z.infer<typeof RawEvaluationSchema>;

// 변경이력 (D). 변경 전/후 값은 금액 변경이면 숫자로 올 수 있다.
export const RawChangeSchema = z.looseObject({
  ...noticeKeyFields,
  chgDt: z.string().optional(),
  chgItemNm: z.string().optional(),
  bfchgVal: z.coerce.string().optional(),
  afchgVal: z.coerce.string().optional(),
  chgDataDivNm: z.string().optional(),
});
export type RawChange = z.infer<typeof RawChangeSchema>;

// 면허제한(E)·참가가능지역(F)
export const RawEligibilitySchema = z.looseObject({
  ...noticeKeyFields,
  lcnsLmtNm: z.string().optional(),
  permsnIndstrytyList: z.string().optional(),
  prtcptPsblRgnNm: z.string().optional(),
});
export type RawEligibility = z.infer<typeof RawEligibilitySchema>;

// 구매대상물품 (H)
export const RawBidItemSchema = z.looseObject({
  ...noticeKeyFields,
  prdctClsfcNoNm: z.string().optional(),
  dtilPrdctClsfcNoNm: z.string().optional(),
  qty: z.coerce.string().optional(),
  unit: z.string().optional(),
  uprc: z.coerce.string().optional(),
  dlvrPlce: z.string().optional(),
  dlvrTmlmtDt: z.string().optional(),
});
export type RawBidItem = z.infer<typeof RawBidItemSchema>;

// 첨부 op (I e발주·J 혁신장터RFP, 이질 필드명 공존)
export const RawAttachmentSchema = z.looseObject({
  ...noticeKeyFields,
  eorderAtchFileNm: z.string().optional(),
  eorderAtchFileUrl: z.string().optional(),
  eorderDocDivNm: z.string().optional(),
  atchFileNm: z.string().optional(),
  atchFileUrl: z.string().optional(),
  atchDocDivNm: z.string().optional(),
});
export type RawAttachment = z.infer<typeof RawAttachmentSchema>;
