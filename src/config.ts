export interface AppConfig {
  serviceKey: string;
  baseUrl: string;
  looksPreEncoded: boolean;
}

const BASE_URL = "http://apis.data.go.kr/1230000/ad/BidPublicInfoService";

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const serviceKey = env.BID_SERVICE_KEY?.trim();
  if (!serviceKey) {
    throw new Error(
      "환경변수 BID_SERVICE_KEY가 없습니다. 공공데이터포털에서 발급받은 Decoding 서비스키를 설정하세요.",
    );
  }
  // Decoding 키에 %가 있으면 이미 URL 인코딩된 값일 가능성이 높다(이중 인코딩 위험).
  const looksPreEncoded = /%[0-9A-Fa-f]{2}/.test(serviceKey);
  return { serviceKey, baseUrl: BASE_URL, looksPreEncoded };
}
