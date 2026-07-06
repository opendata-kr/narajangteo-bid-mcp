# 보안 정책

## 취약점 신고

`@opendata-kr/narajangteo-bid-mcp`에서 보안 취약점을 발견하면 **공개 이슈로 올리지 말고** 아래 경로로 비공개 신고해 주세요.

- **권장**: GitHub 저장소의 Security 탭에서 Private vulnerability reporting으로 신고 (저장소에서 이 기능이 활성화된 경우).
- **대체**: joojinhyun00@gmail.com 으로 이메일.

신고에는 재현 절차, 영향 범위, 가능하면 PoC를 포함해 주세요. 접수 후 확인하고 수정 계획을 회신합니다.

## 서비스키 취급 주의

이 서버는 `DATA_GO_KR_SERVICE_KEY`(공공데이터포털 Decoding 서비스키)를 환경변수로 받습니다. 키를 코드, 설정 파일, 이슈 본문에 절대 포함하지 마세요. `.env`는 `.gitignore`에 등록되어 있습니다.

## 지원 버전

첫 정식 릴리스 전(0.0.x) 단계라 최신 커밋만 지원합니다.
