<!-- mcp-name: io.github.opendata-kr/narajangteo-bid-mcp -->

# @opendata-kr/narajangteo-bid-mcp

나라장터 입찰공고정보서비스(공공데이터포털 data.go.kr) Open API를 감싼 로컬 MCP 서버.

[![npm version](https://img.shields.io/npm/v/@opendata-kr/narajangteo-bid-mcp)](https://www.npmjs.com/package/@opendata-kr/narajangteo-bid-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/opendata-kr/narajangteo-bid-mcp/ci.yml?branch=main&label=CI)](https://github.com/opendata-kr/narajangteo-bid-mcp/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/@opendata-kr/narajangteo-bid-mcp)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@opendata-kr/narajangteo-bid-mcp)](./LICENSE)

Claude Desktop 등 MCP 클라이언트에서 입찰공고를 자연어로 검색하고 조회한다. 예를 들어 이렇게 물어볼 수 있다.

- "이번 주 올라온 용역 입찰 공고를 찾아줘"
- "인천광역시에서 추정가격 5억 원 이상인 공사 입찰을 검색해줘"
- "입찰공고번호 R25BK00932003 상세를 알려줘"
- "그 공고의 기초금액과 참가 가능 지역을 알려줘"
- "그 공고에 첨부된 파일 목록을 보여줘"

## 특징

- **4개 업무구분 병렬 검색**: 공사/용역/물품/외자를 한 번에 조회한다. 업무구분 미지정 시 기타(etc)를 제외한 4구분(공사/용역/물품/외자)을 동시 검색하며, 기타공고는 `bidKind`에 `etc`를 명시한다.
- **부분 실패 표면화**: 일부 구분 조회가 실패해도 나머지 결과를 반환하고, 실패한 구분은 오류 메시지로 드러낸다(조용한 누락 없음).
- **data.go.kr 에러코드 한국어화**: 인증키 만료, 트래픽 초과 등 결과코드를 조치 가능한 한국어 메시지로 정규화한다.
- **이중 인코딩 방어**: Encoding 키를 잘못 넣으면 경고하고, 요청은 한 번만 인코딩한다.
- **타임아웃**: API 호출에 타임아웃을 둔다.

## 준비물

- **Node.js 24** 이상 (`.nvmrc` = `lts/krypton`).
- **data.go.kr 인증키**:
  1. [공공데이터포털](https://www.data.go.kr)에서 **나라장터 입찰공고정보서비스**를 활용신청해 `[승인]`을 받는다. 인증키는 계정당 하나지만, 각 API는 저마다 활용신청 승인이 있어야 그 API에서 인증된다. 서비스키가 있어도 이 API를 활용신청하지 않으면 인증 오류(코드 30)가 난다.
  2. 마이페이지 → 활용신청 현황 → 개발계정 상세에서 **Decoding 서비스키**를 복사한다.
  3. 같은 `DATA_GO_KR_SERVICE_KEY`는 같은 계정으로 활용신청한 다른 data.go.kr API에도 재사용된다.

> [!TIP]
> 공공데이터포털이 처음이라면 활용신청부터 인증키 복사까지 그림으로 따라 하는 [**data.go.kr 인증키 발급 가이드**](docs/service-key-guide.md)를 참고한다.

> 서비스키는 반드시 **Decoding(원본)** 키를 넣는다. Encoding(`%2B` 등 포함) 키를 넣으면 이중 인코딩으로 인증 오류(코드 30)가 난다.

## MCP 클라이언트 설정

MCP 클라이언트에 아래 config를 추가한다:

```json
{
  "mcpServers": {
    "narajangteo-bid": {
      "command": "npx",
      "args": ["-y", "@opendata-kr/narajangteo-bid-mcp@latest"],
      "env": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" }
    }
  }
}
```

> [!NOTE]
> `@opendata-kr/narajangteo-bid-mcp@latest`를 쓰면 클라이언트가 항상 최신 버전을 받는다.

> [!IMPORTANT]
> `DATA_GO_KR_SERVICE_KEY`(필수, **Decoding 원본** 키)가 없으면 첫 호출이 인증 오류(코드 30)로 실패한다. 위 config의 `env`에 키를 넣는다. 원클릭 버튼이나 env를 config에 담지 못하는 클라이언트는 설치 후 셸 환경변수로 `DATA_GO_KR_SERVICE_KEY`를 설정한다.

### 클라이언트별 설정

<details>
  <summary>Amp</summary>
  https://ampcode.com/manual#mcp 의 안내를 따르고 위 config를 사용한다. CLI로도 추가할 수 있다:

```bash
amp mcp add narajangteo-bid -- npx -y @opendata-kr/narajangteo-bid-mcp@latest
```

이후 생성된 설정의 `env`(또는 셸 환경변수)에 `DATA_GO_KR_SERVICE_KEY`를 추가한다.

</details>

<details>
  <summary>Antigravity</summary>

<a href="https://antigravity.google/docs/mcp">Antigravity 문서</a>의 커스텀 MCP 서버 추가 방법을 따라 아래 config를 MCP servers 설정에 넣는다:

```json
{
  "mcpServers": {
    "narajangteo-bid": {
      "command": "npx",
      "args": ["-y", "@opendata-kr/narajangteo-bid-mcp@latest"],
      "env": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" }
    }
  }
}
```

</details>

<details>
  <summary>Claude Code</summary>

Claude Code CLI로 서버를 추가한다 (<a href="https://code.claude.com/docs/en/mcp">가이드</a>):

```bash
claude mcp add narajangteo-bid --scope user --env DATA_GO_KR_SERVICE_KEY=발급받은_Decoding_키 -- npx -y @opendata-kr/narajangteo-bid-mcp@latest
```

</details>

<details>
  <summary>Cline</summary>
  https://docs.cline.bot/mcp/configuring-mcp-servers 의 안내를 따르고 위 config를 사용한다.
</details>

<details>
  <summary>Codex</summary>
  <a href="https://developers.openai.com/codex/mcp/#configure-with-the-cli">MCP 설정 가이드</a>를 따르고 위 config를 사용한다. Codex CLI로도 추가할 수 있다:

```bash
codex mcp add narajangteo-bid --env DATA_GO_KR_SERVICE_KEY=발급받은_Decoding_키 -- npx -y @opendata-kr/narajangteo-bid-mcp@latest
```

**Windows**

`~/.codex/config.toml`에 `cmd /c` 래핑으로 추가한다:

```toml
[mcp_servers.narajangteo-bid]
command = "cmd"
args = ["/c", "npx", "-y", "@opendata-kr/narajangteo-bid-mcp@latest"]
env = { DATA_GO_KR_SERVICE_KEY = "발급받은_Decoding_키" }
```

</details>

<details>
  <summary>Command Code</summary>

Command Code CLI로 서버를 추가한다 (<a href="https://commandcode.ai/docs/mcp">MCP 가이드</a>):

```bash
cmd mcp add narajangteo-bid --scope user npx -y @opendata-kr/narajangteo-bid-mcp@latest
```

이후 생성된 설정의 `env`(또는 셸 환경변수)에 `DATA_GO_KR_SERVICE_KEY`를 추가한다.

</details>

<details>
  <summary>Continue</summary>

Continue의 <a href="https://docs.continue.dev/customize/deep-dives/mcp">MCP 가이드</a>를 따른다. Continue는 `mcpServers`를 배열로 쓴다:

```json
{
  "mcpServers": [
    {
      "name": "narajangteo-bid",
      "command": "npx",
      "args": ["-y", "@opendata-kr/narajangteo-bid-mcp@latest"],
      "env": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" }
    }
  ]
}
```

</details>

<details>
  <summary>Copilot CLI</summary>

Copilot CLI를 시작한다:

```
copilot
```

MCP 서버 추가 대화를 연다:

```
/mcp add
```

다음 필드를 입력하고 `CTRL+S`로 저장한다:

- **Server name:** `narajangteo-bid`
- **Server Type:** `[1] Local`
- **Command:** `npx -y @opendata-kr/narajangteo-bid-mcp@latest`
- **Environment variables:** `DATA_GO_KR_SERVICE_KEY=발급받은_Decoding_키`

</details>

<details>
  <summary>Copilot / VS Code</summary>

**버튼으로 설치:**

[<img src="https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Install in VS Code">](https://vscode.dev/redirect/mcp/install?name=io.github.opendata-kr%2Fnarajangteo-bid-mcp&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40opendata-kr%2Fnarajangteo-bid-mcp%22%5D%2C%22env%22%3A%7B%7D%7D)

[<img src="https://img.shields.io/badge/VS_Code_Insiders-Install_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Install in VS Code Insiders">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522io.github.opendata-kr%252Fnarajangteo-bid-mcp%2522%252C%2522config%2522%253A%257B%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522%2540opendata-kr%252Fnarajangteo-bid-mcp%2522%255D%252C%2522env%2522%253A%257B%257D%257D%257D)

> 버튼은 키를 담지 못한다. 설치 후 `.vscode/mcp.json`(또는 사용자 설정)의 `env`에 `DATA_GO_KR_SERVICE_KEY`를 추가한다.

**직접 추가:**

VS Code [MCP 설정 가이드](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server)를 따르거나 CLI를 쓴다.

macOS·Linux:

```bash
code --add-mcp '{"name":"narajangteo-bid","command":"npx","args":["-y","@opendata-kr/narajangteo-bid-mcp@latest"],"env":{"DATA_GO_KR_SERVICE_KEY":"발급받은_Decoding_키"}}'
```

Windows(PowerShell):

```powershell
code --add-mcp '{"""name""":"""narajangteo-bid""","""command""":"""npx""","""args""":["""-y""","""@opendata-kr/narajangteo-bid-mcp@latest"""],"""env""":{"""DATA_GO_KR_SERVICE_KEY""":"""발급받은_Decoding_키"""}}'
```

</details>

<details>
  <summary>Cursor</summary>

**버튼으로 설치:**

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add narajangteo-bid MCP server to Cursor">](https://cursor.com/en/install-mcp?name=narajangteo-bid&config=eyJjb21tYW5kIjoibnB4IC15IEBvcGVuZGF0YS1rci9uYXJhamFuZ3Rlby1iaWQtbWNwQGxhdGVzdCJ9)

> 버튼은 키를 담지 못한다. 설치 후 Cursor의 MCP 설정에서 `env`에 `DATA_GO_KR_SERVICE_KEY`를 추가한다.

**직접 추가:**

`Cursor Settings` → `MCP` → `New MCP Server`에서 위 config를 사용한다.

</details>

<details>
  <summary>Factory CLI</summary>

Factory CLI로 서버를 추가한다 (<a href="https://docs.factory.ai/cli/configuration/mcp">가이드</a>):

```bash
droid mcp add narajangteo-bid "npx -y @opendata-kr/narajangteo-bid-mcp@latest"
```

이후 생성된 설정의 `env`(또는 셸 환경변수)에 `DATA_GO_KR_SERVICE_KEY`를 추가한다.

</details>

<details>
  <summary>Gemini CLI</summary>

Gemini CLI로 서버를 추가한다.

**프로젝트 범위:**

```bash
gemini mcp add narajangteo-bid npx -y @opendata-kr/narajangteo-bid-mcp@latest
```

**전역:**

```bash
gemini mcp add -s user narajangteo-bid npx -y @opendata-kr/narajangteo-bid-mcp@latest
```

또는 <a href="https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#how-to-set-up-your-mcp-server">MCP 가이드</a>를 따르고 위 config를 쓴다. `~/.gemini/settings.json`의 서버 정의 `env`에 `DATA_GO_KR_SERVICE_KEY`를 추가한다.

</details>

<details>
  <summary>Gemini Code Assist</summary>
  <a href="https://cloud.google.com/gemini/docs/codeassist/use-agentic-chat-pair-programmer#configure-mcp-servers">MCP 설정 가이드</a>를 따르고 위 config를 사용한다.
</details>

<details>
  <summary>Grok Build CLI</summary>

```bash
grok mcp add narajangteo-bid npx -y @opendata-kr/narajangteo-bid-mcp@latest
```

이후 생성된 설정의 `env`(또는 셸 환경변수)에 `DATA_GO_KR_SERVICE_KEY`를 추가한다. 더 많은 옵션은 <a href="https://docs.x.ai/build/features/skills-plugins-marketplaces">문서</a> 참고.

</details>

<details>
  <summary>JetBrains AI Assistant & Junie</summary>

`Settings | Tools | AI Assistant | Model Context Protocol (MCP)` → `Add`에서 위 config를 사용한다.
Junie도 같은 방식으로 `Settings | Tools | Junie | MCP Settings` → `Add`에서 위 config를 사용한다.

</details>

<details>
  <summary>Katalon Studio</summary>

Katalon StudioAssist는 MCP 프록시를 통해 stdio 서버를 연결한다.

**1단계:** <a href="https://docs.katalon.com/katalon-studio/studioassist/mcp-servers/setting-up-mcp-proxy-for-stdio-mcp-servers">MCP 프록시 설정 가이드</a>로 프록시를 설치한다.

**2단계:** 프록시로 서버를 띄운다(같은 셸에 `DATA_GO_KR_SERVICE_KEY`를 export 한 상태):

```bash
DATA_GO_KR_SERVICE_KEY=발급받은_Decoding_키 mcp-proxy --transport streamablehttp --port 8080 -- npx -y @opendata-kr/narajangteo-bid-mcp@latest
```

**3단계:** StudioAssist에 다음 설정으로 서버를 추가한다:

- **Connection URL:** `http://127.0.0.1:8080/mcp`
- **Transport type:** `HTTP`

</details>

<details>
  <summary>Kiro</summary>

**Kiro Settings**에서 `Configure MCP` → `Open Workspace or User MCP Config` → 위 config를 사용한다.

또는 **Activity Bar** → `Kiro` → `MCP Servers` → `Open MCP Config`에서 위 config를 사용한다.

</details>

<details>
  <summary>Mistral Vibe</summary>

`~/.vibe/config.toml`에 추가한다:

```toml
[[mcp_servers]]
name = "narajangteo-bid"
transport = "stdio"
command = "npx"
args = ["-y", "@opendata-kr/narajangteo-bid-mcp@latest"]
env = { DATA_GO_KR_SERVICE_KEY = "발급받은_Decoding_키" }
```

</details>

<details>
  <summary>OpenCode</summary>

`opencode.json`에 추가한다. 없으면 `~/.config/opencode/opencode.json`에 만든다 (<a href="https://opencode.ai/docs/mcp-servers">가이드</a>):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "narajangteo-bid": {
      "type": "local",
      "command": ["npx", "-y", "@opendata-kr/narajangteo-bid-mcp@latest"],
      "environment": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" }
    }
  }
}
```

</details>

<details>
  <summary>Qoder</summary>

**Qoder Settings**에서 `MCP Server` → `+ Add` → 위 config를 사용한다.

또는 <a href="https://docs.qoder.com/user-guide/chat/model-context-protocol">MCP 가이드</a>를 따르고 위 config를 쓴다.

</details>

<details>
  <summary>Qoder CLI</summary>

Qoder CLI로 서버를 추가한다 (<a href="https://docs.qoder.com/cli/using-cli#mcp-servers">가이드</a>):

**프로젝트 범위:**

```bash
qodercli mcp add narajangteo-bid -- npx @opendata-kr/narajangteo-bid-mcp@latest
```

**전역:**

```bash
qodercli mcp add -s user narajangteo-bid -- npx @opendata-kr/narajangteo-bid-mcp@latest
```

이후 생성된 설정의 `env`(또는 셸 환경변수)에 `DATA_GO_KR_SERVICE_KEY`를 추가한다.

</details>

<details>
  <summary>Visual Studio</summary>

**버튼으로 설치:**

[<img src="https://img.shields.io/badge/Visual_Studio-Install-C16FDE?logo=visualstudio&logoColor=white" alt="Install in Visual Studio">](https://vs-open.link/mcp-install?%7B%22name%22%3A%22narajangteo-bid%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22%40opendata-kr%2Fnarajangteo-bid-mcp%40latest%22%5D%7D)

> 버튼은 키를 담지 못한다. 설치 후 서버 설정의 `env`에 `DATA_GO_KR_SERVICE_KEY`를 추가한다.

</details>

<details>
  <summary>Warp</summary>

`Settings | AI | Manage MCP Servers` → `+ Add`에서 [MCP 서버를 추가](https://docs.warp.dev/knowledge-and-collaboration/mcp#adding-an-mcp-server)하고 위 config를 사용한다.

</details>

<details>
  <summary>Windsurf</summary>
  <a href="https://docs.windsurf.com/windsurf/cascade/mcp#mcp-config-json">MCP 설정 가이드</a>를 따르고 위 config를 사용한다. Windsurf는 `mcpServers` 키를 쓴다(`~/.codeium/windsurf/mcp_config.json`).
</details>

<details>
  <summary>Zed</summary>

`~/.config/zed/settings.json`에 추가한다(스키마는 Zed 버전에 따라 다를 수 있으니 <a href="https://zed.dev/docs/ai/mcp">Zed 공식 문서</a>를 확인):

```json
{
  "context_servers": {
    "narajangteo-bid": {
      "command": { "path": "npx", "args": ["-y", "@opendata-kr/narajangteo-bid-mcp@latest"] },
      "env": { "DATA_GO_KR_SERVICE_KEY": "발급받은_Decoding_키" }
    }
  }
}
```

</details>

<details>
  <summary>ChatGPT · 원격 전용 클라이언트</summary>

ChatGPT Developer Mode처럼 **원격(HTTPS) MCP만 지원하는 클라이언트**는 로컬 stdio 서버를 직접 붙일 수 없다. stdio→HTTP 브리지(`mcp-proxy`)로 이 서버를 HTTP로 띄우고 공개 HTTPS 엔드포인트(리버스 프록시·터널·호스팅)로 노출한 뒤, 그 URL을 커넥터로 등록한다.

```bash
DATA_GO_KR_SERVICE_KEY=발급받은_Decoding_키 mcp-proxy --transport streamablehttp --port 8080 -- npx -y @opendata-kr/narajangteo-bid-mcp@latest
```

`http://127.0.0.1:8080/mcp`를 공개 HTTPS로 노출하는 것은 사용자 몫이다. (`mcp-remote`는 반대로 stdio 클라이언트를 원격 서버에 붙일 때 쓰는 도구라 여기엔 맞지 않는다.)

</details>

### 발견성

이 서버는 MCP 레지스트리에 `io.github.opendata-kr/narajangteo-bid-mcp`로 기술된다. [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io)를 지원하는 클라이언트에서 검색·설치할 수 있다.

## 환경변수

| 환경변수 | 필수 | 비밀 | 기본값 | 설명 |
|---|---|---|---|---|
| `DATA_GO_KR_SERVICE_KEY` | 예 | 예 | (없음) | 공공데이터포털 **Decoding(원본)** 인증키 |
| `DATA_GO_KR_BASE_URL` | 아니오 | 아니오 | `https://apis.data.go.kr` | 게이트웨이 base 오버라이드 |
| `DATA_GO_KR_DOWNLOAD_DIR` | 아니오 | 아니오 | `~/Downloads` | `download_attachments` 저장 기준 디렉터리. 공고번호별 하위폴더로 저장 |
| `DATA_GO_KR_DOWNLOAD_TIMEOUT_MS` | 아니오 | 아니오 | `60000` | `download_attachments` 파일 다운로드 타임아웃(ms) |
| `DATA_GO_KR_DOWNLOAD_MAX_BYTES` | 아니오 | 아니오 | `104857600` | `download_attachments` 파일당 다운로드 크기 상한(바이트, 기본 100MB) |

## 도구

10개 도구 중 8개는 읽기 전용 조회(`readOnlyHint: true`)다. `download_attachments`·`read_attachment`는 첨부 파일을 디스크에 저장할 수 있어 읽기 전용이 아니다(`readOnlyHint: false`). 업무구분·항목별 병렬 조회 도구는 `results`에 조회 단위(업무구분 또는 항목 라벨)마다 성공 시 `{ status: "ok", totalCount, items }`, 실패 시 `{ status: "error", error }`를 담는다. 일부가 실패해도 나머지 결과는 반환하며(부분 실패 표면화), `anySucceeded`는 하나라도 성공했는지를 나타낸다.

| 도구 | 설명 |
|---|---|
| `search_bid_notices` | 키워드·기간·기관·지역·업종·추정가격으로 입찰공고 검색 |
| `get_bid_notice` | 입찰공고번호로 단건 상세 조회 |
| `get_bid_basis_amount` | 기초금액·평가기준금액·예비가격범위율 조회 |
| `get_bid_evaluation` | 낙찰가 산식A(합산항목)·평가주력분야 조회 |
| `get_bid_change_history` | 공고 변경이력(정정·변경 항목) 조회 |
| `get_bid_eligibility` | 면허제한·참가가능지역 조회 |
| `get_bid_items` | 구매대상물품(품명·수량·단가 등) 조회 |
| `get_bid_attachments` | 공고 첨부파일(공고문·규격서·제안요청서 등)의 파일명·URL 조회 |
| `download_attachments` | 첨부를 전부 디스크에 내려받고 ZIP은 풀어 읽을 수 있는 파일 목록(매니페스트) 반환 (파일 저장) |
| `read_attachment` | 파일 목록의 index로 파일 하나의 본문 텍스트(HWPX·구형 HWP·구형 DOC) 읽기 |

### `search_bid_notices`

키워드, 기간, 기관, 지역, 업종, 추정가격으로 입찰공고를 검색한다. 업무구분 미지정 시 기타(etc) 제외 4구분(공사/용역/물품/외자)을 병렬 검색한다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidKind` | `string[]` | 업무구분 배열: `cnstwk`(공사) `servc`(용역) `thng`(물품) `frgcpt`(외자) `etc`(기타). 미지정 시 기타 제외 4구분, 기타공고는 명시로 옵트인 |
| `keyword` | `string` | 공고명 부분 검색 |
| `startDate` | `string` | 공고게시 시작일 `YYYYMMDD`. 미지정 시 최근 30일 자동 적용 |
| `endDate` | `string` | 공고게시 종료일 `YYYYMMDD` |
| `institution` | `string` | 공고기관명 |
| `demandInstitution` | `string` | 수요기관명 |
| `region` | `string` | 참가제한지역명 (예: 인천광역시) |
| `industry` | `string` | 업종명 |
| `minPrice` | `number` | 추정가격 하한(원) |
| `maxPrice` | `number` | 추정가격 상한(원) |
| `page` | `number` | 페이지 번호(기본 1) |
| `pageSize` | `number` | 페이지당 건수(기본 10, 최대 100) |

조회창(`startDate`~`endDate`)은 최대 31일이다. 하나만 지정하면 그 날짜를 기준으로 30일 창을 채운다.

반환: `{ query, anySucceeded, results }`. `results`는 업무구분별 `BidNotice[]`를 담는다.

### `get_bid_notice`

입찰공고번호로 단건 조회한다. 업무구분 미지정 시 기타(etc)를 제외한 4구분에서 순차 조회하며, 기타공고는 `bidKind`에 `etc`를 명시한다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호 (예: `R25BK00932003`). 필수 |
| `bidKind` | `string` | 업무구분(`cnstwk`·`servc`·`thng`·`frgcpt`·`etc`). 미지정 시 기타 제외 4구분에서 순차 조회, 기타공고는 `etc` 명시 |

반환: `{ found, bidKind, notice, searchedKinds, errors }`. 찾으면 `found: true`와 `notice`(`BidNotice`), 못 찾으면 `found: false`. `errors`는 조회 중 발생한 오류 메시지다.

### `get_bid_basis_amount`

입찰공고번호로 기초금액·평가기준금액·예비가격범위율을 조회한다. 기초금액은 물품·공사·용역 3구분만 존재한다(외자·기타 없음).

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호. 필수 |
| `bidKind` | `string` | 업무구분(`thng`=물품 `cnstwk`=공사 `servc`=용역). 미지정 시 3구분 병렬 조회 |

반환: `{ bidNtceNo, anySucceeded, results }`. `results`는 업무구분별 `BidBasisAmount[]`를 담는다.

### `get_bid_evaluation`

입찰공고번호로 낙찰가 산정 산식A(국민연금·건강보험료 등 합산항목)와 평가대상 주력분야를 조회한다. 업무구분 구분 없이 단일 조회한다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호. 필수 |

반환: `{ bidNtceNo, anySucceeded, results }`. `results`는 `priceFormula`(산식A)와 `targetField`(평가주력분야) 두 키로 `BidEvaluation[]`를 담는다.

### `get_bid_change_history`

입찰공고번호로 공고의 변경이력(정정·변경 항목, 변경 전/후 값)을 조회한다. 변경이력은 물품·공사·용역 3구분만 존재한다(외자·기타 없음). 변경 이력이 없는 공고는 빈 결과를 반환한다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호. 필수 |
| `bidKind` | `string` | 업무구분(`thng`=물품 `cnstwk`=공사 `servc`=용역). 미지정 시 3구분 병렬 조회 |

반환: `{ bidNtceNo, anySucceeded, results }`. `results`는 업무구분별 `BidChange[]`를 담는다.

### `get_bid_eligibility`

입찰공고번호와 공고차수로 면허제한과 참가가능지역을 조회한다. 면허제한·참가가능지역은 공고차수 단위로 갈리므로 `bidNtceOrd`를 정확히 넘겨야 한다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호. 필수 |
| `bidNtceOrd` | `string` | 입찰공고차수(예: `000`). `get_bid_notice` 결과의 `bidNtceOrd`에서 확인. 미지정 시 `000` |

반환: `{ bidNtceNo, bidNtceOrd, anySucceeded, results }`. `results`는 `licenseLimit`(면허제한)과 `region`(참가가능지역) 두 키로 `BidEligibility[]`를 담는다.

### `get_bid_items`

입찰공고번호와 공고차수로 구매대상물품(품명·수량·단가·납품장소 등)을 조회한다. 구매대상물품은 물품·용역·외자 3구분만 존재한다(공사 없음).

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호. 필수 |
| `bidNtceOrd` | `string` | 입찰공고차수(예: `000`). `get_bid_notice` 결과의 `bidNtceOrd`에서 확인. 미지정 시 `000` |
| `bidKind` | `string` | 업무구분(`thng`=물품 `servc`=용역 `frgcpt`=외자). 미지정 시 3구분 병렬 조회 |

반환: `{ bidNtceNo, bidNtceOrd, anySucceeded, results }`. `results`는 업무구분별 `BidItem[]`를 담는다.

### `get_bid_attachments`

입찰공고번호로 그 공고의 첨부파일 파일명·URL을 조회한다. 공고 본문 규격첨부(공고문·규격서·제안요청서·과업지시서 등)를 주 소스로, e발주·혁신장터 최종제안요청서(RFP) 첨부를 함께 반환한다. 파일 자체는 내려받지 않고 URL만 반환한다. 파일을 내려받아 목록을 얻으려면 `download_attachments`, 본문을 읽으려면 `read_attachment`를 쓴다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호. 필수 |

반환: `{ bidNtceNo, anySucceeded, results }`. `results`는 `notice`(공고 규격첨부)·`eorder`(e발주)·`innovationRfp`(혁신장터 RFP) 세 키로 `BidAttachment[]`를 담는다.

### `download_attachments`

공고 첨부를 전부 디스크에 내려받고 ZIP은 풀어, 읽을 수 있는 **파일 목록(매니페스트)**을 반환한다(본문 텍스트는 담지 않는다). 개별 파일 본문은 이 목록의 `index`를 `read_attachment`에 줘서 읽는다. `get_bid_attachments`가 URL만 돌려주는 데 반해, 이 도구는 실제 파일을 확보하고 목록을 만든다.

> [!IMPORTANT]
> 이 도구는 읽기 전용이 아니다(`readOnlyHint: false`). 첨부를 `<저장 디렉터리>/<공고번호>/` 아래에 저장한다. 저장 위치는 `DATA_GO_KR_DOWNLOAD_DIR`(미설정 시 `~/Downloads`)로 정한다. 이미 저장된 파일은 재다운로드 없이 재사용한다. 첨부가 나중에 바뀌면 `refresh: true`로 다시 호출해 새로 받는다.

ZIP은 목록에서 사라지고 내부 파일이 항목으로 펼쳐지며 `container`에 원본 ZIP명이 담긴다(중첩 ZIP은 재귀하지 않는다). 각 항목의 `extractable: true`면 `read_attachment`로 본문(HWPX·구형 HWP·구형 DOC)을 읽을 수 있고, `false`면 파일만 저장돼 있다.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호. 필수 |
| `refresh` | `boolean` | `true`면 디스크 캐시를 무시하고 모든 첨부를 새로 내려받는다(기본 `false`는 재사용) |

반환: `{ bidNtceNo, anySucceeded, resolveErrors?, files, truncatedFileList? }`. `files`는 파일 매니페스트로, 각 항목은 `index`·`fileNm`·`container?`(담고 있는 ZIP명)·`format`(`hwpx`/`hwp`/`doc`/`other`)·`extractable`·`byteSize?`·`savedPath`·`note?`(미해제 사유 등)를 담는다.

### `read_attachment`

`download_attachments`가 준 파일 목록에서 `index`로 파일 하나를 골라 본문 텍스트를 읽는다. HWPX·구형 HWP·구형 DOC를 추출하며 ZIP 내부 파일도 `index`로 직접 읽는다(`container`에 원본 ZIP명). 이미 내려받은 파일은 재사용하고, 없으면 그 파일만 내려받는다.

> [!IMPORTANT]
> 이 도구도 없는 파일은 그 파일만 내려받으므로 읽기 전용이 아니다(`readOnlyHint: false`).

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `bidNtceNo` | `string` | 입찰공고번호. 필수 |
| `index` | `number` | 읽을 파일의 목록 인덱스(0-base). `download_attachments` 응답 `files[].index`. 필수 |
| `offset` | `number` | 본문 텍스트의 시작 문자 오프셋(기본 0). 긴 문서를 이어 읽을 때 |
| `maxChars` | `number` | 반환 문자 상한(기본 50000). `truncated: true`면 `offset`을 올려 이어 읽는다 |

반환: `{ bidNtceNo, index, fileNm, container?, format, extractStatus, extractError?, byteSize?, savedPath, text, textLength, truncated }`. `extractStatus`는 `full`/`preview`/`unsupported`/`error`. `truncated: true`는 다음 구간이 남았다는 신호다.

## 응답 필드

아래 각 타입은 조회 키인 `bidNtceNo`(공고번호)·`bidNtceOrd`(공고차수, 있는 경우)를 함께 포함한다.

### `BidNotice`

`bidNtceNm`(공고명), `ntceInsttNm`(공고기관), `dminsttNm`(수요기관), `bidNtceDt`(공고일시), `bidClseDt`(마감일시), `opengDt`(개찰일시), `presmptPrce`(추정가격), `bidNtceDtlUrl`(상세 URL), `bidMethdNm`(입찰방법), `cntrctCnclsMthdNm`(계약체결방법), `bidPrtcptLmtYn`(투찰제한여부), `prtcptLmtRgnNm`(참가제한지역), `cmmnSpldmdMethdNm`(공동수급방식).

### `BidBasisAmount`

`bssamt`(기초금액), `evlBssAmt`(평가기준금액), `rsrvtnPrceRngBgnRate`(예비가격범위율 하한), `rsrvtnPrceRngEndRate`(예비가격범위율 상한), `bssamtOpenDt`(기초금액 개찰일시).

### `BidEvaluation`

`prearngPrceDcsnMthdNm`(예정가격결정방법), `bidPrceCalclAOpenDt`(산식A 개찰일시), `npnInsrprm`(국민연금보험료), `mrfnHealthInsrprm`(건강보험료), `qltyMngcst`(품질관리비), `sftyMngcst`(안전관리비), `sftyChckMngcst`(안전점검비), `tmpNm`(평가주력분야명).

### `BidChange`

`chgDt`(변경일시), `chgItemNm`(변경항목명), `bfchgVal`(변경전값), `afchgVal`(변경후값), `chgDataDivNm`(변경구분명).

### `BidEligibility`

`lcnsLmtNm`(면허제한명), `permsnIndstrytyList`(허용업종목록), `prtcptPsblRgnNm`(참가가능지역명).

### `BidItem`

`prdctClsfcNoNm`(품명), `dtilPrdctClsfcNoNm`(세부품명), `qty`(수량), `unit`(단위), `uprc`(단가), `dlvrPlce`(납품장소), `dlvrTmlmtDt`(납품기한).

### `BidAttachment`

`fileNm`(파일명), `fileUrl`(파일URL), `docDivNm`(문서구분명).

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
