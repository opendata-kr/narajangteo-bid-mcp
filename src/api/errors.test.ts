import { describe, expect, it } from "vitest";
import { BidApiError, normalizeResultCode } from "./errors.js";

describe("normalizeResultCode", () => {
  it("00은 정상으로 본다", () => {
    const r = normalizeResultCode("00");
    expect(r.ok).toBe(true);
    expect(r.noData).toBe(false);
    expect(r.error).toBeUndefined();
  });

  it("03은 데이터 없음(에러 아님)으로 본다", () => {
    const r = normalizeResultCode("03");
    expect(r.ok).toBe(false);
    expect(r.noData).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it("22는 트래픽 초과 한국어 메시지를 준다", () => {
    const r = normalizeResultCode("22");
    expect(r.ok).toBe(false);
    expect(r.error).toBeInstanceOf(BidApiError);
    expect(r.error?.code).toBe("22");
    expect(r.error?.koreanMessage).toContain("한도");
  });

  it("30은 서비스키/인코딩 안내를 준다", () => {
    const r = normalizeResultCode("30");
    expect(r.error?.koreanMessage).toContain("서비스키");
  });

  it("알 수 없는 코드도 원문 메시지를 담아 에러로 만든다", () => {
    const r = normalizeResultCode("99", "PROVIDER_SPECIFIC");
    expect(r.error).toBeInstanceOf(BidApiError);
    expect(r.error?.koreanMessage).toContain("PROVIDER_SPECIFIC");
  });
});
