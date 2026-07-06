import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  if (config.looksPreEncoded) {
    console.error(
      "[narajangteo-bid-mcp] 경고: DATA_GO_KR_SERVICE_KEY에 %가 포함되어 이미 URL 인코딩된 키로 보입니다. Decoding(원본) 키를 사용하세요.",
    );
  }
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error("[narajangteo-bid-mcp] fatal:", err);
  process.exit(1);
});
