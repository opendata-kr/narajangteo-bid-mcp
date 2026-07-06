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
});
