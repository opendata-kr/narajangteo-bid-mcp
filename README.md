# @opendata-kr/narajangteo-bid-mcp

나라장터 입찰공고정보서비스(공공데이터포털 data.go.kr) Open API를 감싼 로컬 MCP 서버.
Claude Desktop 등 MCP 클라이언트에서 입찰공고를 자연어로 검색하고 조회한다.

## 특징

- **4개 업무구분 병렬 검색**: 공사/용역/물품/외자를 한 번에 조회한다. 업무구분 미지정 시 전 구분을 동시 검색한다.
- **부분 실패 표면화**: 일부 구분 조회가 실패해도 나머지 결과를 반환하고, 실패한 구분은 오류 메시지로 드러낸다(조용한 누락 없음).
- **data.go.kr 에러코드 한국어화**: 인증키 만료, 트래픽 초과 등 결과코드를 조치 가능한 한국어 메시지로 정규화한다.
- **이중 인코딩 방어**: Encoding 키를 잘못 넣으면 경고하고, 요청은 한 번만 인코딩한다.
- **타임아웃**: API 호출 10초 타임아웃.

## 설치 및 인증

1. [공공데이터포털](https://www.data.go.kr)에서 "나라장터 입찰공고정보서비스"를 활용신청한다.
2. 마이페이지 인증키 정보에서 **Decoding 서비스키**를 확인한다.
3. MCP 클라이언트 설정에 서버를 등록한다(아래 예시).
4. 클라이언트를 재시작하고 "이번 주 용역 입찰 찾아줘"처럼 요청해 확인한다.

> 서비스키는 반드시 **Decoding(원본)** 키를 넣는다. Encoding(`%2B` 등 포함) 키를 넣으면
> 이중 인코딩으로 인증 오류(코드 30)가 난다.

같은 `DATA_GO_KR_SERVICE_KEY`는 같은 계정으로 활용신청한 다른 data.go.kr API에도 재사용된다.

### Claude Desktop 설정 (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "narajangteo-bid": {
      "command": "npx",
      "args": ["-y", "@opendata-kr/narajangteo-bid-mcp"],
      "env": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" }
    }
  }
}
```

다른 MCP 클라이언트도 동일하게 `npx -y @opendata-kr/narajangteo-bid-mcp`를 stdio 서버로
실행하고 `DATA_GO_KR_SERVICE_KEY` 환경변수를 전달하면 된다.

## Tools

### `search_bid_notices`

키워드, 기간, 기관, 지역, 업종, 추정가격으로 입찰공고를 검색한다.
업무구분 미지정 시 공사/용역/물품/외자를 병렬 검색한다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidKind` | `string[]` | 업무구분 배열: `cnstwk`(공사) `servc`(용역) `thng`(물품) `frgcpt`(외자). 미지정 시 전체 |
| `keyword` | `string` | 공고명 부분 검색 |
| `startDate` | `string` | 공고게시 시작일 `YYYYMMDD` |
| `endDate` | `string` | 공고게시 종료일 `YYYYMMDD` |
| `institution` | `string` | 공고/수요 기관명 |
| `region` | `string` | 참가 지역명 (예: 인천광역시) |
| `industry` | `string` | 업종명 |
| `minPrice` | `number` | 추정가격 하한(원) |
| `maxPrice` | `number` | 추정가격 상한(원) |
| `page` | `number` | 페이지 번호(기본 1) |
| `pageSize` | `number` | 페이지당 건수(기본 10, 최대 100) |

업무구분별로 `{ totalCount, items }`를, 실패 시 해당 구분에 `{ error }`를 반환한다.

### `get_bid_notice`

입찰공고번호로 단건 조회한다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호 (예: `R25BK00932003`). 필수 |
| `bidKind` | `string` | 업무구분. 미지정 시 전 구분에서 조회 |

## 응답 필드 (`BidNotice`)

`bidNtceNo`(공고번호), `bidNtceNm`(공고명), `ntceInsttNm`(공고기관), `dminsttNm`(수요기관),
`bidNtceDt`(공고일시), `bidClseDt`(마감일시), `opengDt`(개찰일시), `presmptPrce`(추정가격),
`bidNtceDtlUrl`(상세 URL).

## 개발

```bash
nvm use            # Node 24
pnpm install
pnpm test          # vitest
pnpm typecheck     # tsc --noEmit
pnpm build         # tsup, dist/ 생성
```

## 라이선스

MIT
