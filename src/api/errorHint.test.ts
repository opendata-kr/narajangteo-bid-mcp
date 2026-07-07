import { describe, expect, it } from "vitest";
import { withKeyHint } from "./errorHint.js";

describe("withKeyHint", () => {
  it("사전인코딩 키 + HTTP 401이면 Decoding 힌트를 덧붙인다", () => {
    const msg = withKeyHint(
      { serviceKeyLooksPreEncoded: true },
      "data.go.kr HTTP 401 오류 (operation=x)",
    );
    expect(msg).toContain("data.go.kr HTTP 401 오류 (operation=x)");
    expect(msg).toContain("Decoding 인증키");
    expect(msg).toContain("DATA_GO_KR_SERVICE_KEY");
  });

  it("사전인코딩 아니면 힌트를 붙이지 않는다", () => {
    const msg = withKeyHint(
      { serviceKeyLooksPreEncoded: false },
      "data.go.kr HTTP 401 오류 (operation=x)",
    );
    expect(msg).toBe("data.go.kr HTTP 401 오류 (operation=x)");
  });

  it("사전인코딩이어도 인증계열 에러가 아니면 힌트를 붙이지 않는다", () => {
    const msg = withKeyHint({ serviceKeyLooksPreEncoded: true }, "타임아웃");
    expect(msg).toBe("타임아웃");
  });

  it("EPIPE 같은 문자열엔 힌트를 붙이지 않는다(IP 오매치 방지)", () => {
    const msg = withKeyHint(
      { serviceKeyLooksPreEncoded: true },
      "write EPIPE",
    );
    expect(msg).toBe("write EPIPE");
  });
});
