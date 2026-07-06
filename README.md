<!-- mcp-name: io.github.opendata-kr/narajangteo-bid-mcp -->

# @opendata-kr/narajangteo-bid-mcp

나라장터 입찰공고정보서비스(공공데이터포털 data.go.kr) Open API를 감싼 로컬 MCP 서버.

[![npm version](https://img.shields.io/npm/v/@opendata-kr/narajangteo-bid-mcp)](https://www.npmjs.com/package/@opendata-kr/narajangteo-bid-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Claude Desktop 등 MCP 클라이언트에서 입찰공고를 자연어로 검색하고 조회한다. 예를 들어 이렇게 물어볼 수 있다.

- "이번 주 올라온 용역 입찰 공고를 찾아줘"
- "인천광역시에서 추정가격 5억 원 이상인 공사 입찰을 검색해줘"
- "입찰공고번호 R25BK00932003 상세를 알려줘"

## 특징

- **4개 업무구분 병렬 검색**: 공사/용역/물품/외자를 한 번에 조회한다. 업무구분 미지정 시 전 구분을 동시 검색한다.
- **부분 실패 표면화**: 일부 구분 조회가 실패해도 나머지 결과를 반환하고, 실패한 구분은 오류 메시지로 드러낸다(조용한 누락 없음).
- **data.go.kr 에러코드 한국어화**: 인증키 만료, 트래픽 초과 등 결과코드를 조치 가능한 한국어 메시지로 정규화한다.
- **이중 인코딩 방어**: Encoding 키를 잘못 넣으면 경고하고, 요청은 한 번만 인코딩한다.
- **타임아웃**: API 호출에 타임아웃을 둔다.

## 준비물

- **Node.js 24** 이상 (`.nvmrc` = `lts/krypton`).
- **data.go.kr 인증키**:
  1. [공공데이터포털](https://www.data.go.kr)에서 "나라장터 입찰공고정보서비스"를 활용신청한다.
  2. 마이페이지 인증키 정보에서 **Decoding 서비스키**를 확인한다.
  3. 같은 `DATA_GO_KR_SERVICE_KEY`는 같은 계정으로 활용신청한 다른 data.go.kr API에도 재사용된다.

> 서비스키는 반드시 **Decoding(원본)** 키를 넣는다. Encoding(`%2B` 등 포함) 키를 넣으면 이중 인코딩으로 인증 오류(코드 30)가 난다.

## MCP 클라이언트 설정

이 서버는 **로컬 stdio** MCP 서버다. 대부분의 MCP 클라이언트에서 아래 서버 정의를 등록하고 재시작한 뒤 "이번 주 용역 입찰 찾아줘"처럼 요청하면 된다. 원격(HTTPS) 전용 클라이언트(ChatGPT 등)는 맨 아래 "원격 전용 클라이언트" 항목을 본다.

**공통 서버 정의** (모든 클라이언트가 공유하는 핵심):

```json
{
  "command": "npx",
  "args": ["-y", "@opendata-kr/narajangteo-bid-mcp"],
  "env": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" }
}
```

이 정의를 클라이언트마다 최상위 키 아래에 넣는다. **키 이름과 형식이 다르며, 틀리면 조용히 로드에 실패한다.**

| 클라이언트 | 형식 / 최상위 키 | 설정 경로 또는 추가 방법 |
|---|---|---|
| Claude Desktop | JSON `mcpServers` | `claude_desktop_config.json` |
| Claude Code | JSON `mcpServers` | CLI `claude mcp add` 또는 `.mcp.json` |
| Cursor | JSON `mcpServers` | `~/.cursor/mcp.json` 또는 원클릭 딥링크 |
| Windsurf | JSON `mcpServers` | `~/.codeium/windsurf/mcp_config.json` |
| Gemini CLI | JSON `mcpServers` | `~/.gemini/settings.json` |
| VS Code (Copilot) | JSON `servers` | `.vscode/mcp.json` 또는 CLI `code --add-mcp` |
| Zed | JSON `context_servers` | `~/.config/zed/settings.json` |
| Continue | JSON `mcpServers` (배열) | Continue 설정 |
| Codex (OpenAI) | TOML `[mcp_servers.<name>]` | `~/.codex/config.toml` 또는 CLI `codex mcp add` |
| Antigravity, JetBrains/Eclipse/Xcode Copilot | IDE UI | 각 IDE의 MCP 설정 화면(원클릭) |

### CLI와 원클릭 (손편집 없이)

Claude Code:

```bash
claude mcp add --env DATA_GO_KR_SERVICE_KEY=발급받은_Decoding_키 narajangteo-bid -- npx -y @opendata-kr/narajangteo-bid-mcp
```

Codex:

```bash
codex mcp add narajangteo-bid --env DATA_GO_KR_SERVICE_KEY=발급받은_Decoding_키 -- npx -y @opendata-kr/narajangteo-bid-mcp
```

VS Code:

```bash
code --add-mcp '{"name":"narajangteo-bid","command":"npx","args":["-y","@opendata-kr/narajangteo-bid-mcp"],"env":{"DATA_GO_KR_SERVICE_KEY":"발급받은_Decoding_키"}}'
```

Cursor: 문서의 "Add to Cursor" 버튼 또는 딥링크 `cursor://anysphere.cursor-deeplink/mcp/install`(공통 서버 정의를 base64로 인코딩).

### 설정 파일 직접 편집

`mcpServers` 객체 계열 (Claude Desktop, Cursor, Windsurf, Gemini CLI):

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

<details>
<summary>VS Code (servers), Zed (context_servers), Codex (TOML)</summary>

VS Code `.vscode/mcp.json`:

```json
{
  "servers": {
    "narajangteo-bid": {
      "command": "npx",
      "args": ["-y", "@opendata-kr/narajangteo-bid-mcp"],
      "env": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" }
    }
  }
}
```

Zed `~/.config/zed/settings.json` (스키마는 Zed 버전에 따라 다를 수 있으니 Zed 공식 문서를 확인):

```json
{
  "context_servers": {
    "narajangteo-bid": {
      "command": { "path": "npx", "args": ["-y", "@opendata-kr/narajangteo-bid-mcp"] },
      "env": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" }
    }
  }
}
```

Codex `~/.codex/config.toml`:

```toml
[mcp_servers.narajangteo-bid]
command = "npx"
args = ["-y", "@opendata-kr/narajangteo-bid-mcp"]
env = { DATA_GO_KR_SERVICE_KEY = "발급받은_Decoding_키" }
```

</details>

### Windows

`command`를 `cmd`로 바꾸고 `args` 앞에 `/c`를 둔다.

```json
{ "command": "cmd", "args": ["/c", "npx", "-y", "@opendata-kr/narajangteo-bid-mcp"], "env": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" } }
```

### 원격 전용 클라이언트 (ChatGPT 등)

ChatGPT Developer Mode처럼 **원격(HTTPS) MCP만 지원하는 클라이언트**는 로컬 stdio 서버를 직접 붙일 수 없다. `mcp-remote`로 이 서버를 감싸 HTTPS로 노출한 뒤 그 URL을 커넥터로 등록한다.

### 발견성

이 서버는 MCP 레지스트리에 `io.github.opendata-kr/narajangteo-bid-mcp`로 기술된다. [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io)를 지원하는 클라이언트에서 검색·설치할 수 있다.

## 환경변수

| 환경변수 | 필수 | 비밀 | 기본값 | 설명 |
|---|---|---|---|---|
| `DATA_GO_KR_SERVICE_KEY` | 예 | 예 | (없음) | 공공데이터포털 **Decoding(원본)** 인증키 |
| `DATA_GO_KR_BASE_URL` | 아니오 | 아니오 | `https://apis.data.go.kr` | 게이트웨이 base 오버라이드 |

## 도구

두 도구 모두 읽기 전용 조회다.

### `search_bid_notices`

키워드, 기간, 기관, 지역, 업종, 추정가격으로 입찰공고를 검색한다. 업무구분 미지정 시 공사/용역/물품/외자를 병렬 검색한다.

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

반환: `{ query, results }`. `results`는 업무구분별로 `{ totalCount, items }`를, 실패 시 해당 구분에 `{ error }`를 담는다.

### `get_bid_notice`

입찰공고번호로 단건 조회한다. 업무구분 미지정 시 전 구분에서 찾는다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호 (예: `R25BK00932003`). 필수 |
| `bidKind` | `string` | 업무구분. 미지정 시 전 구분에서 조회 |

반환: `{ found, bidKind, notice, searchedKinds }`. 찾으면 `found: true`와 `notice`(아래 응답 필드), 못 찾으면 `found: false`.

## 응답 필드 (`BidNotice`)

`bidNtceNo`(공고번호), `bidNtceNm`(공고명), `ntceInsttNm`(공고기관), `dminsttNm`(수요기관), `bidNtceDt`(공고일시), `bidClseDt`(마감일시), `opengDt`(개찰일시), `presmptPrce`(추정가격), `bidNtceDtlUrl`(상세 URL).

## 개발

```bash
nvm use            # Node 24
pnpm install
pnpm test          # vitest
pnpm typecheck     # tsc --noEmit
pnpm build         # tsup, dist/ 생성
```

## 문제 해결

- **인증 오류(코드 30)**: Encoding 키를 넣으면 이중 인코딩으로 실패한다. **Decoding(원본)** 키를 쓴다. 서버가 시작 시 Encoding 키로 보이면 경고 로그를 남긴다.
- **결과코드 메시지**: 트래픽 초과, 인증키 만료 등 data.go.kr 결과코드는 한국어 메시지로 정규화되어 반환된다.
- **도구 동작 점검**: MCP inspector로 직접 호출해 볼 수 있다.

  ```bash
  npx @modelcontextprotocol/inspector npx -y @opendata-kr/narajangteo-bid-mcp
  ```

## 라이선스

[MIT](./LICENSE)
