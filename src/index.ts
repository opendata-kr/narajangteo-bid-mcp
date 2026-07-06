import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * 나라장터 입찰공고정보서비스 MCP 서버 엔트리.
 *
 * 스캐폴딩 단계의 최소 부트 스텁이다. tool 등록(search_bid_notices,
 * get_bid_notice)과 config/api 계층은 구현 계획에서 채운다.
 */
async function main(): Promise<void> {
  const server = new McpServer({
    name: "bid-public-info-service-mcp",
    version: "0.0.0",
  });

  // TODO(구현 계획): config 로드 + tools/ 등록

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  // stdio 트랜스포트에서 stdout은 JSON-RPC 전용이므로 로그는 stderr로.
  console.error("[bid-public-info-service-mcp] fatal:", err);
  process.exit(1);
});
