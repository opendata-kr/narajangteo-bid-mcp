export type RawItem = Record<string, string>;

export interface RawApiResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      totalCount: number;
      numOfRows: number;
      pageNo: number;
      // data.go.kr은 결과 0건일 때 items를 빈 문자열로 주기도 한다.
      items: RawItem[] | "";
    };
  };
}

export interface BidNotice {
  bidNtceNo: string;
  bidNtceNm: string;
  ntceInsttNm: string;
  dminsttNm: string;
  bidNtceDt: string;
  bidClseDt: string;
  opengDt: string;
  presmptPrce: string;
  bidNtceDtlUrl: string;
}
