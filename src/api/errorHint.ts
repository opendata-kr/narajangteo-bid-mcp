export interface KeyHintClient {
  readonly serviceKeyLooksPreEncoded?: boolean;
}

const AUTH_LIKE = /HTTP 40[13]|\[3\d\]|SERVICE_KEY|인증/i;

export function withKeyHint(client: KeyHintClient, message: string): string {
  if (client.serviceKeyLooksPreEncoded && AUTH_LIKE.test(message)) {
    return (
      message +
      " (인증 실패 시 Encoding 키의 이중 인코딩일 수 있습니다. data.go.kr의 Decoding 인증키를 DATA_GO_KR_SERVICE_KEY로 사용하세요.)"
    );
  }
  return message;
}
