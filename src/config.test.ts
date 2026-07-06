import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("BID_SERVICE_KEY를 읽는다", () => {
    const c = loadConfig({ BID_SERVICE_KEY: "abc123" });
    expect(c.serviceKey).toBe("abc123");
    expect(c.baseUrl).toBe(
      "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
    );
  });

  it("키가 없으면 명확한 에러를 던진다", () => {
    expect(() => loadConfig({})).toThrow(/BID_SERVICE_KEY/);
  });

  it("이미 URL 인코딩된 키(%포함)는 그대로 두되 경고 대상으로 감지한다", () => {
    const c = loadConfig({ BID_SERVICE_KEY: "abc%2Bdef" });
    expect(c.serviceKey).toBe("abc%2Bdef");
    expect(c.looksPreEncoded).toBe(true);
  });
});
