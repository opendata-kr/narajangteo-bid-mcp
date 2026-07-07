export type BidKind = "cnstwk" | "servc" | "thng" | "frgcpt" | "etc";

export const BID_KIND_LABEL: Record<BidKind, string> = {
  cnstwk: "공사", servc: "용역", thng: "물품", frgcpt: "외자", etc: "기타",
};

// 마이그레이션 호환용. Task 6에서 search/getNotice 재작성 완료 후 제거.
export const ALL_BID_KINDS: readonly BidKind[] = ["cnstwk", "servc", "thng", "frgcpt"];

// 기본조회/검색: 4종 + etc(옵트인). 기본 kind 집합엔 etc 제외(Task 5/6에서 제어).
export const NOTICE_KINDS: readonly BidKind[] = ["cnstwk", "servc", "thng", "frgcpt", "etc"];
export const BASIS_KINDS: readonly BidKind[] = ["thng", "cnstwk", "servc"];
export const CHANGE_KINDS: readonly BidKind[] = ["thng", "cnstwk", "servc"];
export const ITEM_KINDS: readonly BidKind[] = ["thng", "servc", "frgcpt"];

const LIST_OP: Record<BidKind, string> = {
  cnstwk: "getBidPblancListInfoCnstwk",
  servc: "getBidPblancListInfoServc",
  thng: "getBidPblancListInfoThng",
  frgcpt: "getBidPblancListInfoFrgcpt",
  etc: "getBidPblancListInfoEtc",
};
const SEARCH_OP: Record<BidKind, string> = {
  cnstwk: "getBidPblancListInfoCnstwkPPSSrch",
  servc: "getBidPblancListInfoServcPPSSrch",
  thng: "getBidPblancListInfoThngPPSSrch",
  frgcpt: "getBidPblancListInfoFrgcptPPSSrch",
  etc: "getBidPblancListInfoEtcPPSSrch",
};
export const listOperation = (k: BidKind): string => LIST_OP[k];
export const searchOperation = (k: BidKind): string => SEARCH_OP[k];

// 오퍼레이션명 3규칙 혼재라 개별 박제
export const BASIS_OP: Record<"thng" | "cnstwk" | "servc", string> = {
  thng: "getBidPblancListInfoThngBsisAmount",
  cnstwk: "getBidPblancListInfoCnstwkBsisAmount",
  servc: "getBidPblancListInfoServcBsisAmount",
};
export const CHANGE_OP: Record<"thng" | "cnstwk" | "servc", string> = {
  thng: "getBidPblancListInfoChgHstryThng",
  cnstwk: "getBidPblancListInfoChgHstryCnstwk",
  servc: "getBidPblancListInfoChgHstryServc",
};
export const ITEM_OP: Record<"thng" | "servc" | "frgcpt", string> = {
  thng: "getBidPblancListInfoThngPurchsObjPrdct",
  servc: "getBidPblancListInfoServcPurchsObjPrdct",
  frgcpt: "getBidPblancListInfoFrgcptPurchsObjPrdct",
};

// 공통(kind 없음) 도구: op + bidNtceNo 조회 시 inqryDiv
export const EVAL_OPS = [
  { op: "getBidPblancListBidPrceCalclAInfo", byNoInqryDiv: "2" },      // C 산식A
  { op: "getBidPblancListEvaluationIndstrytyMfrcInfo", byNoInqryDiv: "2" }, // G 평가주력분야
] as const;
export const ELIG_OPS = [
  { op: "getBidPblancListInfoLicenseLimit", byNoInqryDiv: "2" },   // E 면허제한
  { op: "getBidPblancListInfoPrtcptPsblRgn", byNoInqryDiv: "2" },  // F 참가가능지역
] as const;
export const ATTACH_OPS = [
  { op: "getBidPblancListInfoEorderAtchFileInfo", byNoInqryDiv: "2" },      // I e발주
  { op: "getBidPblancListPPIFnlRfpIssAtchFileInfo", byNoInqryDiv: "3" },    // J 혁신장터RFP (3!)
] as const;
