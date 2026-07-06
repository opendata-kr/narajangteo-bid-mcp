# Changelog

이 프로젝트의 주요 변경 사항을 기록한다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르고, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [0.1.2](https://github.com/opendata-kr/narajangteo-bid-mcp/compare/v0.1.1...v0.1.2) (2026-07-06)


### Automation

* setup-node의 잘못된 cache:false를 package-manager-cache:false로 정정 ([56a2f1d](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/56a2f1d61006b0e9bf7f4fdd09c972e5db708f7a))

## [0.1.1](https://github.com/opendata-kr/narajangteo-bid-mcp/compare/v0.1.0...v0.1.1) (2026-07-06)


### Documentation

* **readme:** MCP 클라이언트 설정을 클라이언트 중립 매트릭스로 재구성 ([022ab91](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/022ab91cdf26b3ee1f6c4ef258d56770f31dd116))
* 뱃지 정비 및 CHANGELOG를 0.1.0 릴리스 기준으로 정정 ([4ce6bca](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/4ce6bca3010f295f19b1ae280607f012ba4f82c4))

## [0.1.0] - 2026-07-06

### Added
- 나라장터 입찰공고정보서비스 MCP 서버: `search_bid_notices`, `get_bid_notice` tool
- data.go.kr 에러코드 한국어 정규화, 이중 인코딩 방어, 10초 타임아웃
- 오픈소스 표준 파일: LICENSE, CI, dependabot, editorconfig (CODE_OF_CONDUCT·CONTRIBUTING·SECURITY는 조직 `.github` 리포에서 상속)
