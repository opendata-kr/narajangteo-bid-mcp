import dataGoKr, { type DataGoKrClient } from "@opendata-kr/core";

const BASE_URL = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService";

export function createGateway(): DataGoKrClient {
  // 오버라이드(DATA_GO_KR_BASE_URL)는 서비스 경로를 포함한 전체 URL이어야 한다 (core 0.4 규약).
  return dataGoKr.create({
    baseURL: process.env.DATA_GO_KR_BASE_URL ?? BASE_URL,
    params: { type: "json" },
  });
}
