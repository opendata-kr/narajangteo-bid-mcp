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
import {
  basisAmountInputShape,
  runBasisAmount,
  type BasisAmountArgs,
} from "./tools/basisAmount.js";
import {
  evaluationInputShape,
  runEvaluation,
  type EvaluationArgs,
} from "./tools/evaluation.js";
import {
  changeHistoryInputShape,
  runChangeHistory,
  type ChangeHistoryArgs,
} from "./tools/changeHistory.js";
import {
  eligibilityInputShape,
  runEligibility,
  type EligibilityArgs,
} from "./tools/eligibility.js";
import {
  itemsInputShape,
  runItems,
  type ItemsArgs,
} from "./tools/items.js";
import {
  attachmentsInputShape,
  runAttachments,
  type AttachmentsArgs,
} from "./tools/attachments.js";

function textResult(payload: unknown, isError = false) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

// 인증계열 에러 + 사전인코딩 키 의심 시 Decoding 키 회복 안내를 덧붙인다.
function errorText(err: unknown, client: DataGoKrClient) {
  const msg = err instanceof Error ? err.message : String(err);
  const preEncoded = client.serviceKeyLooksPreEncoded === true;
  const authish = /\[3\d\]|SERVICE_KEY|인증|IP/i.test(msg);
  const hint = preEncoded && authish
    ? " (인증 실패 시 Encoding 키의 이중 인코딩일 수 있습니다. data.go.kr의 Decoding 인증키를 SERVICE_KEY로 사용하세요.)"
    : "";
  return textResult({ error: msg + hint }, true);
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
        "나라장터 입찰공고를 키워드·기간·기관·지역·업종·추정가격으로 검색한다. 조건에 맞는 공고 목록을 찾을 때 쓴다. 공고번호를 이미 아는 단건 상세는 get_bid_notice를 쓴다. 업무구분 미지정 시 기타(etc) 제외 4구분(공사/용역/물품/외자)을 병렬 검색하며, 기타공고 조회는 bidKind에 etc를 명시한다.",
      inputSchema: searchInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await runSearch(client, args as SearchArgs);
        return textResult(result);
      } catch (err) {
        return errorText(err, client);
      }
    },
  );

  server.registerTool(
    "get_bid_notice",
    {
      title: "입찰공고 단건 조회",
      description:
        "입찰공고번호로 단건 공고의 상세를 조회한다. 공고번호를 이미 알 때 쓴다. 조건으로 공고를 찾을 때는 search_bid_notices를 쓴다. 업무구분을 지정하면 해당 구분만, 미지정 시 기타(etc) 제외 4구분(공사/용역/물품/외자)을 차례로 조회하며, 기타공고 조회는 bidKind에 etc를 명시한다.",
      inputSchema: getNoticeInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const result = await runGetNotice(client, args as GetNoticeArgs);
        return textResult(result);
      } catch (err) {
        return errorText(err, client);
      }
    },
  );

  server.registerTool(
    "get_bid_basis_amount",
    {
      title: "기초금액 조회",
      description:
        "입찰공고번호로 기초금액·평가기준금액·예비가격범위율을 조회한다. 예정가격 산정의 기준값이 필요할 때 쓴다. 산식A 합산항목·평가주력분야는 get_bid_evaluation, 참가자격은 get_bid_eligibility를 쓴다. 기초금액은 물품·공사·용역 3구분만 존재하며(외자·기타 없음), bidKind 지정 시 해당 구분만, 미지정 시 3구분을 병렬 조회한다.",
      inputSchema: basisAmountInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return textResult(await runBasisAmount(client, args as BasisAmountArgs));
      } catch (err) {
        return errorText(err, client);
      }
    },
  );

  server.registerTool(
    "get_bid_evaluation",
    {
      title: "낙찰가산식·평가주력분야 조회",
      description:
        "입찰공고번호로 낙찰가 산정 산식A(국민연금·건강보험료 등 합산항목)와 평가대상 주력분야를 조회한다. 예정가격결정방법과 항목별 금액이 필요할 때 쓴다. 기초금액은 get_bid_basis_amount, 참가자격은 get_bid_eligibility, 변경이력은 get_bid_change_history를 쓴다. 업무구분 구분 없이 단일 조회하며, 결과는 priceFormula(산식A)·targetField(평가주력분야) 두 키로 구분된다.",
      inputSchema: evaluationInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return textResult(await runEvaluation(client, args as EvaluationArgs));
      } catch (err) {
        return errorText(err, client);
      }
    },
  );

  server.registerTool(
    "get_bid_change_history",
    {
      title: "공고 변경이력 조회",
      description:
        "입찰공고번호로 공고의 변경이력(정정·변경 항목, 변경 전/후 값)을 조회한다. 공고 내용이 사후에 어떻게 바뀌었는지 확인할 때 쓴다. 기초금액은 get_bid_basis_amount, 참가자격은 get_bid_eligibility를 쓴다. 변경이력은 물품·공사·용역 3구분만 존재하며(외자·기타 없음), bidKind 지정 시 해당 구분만, 미지정 시 3구분을 병렬 조회한다. 변경 이력이 없는 공고는 빈 결과를 반환한다.",
      inputSchema: changeHistoryInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return textResult(await runChangeHistory(client, args as ChangeHistoryArgs));
      } catch (err) {
        return errorText(err, client);
      }
    },
  );

  server.registerTool(
    "get_bid_eligibility",
    {
      title: "면허제한·참가가능지역 조회",
      description:
        "입찰공고번호와 공고차수로 면허제한과 참가가능지역을 조회한다. 투찰 가능 여부(면허·지역 조건)를 확인할 때 쓴다. 기초금액은 get_bid_basis_amount, 변경이력은 get_bid_change_history를 쓴다. 면허제한·참가가능지역은 공고차수(bidNtceOrd) 단위로 갈리므로 get_bid_notice 결과의 bidNtceOrd를 넘겨야 정확하며, 미지정 시 000(최초 차수)으로 조회한다.",
      inputSchema: eligibilityInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return textResult(await runEligibility(client, args as EligibilityArgs));
      } catch (err) {
        return errorText(err, client);
      }
    },
  );

  server.registerTool(
    "get_bid_items",
    {
      title: "구매대상물품 조회",
      description:
        "입찰공고번호와 공고차수로 구매대상물품(품명·수량·단가·납품장소 등)을 조회한다. 공고에 포함된 물품 내역이 필요할 때 쓴다. 기초금액은 get_bid_basis_amount, 참가자격은 get_bid_eligibility를 쓴다. 구매대상물품은 물품·용역·외자 3구분만 존재하며(공사는 없음), bidKind 지정 시 해당 구분만, 미지정 시 3구분을 병렬 조회한다. 차수(bidNtceOrd)는 get_bid_notice에서 확인해 넘기며, 미지정 시 000으로 조회한다.",
      inputSchema: itemsInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return textResult(await runItems(client, args as ItemsArgs));
      } catch (err) {
        return errorText(err, client);
      }
    },
  );

  server.registerTool(
    "get_bid_attachments",
    {
      title: "첨부파일 조회",
      description:
        "입찰공고번호로 e발주 첨부파일과 혁신장터 최종제안요청서(RFP) 첨부파일의 파일명·URL을 조회한다. 공고에 첨부된 파일 목록·다운로드 URL이 필요할 때 쓴다. 기초금액·참가자격 등 다른 세부정보는 get_bid_basis_amount·get_bid_eligibility를 쓴다. 대부분 공고는 첨부파일이 비어 있으며, 파일 자체를 내려받지 않고 URL만 반환한다.",
      inputSchema: attachmentsInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return textResult(await runAttachments(client, args as AttachmentsArgs));
      } catch (err) {
        return errorText(err, client);
      }
    },
  );

  return server;
}
