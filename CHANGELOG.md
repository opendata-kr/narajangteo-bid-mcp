# Changelog

이 프로젝트의 주요 변경 사항을 기록한다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르고, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [0.4.0](https://github.com/opendata-kr/narajangteo-bid-mcp/compare/v0.3.1...v0.4.0) (2026-07-13)


### Features

* **attachments:** zip 첨부 내부 재귀 추출과 구형 DOC 추출 지원 ([748f139](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/748f139dd297cc531434c54dd1bec2b9376ac09a))
* **attachments:** 첨부를 다운로드+파일목록과 index 읽기 2-도구로 재설계 ([0e1f766](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/0e1f766121b03281c3cebdba05062978ee8e18bc))


### Documentation

* **attachments:** get_bid_attachments 설명의 형제 도구 안내를 세 도구로 정정 ([db85344](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/db85344b75dd8ba2c88bb76327a76a6fe62e74e7))

## [0.3.1](https://github.com/opendata-kr/narajangteo-bid-mcp/compare/v0.3.0...v0.3.1) (2026-07-13)


### Bug Fixes

* **attachments:** 공고 규격첨부(ntceSpec)를 첨부 주 소스로 편입 ([90ac1d8](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/90ac1d8651cb46574dbf2588442408f7f6f4c420))


### Documentation

* **readme:** download_attachments 도구·다운로드 env 3종 반영 ([69d6303](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/69d630380620f7be89d30e7bbd388fb1b26be9c7))

## [0.3.0](https://github.com/opendata-kr/narajangteo-bid-mcp/compare/v0.2.1...v0.3.0) (2026-07-13)


### Features

* **attachments:** download_attachments 도구 추가 ([b865f5a](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/b865f5a9ecb4c2cb1de877abe1b2054d767f052e))
* **attachments:** download_attachments 출력 타입과 cfb·fflate 의존 추가 ([8233ec2](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/8233ec2da005fafa63a722fa16978b34ee14cdb3))
* **attachments:** HWPX·구형 HWP 텍스트 추출 계층 추가 ([525eeb5](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/525eeb59baefe67533653c341b7f01d3e09214f5))
* **attachments:** 파일 다운로드·저장 계층 추가 ([0c05e39](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/0c05e396d6f167e7f249716505aba4ffd535ebe8))
* **attachments:** 페이지네이션 재다운로드 제거(디스크 재사용·대상 한정) ([5acd03d](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/5acd03d47786ec8eae3dccd762c140e6a323ae1d))


### Documentation

* **roadmap:** 첨부 재다운로드 제거(D3) 백로그 반영 ([791fc8a](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/791fc8ad586c83ba51c0bd07eee0c1f6747b35c0))

## [0.2.1](https://github.com/opendata-kr/narajangteo-bid-mcp/compare/v0.2.0...v0.2.1) (2026-07-08)


### Bug Fixes

* **api:** runOps를 core fanOut으로 재구현·인증힌트/에러축약 core 채택 ([b6c1ecb](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/b6c1ecb18013f310650ae91c0ca96c1fdf834a84))
* **api:** 인증힌트/에러축약/날짜파라미터를 core로 일원화·로컬 errorHint 제거 ([a438c96](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/a438c96cb74bfe43c102a8246d3e5ed73d264bec))

## [0.2.0](https://github.com/opendata-kr/narajangteo-bid-mcp/compare/v0.1.2...v0.2.0) (2026-07-07)


### Features

* **api:** op별 status 채널 유지하는 제네릭 러너 runOps ([62f8e61](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/62f8e612c20c425387f7a417610748da87e5ba26))
* **api:** 오퍼레이션명 개별 상수·도구별 kind 집합·조회규약 테이블 ([e453eb8](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/e453eb848242b47bf812352c11904ad3da437c61))
* **api:** 프리세일즈 필드·enrichment 도메인 타입 추가 ([19aeafa](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/19aeafa51757d1727b7d3bb342bad9e0f8330492))
* **attachments:** 첨부파일 조회 도구 get_bid_attachments (J=inqryDiv3) ([2aa47b8](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/2aa47b852905d1cb10e813ec665253289a837ed8))
* **basis:** 기초금액 조회 도구 get_bid_basis_amount ([a10994f](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/a10994f239c899cb613ac8afb2e696abf265588a))
* **change:** 변경이력 조회 도구 get_bid_change_history ([4d50cf0](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/4d50cf085e5aaac3e4044dc0633303ebba3efb74))
* **eligibility:** 면허제한·참가가능지역 조회 도구 get_bid_eligibility ([51fe495](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/51fe49558017532b11eb14cc29aa5bc15a8db7d7))
* **evaluation:** 산식A·평가주력분야 조회 도구 get_bid_evaluation ([dc86906](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/dc86906ada8261341f96da05d17845e99d4a0538))
* **format:** 부재 키 undefined 정책·enrichment 도메인 formatter ([fdb31a7](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/fdb31a77a08fa5ab03cf4b757f72c182be2e12f2))
* **items:** 구매대상물품 조회 도구 get_bid_items ([3ad44fb](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/3ad44fbbfd0c5eec69f870a1236faf7ec5a4a5a2))
* **notice:** bidNtceOrd 반환·부분실패 found 우선·etc 옵트인 ([5f2ce6a](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/5f2ce6a4dc758debc5e2272033a731fa2d52ddb5))
* **server:** 신규 6도구 등록·Decoding 키 회복 메시지 ([5d53a31](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/5d53a31024e72b0fc6a236c423a5b3b3044c7090))
* **tools:** 도구 title·애노테이션 추가·설명에 형제도구 구분과 enum 의미 보강 ([5ce67e5](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/5ce67e5dd5d1f1f5903ad83e2ac946f7c0d98cd6))


### Bug Fixes

* **api:** 인증 에러(HTTP 401)에 Decoding 키 회복 힌트 도달 ([8304b3a](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/8304b3a70ef8fdfa3a0b32ddc445be4f79b47ef3))
* **api:** 인증 힌트 정규식 IP 오매치 제거·창 역전 가드 추가 ([f9cd3c1](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/f9cd3c1245595811f07ca3f541340b5e95d63119))
* **search:** inqryDiv 상시전송·기본 윈도우·YYYYMMDD 검증·수요기관 분리 ([6ea6595](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/6ea65950253d04dbcbaeebb3c168d6aad9fc6e35))
* **search:** 조회창 상한 31일 가드와 회복 메시지 ([ca4197e](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/ca4197ef150086da724178afb37b1f5f60180cf0))


### Documentation

* data.go.kr 첫 사용자용 인증키 발급 그림 가이드 추가 ([9245ad1](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/9245ad199da4192f6af37d6b2aac3f668fcc581a))
* **guide:** 서비스 찾기 문구 순화·활용신청 폼 항목 구분 정리 ([1f8a9ab](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/1f8a9ab90cd1bda503ed69bfde9ab30451984190))
* **guide:** 활용목적 입력란 필수 사실·권장 문구 반영 ([7600313](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/7600313ed69e3b64f5084edd7a4b4c9e32ad646d))
* **readme:** 신규 6도구 문서·예시 프롬프트 추가 ([a4e5f69](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/a4e5f695b9f083cebd295c63f75f5dbbd66447b9))
* **readme:** 클라이언트별 설정을 상세 블록·원클릭 버튼 포맷으로 재작성 ([fcd015e](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/fcd015eae78f74056cb3777f4c3bf131307ec5da))
* 한 줄 설명을 README·package.json·server.json 간 일치 ([97cd00a](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/97cd00aff011479579a902de87a3bc968b741217))
* 한글 조사에 밀착해 볼드가 안 걸리던 강조 표기 3곳 수정 ([bcdf3ae](https://github.com/opendata-kr/narajangteo-bid-mcp/commit/bcdf3aee8aa3abbe26713b0f4d0a275f61dedbc3))

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
