# MCP 표준 감사 후속 백로그

워크스페이스 MCP 표준 감사(4서버 교차)가 이 리포에 남긴 항목.

## A1. MCP 핸드셰이크 버전 0.0.0 교정

`src/server.ts`가 `version: "0.0.0"`을 하드코딩한다. 형제 리포처럼 `src/version.ts`(release-please `x-release-please-start-version` 마커)를 신설하고 server.ts가 import하며, `release-please-config.json` extra-files에 `{ "type": "generic", "path": "src/version.ts" }`를 등록한다. 발행 패키지의 MCP 클라이언트가 실버전을 받게 된다.

## A2. server.json icons 누락

prespec·opening과 달리 server.json에 조직 통일 `icons`(정본 URL)가 없다. 발행 전 체크리스트 항목이라 다음 릴리스 전에 추가한다. 스킬 `authoring-service-readme` [메타데이터 정합] 참조.

## A3. core 0.4.0 이행과 함께 처리할 항목

수기 Args의 z.infer 통일, runOps 라벨 제네릭 보존, 인라인 `inqryDiv` 정리는 core 이행 PR에서 흡수한다. 목록은 core 리포 `docs/roadmap/2026-07-14-typed-transport-followups.md` B4.
