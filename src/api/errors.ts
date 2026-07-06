export class BidApiError extends Error {
  readonly code: string;
  readonly koreanMessage: string;
  constructor(code: string, koreanMessage: string) {
    super(`[${code}] ${koreanMessage}`);
    this.name = "BidApiError";
    this.code = code;
    this.koreanMessage = koreanMessage;
  }
}

// data.go.kr OpenAPI 에러코드 → 사용자 조치용 한국어 메시지.
const CODE_MESSAGE: Record<string, string> = {
  "01": "제공기관 서비스 상태가 원활하지 않습니다. 잠시 후 다시 시도하세요.",
  "02": "제공기관 DB 오류입니다. 잠시 후 다시 시도하세요.",
  "04": "제공기관 HTTP 오류입니다. 잠시 후 다시 시도하세요.",
  "05": "제공기관 서비스가 응답 시간을 초과했습니다.",
  "06": "날짜 형식이 잘못되었습니다. YYYYMMDD 형식을 확인하세요.",
  "07": "요청 파라미터 입력값 범위를 초과했습니다.",
  "08": "필수 파라미터가 누락되었습니다.",
  "10": "요청에 ServiceKey가 없습니다. 환경변수 DATA_GO_KR_SERVICE_KEY를 확인하세요.",
  "11": "필수 파라미터가 누락되었습니다.",
  "12": "해당 OpenAPI 서비스가 없거나 폐기되었습니다. 요청 URL을 확인하세요.",
  "20": "OpenAPI 활용승인이 되지 않았습니다. 공공데이터포털에서 승인 상태를 확인하세요.",
  "22": "일일 호출 한도를 초과했습니다. 공공데이터포털에서 트래픽 한도를 확인하세요.",
  "30":
    "등록되지 않은 서비스키입니다. 발급받은 Decoding 서비스키인지, 이중 인코딩이 아닌지 확인하세요.",
  "31": "서비스키 사용기간이 만료되었습니다. 공공데이터포털에서 연장하세요.",
  "32": "활용신청한 서버 IP와 요청 IP가 다릅니다.",
};

export function normalizeResultCode(
  code: string,
  rawMsg?: string,
): { ok: boolean; noData: boolean; error?: BidApiError } {
  if (code === "00" || code === "0") {
    return { ok: true, noData: false };
  }
  if (code === "03") {
    return { ok: false, noData: true };
  }
  const known = CODE_MESSAGE[code];
  const message = known ?? `알 수 없는 오류입니다 (${rawMsg ?? "원문 없음"}).`;
  return { ok: false, noData: false, error: new BidApiError(code, message) };
}
