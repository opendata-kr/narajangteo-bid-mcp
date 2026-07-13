# 백로그: download_attachments 후속 개선

크리틱 루프·태스크 리뷰에서 나온 즉시수정 대상 밖 항목. 다음 세션 진입점.

## B1. (폐기) fileIndex 모드는 대상 첨부만 다운로드
- 폐기: notes D6/D7의 2-도구 펼침 모델로 fileIndex 개념이 사라졌다. read_attachment는 영속 카탈로그(`.attachments-manifest.json`)를 읽어 index로 디스크 파일을 직독하므로 매 호출 URL 해소 API도 없다.

## B2. (폐기) 0건 공고에 fileIndex 지정 시 반환
- 폐기: fileIndex 제거. read_attachment는 첨부 0건 공고에 "첨부 파일이 없습니다" 회복 지시 에러를 던진다(코드 리뷰 F9 반영).

## B3. 구형 HWP 본문 압축·실파일 정합 라이브 검증 (대체로 해소)
- 해소: R26BK01629724·R26BK01630829 라이브에서 실제 구형 .hwp/.doc 본문 full 추출 확인(제안요청서·제안평가 공고 정상). 압축 본문 품질 이상 없음.
- 잔여: 다양한 정부 .hwp 변형(제어문자 길이·압축 레코드)은 표본이 좁다. 이상 발견 시 제어문자 테이블 실측 보정.

## B4. 파일 저장·다운로드 신뢰성 계층 core 승격 (rule-of-two 대기)
- 발견: 교차 정합 렌즈 F2. `api/fileDownload.ts`(경로순회 방어·원자적 저장·크기/타임아웃 이중 가드)는 도메인 무관 파일 페치 신뢰성 계층으로 core 헌장과 정렬되나, 형제 3리포(prespec·opening·corpinfo)에 파일 기능이 0건이라 rule-of-two 미충족.
- 처방: 2번째 파일 저장 서비스 등장 시 승격 판단. core에 넣을지 신규 `@opendata-kr/files`로 뺄지 그때 결정(core=전송/JSON, 파일I/O는 성격 다름).

## B5. 문서 추출기 별도 패키지 후보 (rule-of-two 대기)
- 발견: 교차 정합 F3. `extract/{doc,hwp,hwpx,zip}.ts`(OWPML·OLE·HWP 레코드 파싱)는 core(전송) 책무 아님. data.go.kr 다수 서비스가 HWP 첨부를 달지만 별도 문서파싱 패키지(예 `@opendata-kr/hwp`) 후보. rule-of-two 미충족이라 현 조치 없음. 승격 시 core에 섞지 말 것.

## B6. 최상위 첨부 순차 다운로드 → 동시성 적용
- 발견: 교차 정합 F4. `attachmentManifest.ts` materialize가 top-level 첨부를 순차 다운로드. 조직 관례는 fanOut/mapWithConcurrency 병렬. 카탈로그 index는 flatten 순서가 사전 확정이라 병렬화해도 결정성 유지.
- 처방: 순차가 의도(서버 예의·디스크 부하)면 주석으로 근거 명기, 아니면 제한 병렬화.

## B7. 손상 .doc 부분 추출을 full로 보고
- 발견: 코드 리뷰 F3. `extract/doc.ts` decodePieces가 범위 초과 조각을 조용히 건너뛰고, 텍스트가 비지 않으면 status="full". 손상 파일에서 부분 누락이 완전 추출로 보고됨.
- 처방: 조각 스킵이 있으면 status나 note로 부분 추출임을 표시.

## B8. `.part` rename 경쟁 · 얇은 방어선
- 발견: 코드 리뷰 F8·F10. 같은 bidNtceNo로 download와 read가 동시 실행되면 같은 `.part` 경로에서 경쟁 가능. `resolveSaveDir`·`resolveAttachments`는 per-file try/catch 밖이라 예기치 못한 throw 시 도구 전체가 죽음.
- 처방: `.part`에 고유 접미사(pid·카운터), 또는 동시 실행을 계약상 배제. 최상단 try/catch 보강.

## B9. (타 리포) opening-mcp 서버 에러 처리 drift
- 발견: 교차 정합 F6. `narajangteo-opening-mcp/src/server.ts`가 인라인 errMessage + withKeyHint 누락. bid·prespec·corpinfo는 `withKeyHint(client, errMessage(err))` 사용.
- 처방: opening 서버를 형제 3리포와 동일 패턴으로 정렬(opening 리포 소관, 이 리포 백로그엔 포인터만).

## B10. stdNtceDocUrl 단독 공고 엣지
- 발견: 도메인 충실성. `stdNtceDocUrl`(표준공고서)은 보통 ntceSpecDocUrl1과 fileSeq 중복이라 dedup으로 스킵되나, 표준공고서만 있고 규격서가 없는 공고면 누락 가능. 라이브 빈도 미측정.
- 처방: 표준공고서 단독 공고 표본 확인 후 필요 시 소스 편입.
