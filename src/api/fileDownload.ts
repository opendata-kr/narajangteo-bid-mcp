import { mkdir, open, unlink, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// 첨부 파일 다운로드·저장 계층. 경로순회 방어, 크기·타임아웃 가드, 실패 시 부분파일 정리를
// 담당한다. 추출·도구 로직은 이 파일에 두지 않는다.

const DEFAULT_MAX_BYTES = 104857600; // 100 MiB
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_SEGMENT_LEN = 200;

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// env 값을 유한한 숫자로만 채택한다. 미설정·빈값·비숫자는 undefined로 흘려 기본값이 이긴다.
function envNumber(key: string): number | undefined {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

// 파일명·디렉터리명 한 세그먼트를 안전하게 정규화한다. 경로순회 방어의 공용 진입점.
// basename으로 디렉터리를 떼고, 남은 `..`·선행 점·경로 구분자·제어문자·파일시스템
// 불법문자를 제거한 뒤 길이를 제한한다. 결과가 비면 fallback을 돌려준다.
export function sanitizeSegment(raw: string, fallback: string): string {
  let name = path.basename(raw ?? "");
  // posix basename은 백슬래시를 구분자로 보지 않으므로 직접 제거한다.
  name = name.replace(/[/\\]/g, "");
  // 파일시스템 불법문자(Windows 예약문자 포함)와 제어문자(0x00-0x1f) 제거. 정상 공백은 보존.
  name = name.replace(/[<>:"|?*\u0000-\u001f]/g, "");
  // 남은 `..` 시퀀스와 선행 점(숨김·순회) 제거.
  name = name.replace(/\.\./g, "");
  name = name.replace(/^\.+/, "");
  name = name.trim();

  if (name.length > MAX_SEGMENT_LEN) {
    const ext = path.extname(name);
    if (ext && ext.length <= 16) {
      name = name.slice(0, MAX_SEGMENT_LEN - ext.length) + ext;
    } else {
      name = name.slice(0, MAX_SEGMENT_LEN);
    }
  }

  return name.length > 0 ? name : fallback;
}

// resolved가 base와 같거나 base 하위인지 확인한다.
function isInside(base: string, resolved: string): boolean {
  return resolved === base || resolved.startsWith(base + path.sep);
}

// 공고번호별 저장 디렉터리를 만들고 절대경로를 돌려준다. baseDir은 env
// `DATA_GO_KR_DOWNLOAD_DIR`(상대경로면 홈 기준 절대화), 미설정 시 `~/Downloads`.
// 공고번호는 sanitizeSegment로 한 세그먼트로 정규화하고, 실제 경로가 baseDir 하위인지
// 재확인한 뒤에만 mkdir한다.
export async function resolveSaveDir(bidNtceNo: string): Promise<string> {
  const envDir = process.env.DATA_GO_KR_DOWNLOAD_DIR;
  let baseDir: string;
  if (envDir && envDir.trim() !== "") {
    baseDir = path.isAbsolute(envDir) ? envDir : path.resolve(os.homedir(), envDir);
  } else {
    baseDir = path.join(os.homedir(), "Downloads");
  }

  const safeBidId = sanitizeSegment(bidNtceNo, "unknown-bid");
  const saveDir = path.join(baseDir, safeBidId);

  const resolvedBase = path.resolve(baseDir);
  const resolvedDir = path.resolve(saveDir);
  if (!isInside(resolvedBase, resolvedDir)) {
    throw new Error(
      `저장 경로가 기준 디렉터리(${resolvedBase}) 밖으로 벗어났습니다. bidNtceNo 값을 확인하세요.`,
    );
  }

  await mkdir(saveDir, { recursive: true });
  return saveDir;
}

export interface DownloadOptions {
  fetch?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
}

// 저장할 파일명을 결정하는 순수 함수(디스크·네트워크 접근 없음). 경로순회 방어(sanitize +
// saveDir 하위 재확인) 후, reserved(이 호출에서 이미 계획한 이름 집합)로 동명을 판정해
// ` (n)` 서픽스를 붙이고 확정명을 등록한다. 순수·순서 결정적이라 같은 index는 재호출에도 같은
// 경로를 낳는다(재사용 스킵의 근거). 디스크 존재로 유일화하지 않는다.
export function planSavedPath(
  saveDir: string,
  fileNm: string,
  index: number,
  reserved: Set<string>,
): string {
  const fallbackName = `attachment-${index}`;
  let name = sanitizeSegment(fileNm, fallbackName);
  // 정규화 후에도 saveDir 하위를 벗어나면 대체명으로 강등한다.
  if (!isInside(path.resolve(saveDir), path.resolve(saveDir, name))) {
    name = sanitizeSegment(fallbackName, fallbackName);
  }
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let candidate = name;
  let n = 1;
  while (reserved.has(candidate)) {
    candidate = `${stem} (${n})${ext}`;
    n += 1;
  }
  reserved.add(candidate);
  return path.join(saveDir, candidate);
}

// URL을 GET으로 받아 정확히 savedPath에 저장한다(이름 계산은 planSavedPath 소관). serviceKey
// 없는 순수 요청이다. 방어: (1) 타임아웃 AbortController, (2) 크기 상한 이중 가드(content-length
// 선거부 + 스트리밍 누적 초과 시 중단). 원자적 저장: `savedPath + ".part"`에 받아 성공 시에만
// rename한다. 모든 실패 경로에서 임시 파일을 지우고 한국어 회복 지시로 throw한다(savedPath 존재
// = 완전한 다운로드 불변식, 재사용 스킵이 이에 의존).
export async function downloadToPath(
  url: string,
  savedPath: string,
  opts: DownloadOptions = {},
): Promise<{ byteSize: number }> {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const maxBytes = opts.maxBytes ?? envNumber("DATA_GO_KR_DOWNLOAD_MAX_BYTES") ?? DEFAULT_MAX_BYTES;
  const timeoutMs =
    opts.timeoutMs ?? envNumber("DATA_GO_KR_DOWNLOAD_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS;

  const partPath = savedPath + ".part";

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const timeoutError = (): Error =>
    new Error(
      `파일 다운로드가 ${timeoutMs}ms 안에 끝나지 않아 중단했습니다. DATA_GO_KR_DOWNLOAD_TIMEOUT_MS를 늘리거나 네트워크를 확인하세요.`,
    );

  let res: Response;
  try {
    res = await doFetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (timedOut) throw timeoutError();
    throw new Error(
      `파일 다운로드 요청이 실패했습니다(${errMessage(err)}). URL과 네트워크 상태를 확인하세요.`,
    );
  }

  try {
    if (!res.ok) {
      throw new Error(
        `파일 다운로드가 HTTP ${res.status} 오류로 실패했습니다. URL이 유효한지 확인하세요.`,
      );
    }

    const clHeader = res.headers.get("content-length");
    if (clHeader !== null) {
      const declared = Number(clHeader);
      if (Number.isFinite(declared) && declared > maxBytes) {
        throw new Error(
          `선언된 파일 크기(${declared} bytes)가 상한(${maxBytes} bytes)을 초과합니다. DATA_GO_KR_DOWNLOAD_MAX_BYTES를 늘리거나 다른 파일을 받으세요.`,
        );
      }
    }

    if (!res.body) {
      throw new Error("응답 본문이 비어 있어 파일을 저장할 수 없습니다. URL을 확인하세요.");
    }

    let fh: Awaited<ReturnType<typeof open>>;
    try {
      fh = await open(partPath, "w");
    } catch (err) {
      throw new Error(
        `파일을 저장할 위치를 열지 못했습니다(${errMessage(err)}). 저장 경로의 권한과 디스크 여유 공간을 확인하세요: ${savedPath}`,
      );
    }
    let received = 0;
    try {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        received += value.byteLength;
        if (received > maxBytes) {
          controller.abort();
          throw new Error(
            `다운로드 누적 크기가 상한(${maxBytes} bytes)을 초과해 중단했습니다. DATA_GO_KR_DOWNLOAD_MAX_BYTES를 조정하거나 다른 파일을 받으세요.`,
          );
        }
        try {
          await fh.write(value);
        } catch (werr) {
          throw new Error(
            `파일 저장 중 쓰기 오류가 발생했습니다(${errMessage(werr)}). 디스크 여유 공간과 저장 경로 권한을 확인하세요: ${savedPath}`,
          );
        }
      }
      // 완전 수신 후에만 원자적으로 최종 경로에 놓는다.
      await fh.close();
      await rename(partPath, savedPath);
    } catch (err) {
      await fh.close().catch(() => {});
      await unlink(partPath).catch(() => {});
      // 스트리밍 도중 타임아웃 abort는 reader가 원본 AbortError를 던지므로 한국어로 변환한다.
      if (timedOut) throw timeoutError();
      throw err instanceof Error ? err : new Error(errMessage(err));
    }

    return { byteSize: received };
  } finally {
    clearTimeout(timer);
  }
}
