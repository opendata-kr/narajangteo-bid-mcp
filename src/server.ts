import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config.js";
import {
  getNoticeInputShape,
  runGetNotice,
  type GetNoticeArgs,
} from "./tools/getNotice.js";
import {
  runSearch,
  searchInputShape,
  type SearchArgs,
} from "./tools/search.js";

function textResult(payload: unknown, isError = false) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

export function createServer(config: AppConfig): McpServer {
  const server = new McpServer({
    name: "narajangteo-bid-mcp",
    version: "0.0.0",
  });

  server.registerTool(
    "search_bid_notices",
    {
      description:
        "나라장터 입찰공고를 검색한다. 키워드·기간·기관·지역·업종·추정가격으로 필터하며, 업무구분(공사/용역/물품/외자) 미지정 시 전체를 병렬 검색한다.",
      inputSchema: searchInputShape,
    },
    async (args) => {
      try {
        const result = await runSearch(config, args as SearchArgs);
        return textResult(result);
      } catch (err) {
        return textResult(
          { error: err instanceof Error ? err.message : String(err) },
          true,
        );
      }
    },
  );

  server.registerTool(
    "get_bid_notice",
    {
      description:
        "입찰공고번호로 단건 공고를 조회한다. 업무구분 미지정 시 전 구분에서 찾는다.",
      inputSchema: getNoticeInputShape,
    },
    async (args) => {
      try {
        const result = await runGetNotice(config, args as GetNoticeArgs);
        return textResult(result);
      } catch (err) {
        return textResult(
          { error: err instanceof Error ? err.message : String(err) },
          true,
        );
      }
    },
  );

  return server;
}
