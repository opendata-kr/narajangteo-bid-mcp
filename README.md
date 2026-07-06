# @opendata-kr/narajangteo-bid-mcp

나라장터 입찰공고정보서비스(공공데이터포털) Open API를 감싼 로컬 MCP 서버.
Claude Desktop 등 MCP 클라이언트에서 입찰공고를 검색·조회한다.

## 설치 및 인증

1. [공공데이터포털](https://www.data.go.kr)에서 "나라장터 입찰공고정보서비스"
   활용신청 후 **Decoding 서비스키**를 발급받는다.
2. MCP 클라이언트 설정에 서버를 등록한다 (아래 예시).
3. 클라이언트를 재시작하고 "이번 주 용역 입찰 찾아줘"로 확인한다.

### Claude Desktop 설정 (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "bid-public-info": {
      "command": "npx",
      "args": ["-y", "@opendata-kr/narajangteo-bid-mcp"],
      "env": { "BID_SERVICE_KEY": "발급받은_Decoding_키" }
    }
  }
}
```

> 서비스키는 반드시 **Decoding(원본)** 키를 넣는다. Encoding(`%2B` 등 포함) 키를
> 넣으면 이중 인코딩으로 인증 오류(코드 30)가 난다.

## Tool

- `search_bid_notices`: 키워드·기간·기관·지역·업종·추정가격으로 입찰공고 검색.
  업무구분(공사/용역/물품/외자) 미지정 시 전체를 병렬 검색.
- `get_bid_notice`: 입찰공고번호로 단건 조회.

## 개발

```bash
nvm use            # Node 24
pnpm install
pnpm test          # vitest
pnpm build         # tsup → dist/
```
