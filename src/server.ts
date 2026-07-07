import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DataGoKrClient } from "@opendata-kr/core";
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

export function createServer(client: DataGoKrClient): McpServer {
  const server = new McpServer({
    name: "narajangteo-bid-mcp",
    version: "0.0.0",
  });

  server.registerTool(
    "search_bid_notices",
    {
      title: "입찰공고 검색",
      description:
        "나라장터 입찰공고를 키워드·기간·기관·지역·업종·추정가격으로 검색한다. 조건에 맞는 공고 목록을 찾을 때 쓴다. 공고번호를 이미 아는 단건 상세는 get_bid_notice를 쓴다. 업무구분(공사/용역/물품/외자) 미지정 시 전 구분을 병렬 검색한다.",
      inputSchema: searchInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await runSearch(client, args as SearchArgs);
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
      title: "입찰공고 단건 조회",
      description:
        "입찰공고번호로 단건 공고의 상세를 조회한다. 공고번호를 이미 알 때 쓴다. 조건으로 공고를 찾을 때는 search_bid_notices를 쓴다. 업무구분을 지정하면 해당 구분만, 미지정 시 전 구분(공사/용역/물품/외자)을 차례로 조회한다.",
      inputSchema: getNoticeInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await runGetNotice(client, args as GetNoticeArgs);
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
