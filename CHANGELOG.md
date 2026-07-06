# Changelog

이 프로젝트의 주요 변경 사항을 기록한다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르고, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [0.1.1](https://github.com/opendata-kr/narajangteo-bid-mcp/compare/v0.1.0...v0.1.1) (2026-07-06)


### Features

* API client (한 번만 인코딩, 타임아웃, 에러 정규화) ([5c87851](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/5c87851979c7d1060c5d10a734f06af5b8ca8117))
* API 타입 정의 + 응답 fixture ([193d72f](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/193d72faa84a9f8457773f8fbe6fcb2a90cf9095))
* BID_SERVICE_KEY config 로드 + 이중인코딩 감지 ([af73569](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/af73569258020f8fb946bf0bb52bbbf648ee68d4))
* bidKind 오퍼레이션 매핑 + vitest 설정 ([6e26347](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/6e263472a00a33771d25ba65a45dc82396dcdcc9))
* data.go.kr 에러코드 한국어 정규화 ([b99f545](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/b99f54589db34a4aeaaa96a9444d95eb43aa1c50))
* get_bid_notice 단건 조회 핸들러 ([35ba49f](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/35ba49f67a3ca04a3a9da7b167d31aaf2b1832b6))
* MCP 서버 배선 + tool 2종 등록 ([3c4c4eb](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/3c4c4ebcd3e3c607b87209f438484dcb1df68d26))
* search_bid_notices fan-out 검색 핸들러 ([a63057e](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/a63057e0e5ed02983568528ec623503af6adde65))
* 응답 정제 함수(formatItem/extractItems) ([00facc6](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/00facc6307fad6c11cb169dd588c192258f6091d))


### Bug Fixes

* baseUrl을 https로 전환 (ServiceKey 평문 전송 방지) ([f0ed054](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/f0ed0541c194ee45d6a61aaf17f3b57cee1aa406))
* index.ts 경고 메시지의 환경변수명을 DATA_GO_KR_SERVICE_KEY로 ([60e6065](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/60e6065167449efa66410939766c00be58a374c3))
* 최종 리뷰 3건 (비-JSON 응답 가드, 전 구분 실패 은폐, 툴 등록 검증) ([5aa633d](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/5aa633dc0845fb5bf884461cd7292997b5c5aa8f))


### Documentation

* apply org README standard (archetype A) to README ([c719180](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/c719180afca27e61e41652989a24a296c89fda56))
* README + 조건부 통합 스모크 테스트 ([5bfc421](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/5bfc421af2ca5e32f0804e0bd451d23b8128cd69))
* **readme:** MCP 클라이언트 설정을 클라이언트 중립 매트릭스로 재구성 ([022ab91](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/022ab91cdf26b3ee1f6c4ef258d56770f31dd116))
* README를 공개용으로 갱신 (tool 파라미터·응답 필드·특징) ([7bcc863](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/7bcc863fbddf155ec181607171071f570f7e5ba5))
* 뱃지 정비 및 CHANGELOG를 0.1.0 릴리스 기준으로 정정 ([4ce6bca](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/4ce6bca3010f295f19b1ae280607f012ba4f82c4))


### Refactor

* use @opendata-kr/core for data.go.kr transport layer ([ebd3bb5](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/ebd3bb5b27c9319cd249320778dd588bca190f7e))

## [0.1.0] - 2026-07-06

### Added
- 나라장터 입찰공고정보서비스 MCP 서버: `search_bid_notices`, `get_bid_notice` tool
- data.go.kr 에러코드 한국어 정규화, 이중 인코딩 방어, 10초 타임아웃
- 오픈소스 표준 파일: LICENSE, CI, dependabot, editorconfig (CODE_OF_CONDUCT·CONTRIBUTING·SECURITY는 조직 `.github` 리포에서 상속)
