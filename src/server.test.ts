import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { makeTestClient } from "./test-helpers.js";
import { createServer } from "./server.js";

const gatewayClient = makeTestClient({}).client;

describe("createServer", () => {
  it("McpServer 인스턴스를 생성한다", () => {
    const server = createServer(gatewayClient);
    expect(server).toBeDefined();
    // McpServer는 connect 메서드를 가진다
    expect(typeof server.connect).toBe("function");
  });

  it("9개 도구를 모두 등록한다(핸드셰이크)", async () => {
    const server = createServer(gatewayClient);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "1.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "search_bid_notices",
        "get_bid_notice",
        "get_bid_basis_amount",
        "get_bid_evaluation",
        "get_bid_change_history",
        "get_bid_eligibility",
        "get_bid_items",
        "get_bid_attachments",
        "download_attachments",
        "read_attachment",
      ]),
    );
    expect(names.length).toBe(10);

    await client.close();
    await server.close();
  });
});
