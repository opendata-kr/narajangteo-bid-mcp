import { describe, expect, it } from "vitest";
import type { AppConfig } from "./config.js";
import { createServer } from "./server.js";

const config: AppConfig = {
  serviceKey: "k",
  baseUrl: "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
  looksPreEncoded: false,
};

describe("createServer", () => {
  it("McpServer 인스턴스를 생성한다", () => {
    const server = createServer(config);
    expect(server).toBeDefined();
    // McpServer는 connect 메서드를 가진다
    expect(typeof server.connect).toBe("function");
  });
});
