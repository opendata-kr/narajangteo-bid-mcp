import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config.js";
import { BidApiError } from "./errors.js";
import { buildUrl, callOperation } from "./client.js";

const config: AppConfig = {
  serviceKey: "raw+key/with=special",
  baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
  looksPreEncoded: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/xml" },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });
}

describe("buildUrl", () => {
  it("서비스키를 정확히 한 번만 인코딩한다", () => {
    const url = buildUrl(config, "getBidPblancListInfoCnstwkPPSSrch", {
      pageNo: 1,
      numOfRows: 10,
    });
    // '+' '/' '=' 가 인코딩됨
    expect(url).toContain("ServiceKey=raw%2Bkey%2Fwith%3Dspecial");
    expect(url).toContain("type=json");
    expect(url).toContain(
      "/BidPublicInfoService/getBidPblancListInfoCnstwkPPSSrch?",
    );
  });

  it("undefined 파라미터는 생략한다", () => {
    const url = buildUrl(config, "op", { pageNo: 1, keyword: undefined });
    expect(url).not.toContain("keyword");
  });
});

describe("callOperation", () => {
  it("정상 응답에서 items를 추출한다", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        response: {
          header: { resultCode: "00", resultMsg: "정상" },
          body: {
            totalCount: 1,
            numOfRows: 10,
            pageNo: 1,
            items: [{ bidNtceNo: "R1" }],
          },
        },
      }),
    );
    const r = await callOperation(config, "op", {}, { fetchFn });
    expect(r.totalCount).toBe(1);
    expect(r.items[0]!.bidNtceNo).toBe("R1");
  });

  it("데이터없음(03)은 빈 배열로 정상 반환", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        response: {
          header: { resultCode: "03", resultMsg: "데이터 없음" },
          body: { totalCount: 0, numOfRows: 10, pageNo: 1, items: "" },
        },
      }),
    );
    const r = await callOperation(config, "op", {}, { fetchFn });
    expect(r.items).toEqual([]);
    expect(r.totalCount).toBe(0);
  });

  it("에러코드(22)는 BidApiError를 던진다", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        response: {
          header: { resultCode: "22", resultMsg: "LIMIT" },
          body: { totalCount: 0, numOfRows: 0, pageNo: 1, items: "" },
        },
      }),
    );
    await expect(callOperation(config, "op", {}, { fetchFn })).rejects.toThrow(
      BidApiError,
    );
  });

  it("HTTP 오류는 에러를 던진다", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, 500));
    await expect(
      callOperation(config, "op", {}, { fetchFn }),
    ).rejects.toThrow(/500/);
  });

  it("HTTP 200이지만 XML 에러 응답(서비스키 미등록)은 BidApiError를 던진다", async () => {
    const fetchFn = vi.fn(async () =>
      xmlResponse(
        "<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>30</returnReasonCode>" +
          "<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>" +
          "<errMsg>SERVICE ERROR</errMsg></cmmMsgHeader></OpenAPI_ServiceResponse>",
      ),
    );
    const err = await callOperation(config, "op", {}, { fetchFn }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(BidApiError);
    expect((err as Error).message).toMatch(/서비스키/);
  });

  it("HTTP 200이지만 JSON으로 해석 불가한 평문 응답은 스니펫을 포함한 에러를 던진다", async () => {
    const fetchFn = vi.fn(async () => textResponse("Service Unavailable"));
    await expect(
      callOperation(config, "op", {}, { fetchFn }),
    ).rejects.toThrow(/JSON으로 해석할 수 없습니다.*Service Unavailable/);
  });
});
