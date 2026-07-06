import type { AppConfig } from "../config.js";
import { extractItems } from "../format.js";
import { normalizeResultCode } from "./errors.js";
import type { RawApiResponse, RawItem } from "./types.js";

export interface OperationResult {
  totalCount: number;
  pageNo: number;
  items: RawItem[];
}

export interface CallDeps {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

type ParamValue = string | number | undefined;

export function buildUrl(
  config: AppConfig,
  operation: string,
  params: Record<string, ParamValue>,
): string {
  const qs = new URLSearchParams();
  qs.set("ServiceKey", config.serviceKey);
  qs.set("type", "json");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    qs.set(key, String(value));
  }
  return `${config.baseUrl}/${operation}?${qs.toString()}`;
}

// data.go.kr 게이트웨이는 HTTP 200에도 JSON이 아닌 본문(XML 에러 봉투, 평문 메시지)을
// 돌려줄 때가 있다. XML 봉투에서 결과코드를 추출해 기존 normalizeResultCode로 넘긴다.
// 정상 처리(noData)는 OperationResult를 반환하고, 그 외에는 항상 throw한다.
function handleNonJsonBody(
  text: string,
  params: Record<string, ParamValue>,
): OperationResult {
  const codeMatch = text.match(/<returnReasonCode>(\d+)<\/returnReasonCode>/);
  if (codeMatch) {
    const code = codeMatch[1]!;
    const authMsgMatch = text.match(/<returnAuthMsg>([^<]*)<\/returnAuthMsg>/);
    const norm = normalizeResultCode(code, authMsgMatch?.[1]);
    if (norm.error) throw norm.error;
    if (norm.noData) {
      const pageNo = params.pageNo !== undefined ? Number(params.pageNo) : 1;
      return { totalCount: 0, pageNo, items: [] };
    }
    throw new Error(`data.go.kr 응답을 처리할 수 없습니다 (resultCode=${code}).`);
  }
  const snippet = text.trim().slice(0, 200);
  throw new Error(`data.go.kr 응답을 JSON으로 해석할 수 없습니다: ${snippet}`);
}

export async function callOperation(
  config: AppConfig,
  operation: string,
  params: Record<string, ParamValue>,
  deps: CallDeps = {},
): Promise<OperationResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 10_000;
  const url = buildUrl(config, operation, params);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchFn(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`data.go.kr HTTP ${res.status} 오류 (operation=${operation})`);
  }

  const text = await res.text();
  let json: RawApiResponse;
  try {
    json = JSON.parse(text) as RawApiResponse;
  } catch {
    return handleNonJsonBody(text, params);
  }

  const header = json.response?.header;
  const norm = normalizeResultCode(
    header?.resultCode ?? "",
    header?.resultMsg,
  );
  if (norm.error) throw norm.error;

  const body = json.response.body;
  return {
    totalCount: body?.totalCount ?? 0,
    pageNo: body?.pageNo ?? 1,
    items: norm.noData ? [] : extractItems(body),
  };
}
