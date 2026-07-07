import { z } from "zod";
import type { DataGoKrClient } from "@opendata-kr/core";
import { searchOperation, type BidKind } from "../api/endpoints.js";
import { formatItem } from "../format.js";
import { runOps, type OpOutcome } from "../api/runOps.js";
import type { BidNotice } from "../api/types.js";

const DEFAULT_WINDOW_DAYS = 30; // 라이브 확정 대상
const YMD = /^\d{8}$/;

// etc 제외(옵트인). 기본 검색 집합.
const DEFAULT_KINDS: BidKind[] = ["cnstwk", "servc", "thng", "frgcpt"];

// SDK 1.29.0 registerTool의 inputSchema는 ZodRawShape 형태다.
export const searchInputShape = {
  bidKind: z
    .array(z.enum(["cnstwk", "servc", "thng", "frgcpt", "etc"]))
    .optional()
    .describe(
      "업무구분 배열(cnstwk=공사, servc=용역, thng=물품, frgcpt=외자, etc=기타). 미지정 시 기타 제외 4구분 병렬 검색",
    ),
  keyword: z.string().optional().describe("공고명 부분 검색(bidNtceNm)"),
  startDate: z
    .string()
    .optional()
    .describe("공고게시 시작일 YYYYMMDD. 미지정 시 최근 30일 자동 적용"),
  endDate: z.string().optional().describe("공고게시 종료일 YYYYMMDD"),
  institution: z
    .string()
    .optional()
    .describe("공고기관명(ntceInsttNm). 수요기관은 demandInstitution 사용"),
  demandInstitution: z.string().optional().describe("수요기관명(dminsttNm)"),
  region: z.string().optional().describe("참가제한지역명(prtcptLmtRgnNm)"),
  industry: z.string().optional().describe("업종명(indstrytyNm)"),
  minPrice: z.number().optional().describe("추정가격 하한(원, presmptPrceBgn)"),
  maxPrice: z.number().optional().describe("추정가격 상한(원, presmptPrceEnd)"),
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
  demandInstitution?: string;
  region?: string;
  industry?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
};

export interface SearchResult {
  query: SearchArgs;
  anySucceeded: boolean;
  results: Record<string, OpOutcome<BidNotice>>;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function parseYmd(s: string): Date {
  return new Date(
    Number(s.slice(0, 4)),
    Number(s.slice(4, 6)) - 1,
    Number(s.slice(6, 8)),
  );
}

function shiftYmd(s: string, days: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export async function runSearch(
  client: DataGoKrClient,
  args: SearchArgs,
): Promise<SearchResult> {
  if (args.startDate && !YMD.test(args.startDate))
    throw new Error("startDate 포맷은 YYYYMMDD");
  if (args.endDate && !YMD.test(args.endDate))
    throw new Error("endDate 포맷은 YYYYMMDD");

  const kinds = args.bidKind ?? DEFAULT_KINDS;

  // 앵커 기준 윈도우: 한쪽만 주면 그 날짜를 앵커로 30일 창을 채운다(역전 방지).
  let startDate = args.startDate;
  let endDate = args.endDate;
  if (startDate && !endDate) endDate = shiftYmd(startDate, DEFAULT_WINDOW_DAYS);
  else if (!startDate && endDate)
    startDate = shiftYmd(endDate, -DEFAULT_WINDOW_DAYS);
  else if (!startDate && !endDate) {
    const now = new Date();
    endDate = ymd(now);
    startDate = ymd(new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 86400000));
  }

  const params: Record<string, string | number | undefined> = {
    pageNo: args.page ?? 1,
    numOfRows: args.pageSize ?? 10,
    inqryDiv: "1", // 공고게시일시 (PPSSrch 필수)
    inqryBgnDt: `${startDate}0000`,
    inqryEndDt: `${endDate}2359`,
    bidNtceNm: args.keyword,
    ntceInsttNm: args.institution,
    dminsttNm: args.demandInstitution,
    prtcptLmtRgnNm: args.region,
    indstrytyNm: args.industry,
    presmptPrceBgn: args.minPrice,
    presmptPrceEnd: args.maxPrice,
  };

  const { results, anySucceeded } = await runOps(
    client,
    kinds.map((k) => ({ label: k, op: searchOperation(k), params })),
    formatItem,
  );
  return { query: args, anySucceeded, results };
}
