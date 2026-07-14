import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "./version.js";
import type { DataGoKrClient } from "@opendata-kr/core";
import { guard, READONLY } from "@opendata-kr/core";
import { getNoticeInputShape, runGetNotice } from "./tools/getNotice.js";
import { runSearch, searchInputShape } from "./tools/search.js";
import { basisAmountInputShape, runBasisAmount } from "./tools/basisAmount.js";
import { evaluationInputShape, runEvaluation } from "./tools/evaluation.js";
import { changeHistoryInputShape, runChangeHistory } from "./tools/changeHistory.js";
import { eligibilityInputShape, runEligibility } from "./tools/eligibility.js";
import { itemsInputShape, runItems } from "./tools/items.js";
import { attachmentsInputShape, runAttachments } from "./tools/attachments.js";
import {
  downloadAttachmentsInputShape,
  downloadAttachmentsDescription,
  runDownloadAttachments,
} from "./tools/downloadAttachments.js";
import {
  readAttachmentInputShape,
  readAttachmentDescription,
  runReadAttachment,
} from "./tools/readAttachment.js";

export function createServer(client: DataGoKrClient): McpServer {
  const server = new McpServer({
    name: "narajangteo-bid-mcp",
    version: VERSION,
  });

  server.registerTool(
    "search_bid_notices",
    {
      title: "입찰공고 검색",
      description:
        "나라장터 입찰공고를 키워드·기간·기관·지역·업종·추정가격으로 검색한다. 조건에 맞는 공고 목록을 찾을 때 쓴다. 공고번호를 이미 아는 단건 상세는 get_bid_notice를 쓴다. 업무구분 미지정 시 기타(etc) 제외 4구분(공사/용역/물품/외자)을 병렬 검색하며(API 요청 4건 소모, 구분을 알면 bidKind 지정), 기타공고 조회는 bidKind에 etc를 명시한다.",
      inputSchema: searchInputShape,
      annotations: READONLY,
    },
    (args) => guard(() => runSearch(client, args)),
  );

  server.registerTool(
    "get_bid_notice",
    {
      title: "입찰공고 단건 조회",
      description:
        "입찰공고번호로 단건 공고의 상세를 조회한다. 공고번호를 이미 알 때 쓴다. 조건으로 공고를 찾을 때는 search_bid_notices를 쓴다. 업무구분을 지정하면 해당 구분만, 미지정 시 기타(etc) 제외 4구분(공사/용역/물품/외자)을 차례로 조회하며(API 요청 최대 4건, 구분을 알면 지정), 기타공고 조회는 bidKind에 etc를 명시한다.",
      inputSchema: getNoticeInputShape,
      annotations: READONLY,
    },
    (args) => guard(() => runGetNotice(client, args)),
  );

  server.registerTool(
    "get_bid_basis_amount",
    {
      title: "기초금액 조회",
      description:
        "입찰공고번호로 기초금액·평가기준금액·예비가격범위율을 조회한다. 예정가격 산정의 기준값이 필요할 때 쓴다. 산식A 합산항목·평가주력분야는 get_bid_evaluation, 참가자격은 get_bid_eligibility를 쓴다. 기초금액은 물품·공사·용역 3구분만 존재하며(외자·기타 없음), bidKind 지정 시 해당 구분만(요청 1건), 미지정 시 3구분을 병렬 조회한다(요청 3건).",
      inputSchema: basisAmountInputShape,
      annotations: READONLY,
    },
    (args) => guard(() => runBasisAmount(client, args)),
  );

  server.registerTool(
    "get_bid_evaluation",
    {
      title: "낙찰가산식·평가주력분야 조회",
      description:
        "입찰공고번호로 낙찰가 산정 산식A(국민연금·건강보험료 등 합산항목)와 평가대상 주력분야를 조회한다. 예정가격결정방법과 항목별 금액이 필요할 때 쓴다. 기초금액은 get_bid_basis_amount, 참가자격은 get_bid_eligibility, 변경이력은 get_bid_change_history를 쓴다. 업무구분 구분 없이 단일 조회하며, 결과는 priceFormula(산식A)·targetField(평가주력분야) 두 키로 구분된다.",
      inputSchema: evaluationInputShape,
      annotations: READONLY,
    },
    (args) => guard(() => runEvaluation(client, args)),
  );

  server.registerTool(
    "get_bid_change_history",
    {
      title: "공고 변경이력 조회",
      description:
        "입찰공고번호로 공고의 변경이력(정정·변경 항목, 변경 전/후 값)을 조회한다. 공고 내용이 사후에 어떻게 바뀌었는지 확인할 때 쓴다. 기초금액은 get_bid_basis_amount, 참가자격은 get_bid_eligibility를 쓴다. 변경이력은 물품·공사·용역 3구분만 존재하며(외자·기타 없음), bidKind 지정 시 해당 구분만(요청 1건), 미지정 시 3구분을 병렬 조회한다(요청 3건). 변경 이력이 없는 공고는 빈 결과를 반환한다.",
      inputSchema: changeHistoryInputShape,
      annotations: READONLY,
    },
    (args) => guard(() => runChangeHistory(client, args)),
  );

  server.registerTool(
    "get_bid_eligibility",
    {
      title: "면허제한·참가가능지역 조회",
      description:
        "입찰공고번호와 공고차수로 면허제한과 참가가능지역을 조회한다. 투찰 가능 여부(면허·지역 조건)를 확인할 때 쓴다. 기초금액은 get_bid_basis_amount, 변경이력은 get_bid_change_history를 쓴다. 면허제한·참가가능지역은 공고차수(bidNtceOrd) 단위로 갈리므로 get_bid_notice 결과의 bidNtceOrd를 넘겨야 정확하며, 미지정 시 000(최초 차수)으로 조회한다.",
      inputSchema: eligibilityInputShape,
      annotations: READONLY,
    },
    (args) => guard(() => runEligibility(client, args)),
  );

  server.registerTool(
    "get_bid_items",
    {
      title: "구매대상물품 조회",
      description:
        "입찰공고번호와 공고차수로 구매대상물품(품명·수량·단가·납품장소 등)을 조회한다. 공고에 포함된 물품 내역이 필요할 때 쓴다. 기초금액은 get_bid_basis_amount, 참가자격은 get_bid_eligibility를 쓴다. 구매대상물품은 물품·용역·외자 3구분만 존재하며(공사는 없음), bidKind 지정 시 해당 구분만(요청 1건), 미지정 시 3구분을 병렬 조회한다(요청 3건). 차수(bidNtceOrd)는 get_bid_notice에서 확인해 넘기며, 미지정 시 000으로 조회한다.",
      inputSchema: itemsInputShape,
      annotations: READONLY,
    },
    (args) => guard(() => runItems(client, args)),
  );

  server.registerTool(
    "get_bid_attachments",
    {
      title: "첨부파일 조회",
      description:
        "입찰공고번호로 그 공고의 첨부파일 파일명·다운로드 URL을 조회한다. 공고 본문 규격첨부(공고문·규격서·제안요청서·과업지시서 등)를 주 소스로, e발주·혁신장터RFP 첨부를 함께 반환한다(results.notice·eorder·innovationRfp). 첨부의 URL만 필요할 때 쓴다. 파일을 내려받아 목록(매니페스트)을 얻으려면 download_attachments를, 특정 파일의 본문 텍스트를 읽으려면 read_attachment를 쓴다. 기초금액·참가자격 등 다른 세부정보는 get_bid_basis_amount·get_bid_eligibility를 쓴다. 파일 자체는 내려받지 않고 URL만 반환한다. 한 호출이 공고 구분 해소(최대 5건)와 첨부 오퍼레이션 2건, 합계 최대 7건의 API 요청을 소모한다.",
      inputSchema: attachmentsInputShape,
      annotations: READONLY,
    },
    (args) => guard(() => runAttachments(client, args)),
  );

  // 파일 저장 도구는 readOnlyHint:false 예외(디스크에 파일을 쓴다). 나머지 도구는 조회 전용.
  server.registerTool(
    "download_attachments",
    {
      title: "입찰공고 첨부 다운로드·파일 목록",
      description: downloadAttachmentsDescription,
      inputSchema: downloadAttachmentsInputShape,
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    (args) => guard(() => runDownloadAttachments(client, args)),
  );

  // read_attachment도 없는 파일은 그 파일만 내려받으므로 디스크를 바꿀 수 있다(readOnlyHint:false).
  server.registerTool(
    "read_attachment",
    {
      title: "첨부 본문 읽기",
      description: readAttachmentDescription,
      inputSchema: readAttachmentInputShape,
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    (args) => guard(() => runReadAttachment(client, args)),
  );

  return server;
}
