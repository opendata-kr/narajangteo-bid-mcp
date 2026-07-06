import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
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

  it("search_bid_notices와 get_bid_notice 두 툴을 등록한다", async () => {
    const server = createServer(config);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("search_bid_notices");
    expect(names).toContain("get_bid_notice");

    await client.close();
    await server.close();
  });
});
