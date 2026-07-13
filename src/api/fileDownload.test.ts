import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sanitizeSegment, resolveSaveDir, planSavedPath, downloadToPath } from "./fileDownload.js";

// 웹 표준 Response를 감싼 fake fetch. 스트림 본문을 매 호출 새로 만들어(스트림은 1회 소비)
// 실 네트워크 없이 주입한다. 캐스트는 이 주입 지점에만 둔다.
const makeFetch = (makeResponse: () => Response): typeof fetch =>
  (async () => makeResponse()) as unknown as typeof fetch;

const streamResponse = (bytes: Uint8Array, contentLength?: number): Response => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const headers: Record<string, string> = {};
  if (contentLength !== undefined) headers["content-length"] = String(contentLength);
  return new Response(stream, { status: 200, headers });
};

describe("sanitizeSegment", () => {
  it("경로순회 세그먼트에서 디렉터리를 제거하고 파일명만 남긴다", () => {
    expect(sanitizeSegment("../../etc/passwd", "fb")).toBe("passwd");
  });

  it("`..`만 있으면 fallback을 반환한다", () => {
    expect(sanitizeSegment("..", "fb")).toBe("fb");
  });

  it("빈 문자열이면 fallback을 반환한다", () => {
    expect(sanitizeSegment("", "fb")).toBe("fb");
  });

  it("한글 파일명을 보존한다", () => {
    expect(sanitizeSegment("제안요청서.hwpx", "fb")).toBe("제안요청서.hwpx");
  });

  it("경로 구분자(백슬래시)를 제거한다", () => {
    // 결과 문자열은 플랫폼마다 다르다(Windows basename은 `\`를 구분자로 봐 앞부분을 떼고,
    // POSIX는 리터럴로 봐 코드가 제거). 어느 쪽이든 구분자 없는 안전한 단일 세그먼트여야 한다.
    const out = sanitizeSegment("foo\\bar.hwp", "fb");
    expect(out).not.toMatch(/[/\\]/);
    expect(out.endsWith("bar.hwp")).toBe(true);
  });

  it("200자를 초과하면 확장자를 보존하며 절단한다", () => {
    const long = "a".repeat(300) + ".hwp";
    const out = sanitizeSegment(long, "fb");
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith(".hwp")).toBe(true);
  });
});

describe("resolveSaveDir", () => {
  let base: string;
  const orig = process.env.DATA_GO_KR_DOWNLOAD_DIR;

  beforeAll(async () => {
    base = await mkdtemp(path.join(tmpdir(), "bid-dl-"));
  });
  afterAll(async () => {
    await rm(base, { recursive: true, force: true });
  });
  afterEach(() => {
    if (orig === undefined) delete process.env.DATA_GO_KR_DOWNLOAD_DIR;
    else process.env.DATA_GO_KR_DOWNLOAD_DIR = orig;
  });

  it("정상 bidNtceNo는 base 하위 디렉터리를 만든다", async () => {
    process.env.DATA_GO_KR_DOWNLOAD_DIR = base;
    const dir = await resolveSaveDir("R26BK01606996");
    expect(dir).toBe(path.join(base, "R26BK01606996"));
    expect(existsSync(dir)).toBe(true);
  });

  it("악성 bidNtceNo도 base 하위를 벗어나지 않는다", async () => {
    process.env.DATA_GO_KR_DOWNLOAD_DIR = base;
    const dir = await resolveSaveDir("../../etc");
    expect(dir).toBe(path.join(base, "etc"));
    expect(dir.startsWith(base + path.sep)).toBe(true);
  });

  it("빈 bidNtceNo는 unknown-bid 디렉터리를 쓴다", async () => {
    process.env.DATA_GO_KR_DOWNLOAD_DIR = base;
    const dir = await resolveSaveDir("");
    expect(dir).toBe(path.join(base, "unknown-bid"));
  });
});

describe("planSavedPath", () => {
  // 순수 함수라 디스크 접근이 없다. saveDir은 임의 문자열이면 된다.
  const dir = path.join(tmpdir(), "plan-base");

  it("정상 파일명은 saveDir/파일명을 결정한다", () => {
    expect(planSavedPath(dir, "제안요청서.hwpx", 0, new Set())).toBe(
      path.join(dir, "제안요청서.hwpx"),
    );
  });

  it("한 호출 안 서로 다른 동명은 reserved 기준 ` (1)` 서픽스", () => {
    const reserved = new Set<string>();
    const a = planSavedPath(dir, "문서.hwp", 0, reserved);
    const b = planSavedPath(dir, "문서.hwp", 1, reserved);
    expect(path.basename(a)).toBe("문서.hwp");
    expect(path.basename(b)).toBe("문서 (1).hwp");
  });

  it("순수·순서 결정적이라 새 reserved면 같은 index는 같은 경로(재사용 근거)", () => {
    expect(planSavedPath(dir, "문서.hwp", 0, new Set())).toBe(
      planSavedPath(dir, "문서.hwp", 0, new Set()),
    );
  });

  it("악성 fileNm은 saveDir 하위로 강등한다", () => {
    const p = planSavedPath(dir, "../../etc/passwd", 0, new Set());
    expect(p).toBe(path.join(dir, "passwd"));
    expect(path.dirname(p)).toBe(dir);
  });

  it("빈 결과는 attachment-<index> 대체명", () => {
    expect(path.basename(planSavedPath(dir, "..", 3, new Set()))).toBe("attachment-3");
  });
});

describe("downloadToPath", () => {
  let dir: string;
  const target = (name: string): string => path.join(dir, name);

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "bid-file-"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("정상 응답을 정확 경로에 저장하고 byteSize를 반환한다(임시파일 정리)", async () => {
    const bytes = new TextEncoder().encode("hello");
    const fetch = makeFetch(() => streamResponse(bytes, bytes.byteLength));
    const sp = target("제안요청서.hwpx");
    const { byteSize } = await downloadToPath("http://x/f", sp, { fetch });
    expect(byteSize).toBe(5);
    expect(await readFile(sp, "utf8")).toBe("hello");
    expect(existsSync(sp + ".part")).toBe(false);
  });

  it("content-length가 상한을 초과하면 즉시 거부하고 파일을 만들지 않는다", async () => {
    const bytes = new TextEncoder().encode("way too big");
    const fetch = makeFetch(() => streamResponse(bytes, bytes.byteLength));
    const sp = target("big.bin");
    await expect(downloadToPath("http://x/f", sp, { fetch, maxBytes: 3 })).rejects.toThrow();
    expect(existsSync(sp)).toBe(false);
    expect(existsSync(sp + ".part")).toBe(false);
  });

  it("content-length 없는 청크드 응답이 누적 상한을 넘으면 중단하고 부분 파일을 남기지 않는다", async () => {
    const fetch = makeFetch(() => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(2));
          controller.enqueue(new Uint8Array(2));
          controller.enqueue(new Uint8Array(2));
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    });
    const sp = target("chunked.bin");
    await expect(downloadToPath("http://x/f", sp, { fetch, maxBytes: 3 })).rejects.toThrow();
    expect(existsSync(sp)).toBe(false);
    expect(existsSync(sp + ".part")).toBe(false);
  });

  it("위조된 content-length(작은 값+큰 본문)도 스트리밍 누적으로 잡아 거부한다", async () => {
    const big = new Uint8Array(10);
    const fetch = makeFetch(() => streamResponse(big, 2)); // 선언 2, 실제 10
    const sp = target("forged.bin");
    await expect(downloadToPath("http://x/f", sp, { fetch, maxBytes: 3 })).rejects.toThrow(/상한/);
    expect(existsSync(sp)).toBe(false);
  });

  it("스트리밍 도중 타임아웃은 한국어 회복 지시로 변환한다", async () => {
    // signal.abort에 반응해 스트림을 error시키는 fake(실 fetch의 body abort 흉내).
    const hangingFetch = (async (_url: string, init?: { signal?: AbortSignal }) => {
      const signal = init?.signal;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(1));
          signal?.addEventListener("abort", () =>
            controller.error(new DOMException("aborted", "AbortError")),
          );
        },
      });
      return new Response(stream, { status: 200 });
    }) as unknown as typeof fetch;
    const sp = target("slow.bin");
    await expect(
      downloadToPath("http://x/f", sp, { fetch: hangingFetch, timeoutMs: 20 }),
    ).rejects.toThrow(/DATA_GO_KR_DOWNLOAD_TIMEOUT_MS/);
    expect(existsSync(sp)).toBe(false);
    expect(existsSync(sp + ".part")).toBe(false);
  });

  it("저장 위치를 열 수 없으면(없는 디렉터리) 한국어 회복 지시로 throw한다", async () => {
    const bytes = new TextEncoder().encode("x");
    const fetch = makeFetch(() => streamResponse(bytes));
    const sp = path.join(dir, "does-not-exist", "a.bin");
    await expect(downloadToPath("http://x/f", sp, { fetch })).rejects.toThrow(/저장/);
  });

  it("HTTP 오류 응답이면 파일을 남기지 않고 throw한다", async () => {
    const fetch = makeFetch(() => new Response("nope", { status: 404 }));
    const sp = target("err.bin");
    await expect(downloadToPath("http://x/f", sp, { fetch })).rejects.toThrow();
    expect(existsSync(sp)).toBe(false);
  });
});
