# core 0.4 이행 후속

- **라이브 재검증 1회**: 이행 후 실 API 구동 기록이 없다(기존 probe는 최초 빌드·첨부용). 승인 키로 전 도구를 구동해 스키마와 실응답 정합을 확인하고 `invalid > 0`이면 실패로 승격한다. 결과는 `.superpowers/sdd/probe-findings.md`에 기록.
