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

  const json = (await res.json()) as RawApiResponse;
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
