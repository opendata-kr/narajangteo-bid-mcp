# 백로그: download_attachments 후속 개선

크리틱 루프·태스크 리뷰에서 나온 즉시수정 대상 밖 항목. 다음 세션 진입점.

## B1. fileIndex 모드는 대상 첨부만 다운로드 (효율). 해소(D3)
- 해소: 재사용(디스크 스킵)+fileIndex 대상 한정으로 구현(notes D3, 커밋 5acd03d). HWPX는 section*.xml만 선택 해제해 재추출 비용도 낮췄다.
- 잔여: 매 호출 URL 해소 API(데이터포털)는 남는다(파일명→경로 결정에 필요). 페이로드 작아 지연은 API 왕복뿐. 캐시는 도입 안 함.

## B2. 0건 공고에 fileIndex 지정 시 반환 (계약 vs UX)
- 현재: `list.length===0` 조기 반환이 fileIndex 검증 앞이라, 첨부 0건 공고에 fileIndex를 줘도 범위에러 없이 `files:[]`를 반환한다.
- 문제: 스펙 [입력 경계]는 "fileIndex 범위 초과 → 회복 지시 에러"인데 0건에서 fileIndex=0은 범위 밖이다.
- 판단 필요: 조회실패(resolveErrors 동반)일 때는 빈 files가 더 유용할 수 있어 에러 throw가 반드시 옳다고 단정 못 함. 사용자에게 방향 확인.
- 근거: Task 4 독립 리뷰 F3(Minor).

## B3. 구형 HWP 본문 압축·실파일 정합 라이브 검증
- 현재: HWP 본문 full 경로 단위테스트는 비압축·확장 size fixture로 커버. 압축(inflateRawSync)·실파일 레코드 정합은 라이브(Task 6 AC3)에 의존.
- 개선: 라이브 검증에서 실제 구형 .hwp의 본문 full 추출 품질을 확인하고, 오염·누락이 있으면 제어문자 길이 테이블을 실측으로 보정.
- 근거: Task 2 독립 리뷰 F2 커버리지.
