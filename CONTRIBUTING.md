# 기여 가이드

`@opendata-kr/narajangteo-bid-mcp`에 기여해 주셔서 감사합니다.

## 개발 환경

- Node 24 (`.nvmrc`)
- pnpm (`package.json`의 `packageManager` 필드로 버전 고정)

```bash
nvm use
pnpm install
```

## 작업 흐름

1. 큰 변경은 먼저 이슈로 논의하고, 작은 수정은 바로 PR을 올립니다.
2. `main`에서 브랜치를 따서 작업합니다.
3. 커밋 전 아래를 모두 통과시킵니다.

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest
pnpm build       # tsup
```

4. 커밋 메시지는 `feat:`, `fix:`, `docs:`, `chore:` 같은 접두사를 사용합니다.
5. PR을 열고 변경 의도와 검증 방법을 설명합니다. CI(typecheck/test/build)가 통과해야 합니다.

## 코드 규약

- TypeScript strict를 유지하고, 기존 파일의 스타일을 따릅니다.
- 응답 정제와 에러 정규화는 각각 `src/format.ts`, `src/api/errors.ts` 패턴을 재사용합니다.
- 새 기능은 테스트를 함께 추가합니다.

## 행동 강령

이 프로젝트는 [행동 강령](CODE_OF_CONDUCT.md)을 따릅니다.
