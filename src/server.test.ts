import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import type { DataGoKrClient } from "@opendata-kr/core";
import { createServer } from "./server.js";

const gatewayClient: DataGoKrClient = {
  serviceKeyLooksPreEncoded: false,
  call: vi.fn(),
};

// 핸들러 catch → errorText 경계를 검증하기 위한 client.
// call을 동기 throw로 둬야 runOps의 .map 도중 예외가 전파돼 핸들러 catch에 닿는다.
// (async 거부는 runOps의 Promise.allSettled가 per-op {status:"error"}로 흡수해 catch에 닿지 않는다.)
function throwingClient(
  serviceKeyLooksPreEncoded: boolean,
  err: Error,
): DataGoKrClient {
  return {
    serviceKeyLooksPreEncoded,
    call: (): never => {
      throw err;
    },
  };
}

async function callTool(client: DataGoKrClient, name: string, args: unknown) {
  const server = createServer(client);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    mcpClient.connect(clientTransport),
  ]);
  try {
    return await mcpClient.callTool({ name, arguments: args as Record<string, unknown> });
  } finally {
    await mcpClient.close();
    await server.close();
  }
}

describe("createServer", () => {
  it("McpServer 인스턴스를 생성한다", () => {
    const server = createServer(gatewayClient);
    expect(server).toBeDefined();
    // McpServer는 connect 메서드를 가진다
    expect(typeof server.connect).toBe("function");
  });

  it("8개 도구를 모두 등록한다(핸드셰이크)", async () => {
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
      ]),
    );
    expect(names.length).toBe(8);

    await client.close();
    await server.close();
  });
});

describe("errorText 회복 메시지", () => {
  const AUTH_ERR = new Error("[30] SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
  const NON_AUTH_ERR = new Error("타임아웃");

  it("사전인코딩 키 + 인증계열 에러면 Decoding 키 안내를 덧붙인다", async () => {
    const res = await callTool(
      throwingClient(true, AUTH_ERR),
      "get_bid_basis_amount",
      { bidNtceNo: "R25BK00932003" },
    );
    expect(res.isError).toBe(true);
    const text = (res.content as { type: string; text: string }[])[0]!.text;
    expect(text).toContain("Decoding 인증키");
    expect(text).toContain(AUTH_ERR.message);
  });

  it("사전인코딩 아님 + 인증계열 에러면 힌트를 붙이지 않는다", async () => {
    const res = await callTool(
      throwingClient(false, AUTH_ERR),
      "get_bid_basis_amount",
      { bidNtceNo: "R25BK00932003" },
    );
    expect(res.isError).toBe(true);
    const text = (res.content as { type: string; text: string }[])[0]!.text;
    expect(text).toContain(AUTH_ERR.message);
    expect(text).not.toContain("Decoding 인증키");
  });

  it("사전인코딩 키 + 비인증 에러면 힌트를 붙이지 않는다", async () => {
    const res = await callTool(
      throwingClient(true, NON_AUTH_ERR),
      "get_bid_basis_amount",
      { bidNtceNo: "R25BK00932003" },
    );
    expect(res.isError).toBe(true);
    const text = (res.content as { type: string; text: string }[])[0]!.text;
    expect(text).toContain(NON_AUTH_ERR.message);
    expect(text).not.toContain("Decoding 인증키");
  });
});
