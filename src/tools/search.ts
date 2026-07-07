import { z } from "zod";
import type { DataGoKrClient, OperationResult } from "@opendata-kr/core";
import {
  ALL_BID_KINDS,
  type BidKind,
  searchOperation,
} from "../api/endpoints.js";
import { formatItems } from "../format.js";
import type { BidNotice } from "../api/types.js";

// SDK 1.29.0 registerTool의 inputSchema는 ZodRawShape 형태다.
export const searchInputShape = {
  bidKind: z
    .array(z.enum(["cnstwk", "servc", "thng", "frgcpt"]))
    .optional()
    .describe(
      "업무구분 배열(cnstwk=공사, servc=용역, thng=물품, frgcpt=외자). 미지정 시 전 구분 병렬 검색",
    ),
  keyword: z.string().optional().describe("공고명 부분 검색"),
  startDate: z.string().optional().describe("공고게시 시작일 YYYYMMDD"),
  endDate: z.string().optional().describe("공고게시 종료일 YYYYMMDD"),
  institution: z.string().optional().describe("공고/수요 기관명"),
  region: z.string().optional().describe("참가 지역명 (예: 인천광역시)"),
  industry: z.string().optional().describe("업종명"),
  minPrice: z.number().optional().describe("추정가격 하한(원)"),
  maxPrice: z.number().optional().describe("추정가격 상한(원)"),
  page: z.number().int().min(1).optional().describe("페이지 번호(기본 1)"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("페이지당 건수(기본 10)"),
};

export type SearchArgs = {
  bidKind?: BidKind[];
  keyword?: string;
  startDate?: string;
  endDate?: string;
  institution?: string;
  region?: string;
  industry?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
};

type KindResult =
  | { totalCount: number; items: BidNotice[] }
  | { error: string };

export interface SearchResult {
  query: SearchArgs;
  results: Partial<Record<BidKind, KindResult>>;
}

export async function runSearch(
  client: DataGoKrClient,
  args: SearchArgs,
): Promise<SearchResult> {
  const kinds = args.bidKind ?? [...ALL_BID_KINDS];

  const params: Record<string, string | number | undefined> = {
    pageNo: args.page ?? 1,
    numOfRows: args.pageSize ?? 10,
    bidNtceNm: args.keyword,
    ntceInsttNm: args.institution,
    prtcptLmtRgnNm: args.region,
    indstrytyNm: args.industry,
    presmptPrceBgn: args.minPrice,
    presmptPrceEnd: args.maxPrice,
  };
  if (args.startDate || args.endDate) {
    params.inqryDiv = "1";
    if (args.startDate) params.inqryBgnDt = `${args.startDate}0000`;
    if (args.endDate) params.inqryEndDt = `${args.endDate}2359`;
  }

  const settled = await Promise.allSettled(
    kinds.map((kind) => client.call(searchOperation(kind), { ...params })),
  );

  const results: Partial<Record<BidKind, KindResult>> = {};
  kinds.forEach((kind, i) => {
    const s = settled[i]!;
    if (s.status === "fulfilled") {
      const op: OperationResult = s.value;
      results[kind] = {
        totalCount: op.totalCount,
        items: formatItems(op.items),
      };
    } else {
      const reason = s.reason;
      results[kind] = {
        error: reason instanceof Error ? reason.message : String(reason),
      };
    }
  });

  return { query: args, results };
}
