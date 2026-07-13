export interface BidNotice {
  bidNtceNo?: string;
  bidNtceOrd?: string;        // 신규: 공고차수 (enrichment 조회 키)
  bidNtceNm?: string;
  ntceInsttNm?: string;
  dminsttNm?: string;
  bidNtceDt?: string;
  bidClseDt?: string;
  opengDt?: string;
  presmptPrce?: string;
  bidNtceDtlUrl?: string;
  // 프리세일즈 고신호 (라이브 관찰 후 가감; 초기값은 명세 응답필드에서 채택)
  bidMethdNm?: string;        // 입찰방법
  cntrctCnclsMthdNm?: string; // 계약체결방법
  bidPrtcptLmtYn?: string;    // 투찰제한여부
  prtcptLmtRgnNm?: string;    // 참가제한지역
  cmmnSpldmdMethdNm?: string; // 공동수급방식
}

export interface BidBasisAmount {
  bidNtceNo?: string;
  bidNtceOrd?: string;
  bssamt?: string;            // 기초금액
  evlBssAmt?: string;         // 평가기준금액
  rsrvtnPrceRngBgnRate?: string;
  rsrvtnPrceRngEndRate?: string; // 예비가격범위율
  bssamtOpenDt?: string;
}

export interface BidEvaluation {
  bidNtceNo?: string;
  bidNtceOrd?: string;
  prearngPrceDcsnMthdNm?: string; // 예정가격결정방법
  bidPrceCalclAOpenDt?: string;
  // 산식A 합산항목 (C)
  npnInsrprm?: string;
  mrfnHealthInsrprm?: string;
  qltyMngcst?: string;
  sftyMngcst?: string;
  sftyChckMngcst?: string;
  // 평가주력분야 (G)
  tmpNm?: string;
}

export interface BidChange {
  bidNtceNo?: string;
  bidNtceOrd?: string;
  chgDt?: string;
  chgItemNm?: string;
  bfchgVal?: string;
  afchgVal?: string;
  chgDataDivNm?: string;
}

export interface BidEligibility {
  bidNtceNo?: string;
  bidNtceOrd?: string;
  lcnsLmtNm?: string;          // 면허제한명 (E)
  permsnIndstrytyList?: string; // 허용업종
  prtcptPsblRgnNm?: string;    // 참가가능지역명 (F)
}

export interface BidItem {
  bidNtceNo?: string;
  bidNtceOrd?: string;
  prdctClsfcNoNm?: string;     // 품명
  dtilPrdctClsfcNoNm?: string; // 세부품명
  qty?: string;
  unit?: string;
  uprc?: string;
  dlvrPlce?: string;
  dlvrTmlmtDt?: string;
}

export interface BidAttachment {
  bidNtceNo?: string;
  bidNtceOrd?: string;
  fileNm: string;
  fileUrl: string;
  docDivNm: string;
}
