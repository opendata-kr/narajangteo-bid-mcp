import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sanitizeSegment, resolveSaveDir, downloadToFile } from "./fileDownload.js";

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

  it("경로 구분자를 제거한다", () => {
    expect(sanitizeSegment("foo\\bar.hwp", "fb")).toBe("foobar.hwp");
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

describe("downloadToFile", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "bid-file-"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("정상 응답을 파일로 저장하고 byteSize를 반환한다", async () => {
    const bytes = new TextEncoder().encode("hello");
    const fetch = makeFetch(() => streamResponse(bytes, bytes.byteLength));
    const { savedPath, byteSize } = await downloadToFile("http://x/f", "제안요청서.hwpx", dir, {
      fetch,
    });
    expect(byteSize).toBe(5);
    expect(savedPath).toBe(path.join(dir, "제안요청서.hwpx"));
    expect(await readFile(savedPath, "utf8")).toBe("hello");
  });

  it("동명 파일 충돌 시 두 번째는 ` (1)` 서픽스를 붙인다", async () => {
    const bytes = new TextEncoder().encode("data");
    const fetch = makeFetch(() => streamResponse(bytes));
    const first = await downloadToFile("http://x/f", "문서.hwp", dir, { fetch });
    const second = await downloadToFile("http://x/f", "문서.hwp", dir, { fetch });
    expect(path.basename(first.savedPath)).toBe("문서.hwp");
    expect(path.basename(second.savedPath)).toBe("문서 (1).hwp");
  });

  it("content-length가 상한을 초과하면 즉시 거부하고 파일을 만들지 않는다", async () => {
    const bytes = new TextEncoder().encode("way too big");
    const fetch = makeFetch(() => streamResponse(bytes, bytes.byteLength));
    await expect(
      downloadToFile("http://x/f", "big.bin", dir, { fetch, maxBytes: 3 }),
    ).rejects.toThrow();
    expect(existsSync(path.join(dir, "big.bin"))).toBe(false);
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
    await expect(
      downloadToFile("http://x/f", "chunked.bin", dir, { fetch, maxBytes: 3 }),
    ).rejects.toThrow();
    expect(existsSync(path.join(dir, "chunked.bin"))).toBe(false);
  });

  it("위조된 content-length(작은 값+큰 본문)도 스트리밍 누적으로 잡아 거부한다", async () => {
    const big = new Uint8Array(10);
    const fetch = makeFetch(() => streamResponse(big, 2)); // 선언 2, 실제 10
    await expect(
      downloadToFile("http://x/f", "forged.bin", dir, { fetch, maxBytes: 3 }),
    ).rejects.toThrow(/상한/);
    expect(existsSync(path.join(dir, "forged.bin"))).toBe(false);
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
    await expect(
      downloadToFile("http://x/f", "slow.bin", dir, { fetch: hangingFetch, timeoutMs: 20 }),
    ).rejects.toThrow(/DATA_GO_KR_DOWNLOAD_TIMEOUT_MS/);
    expect(existsSync(path.join(dir, "slow.bin"))).toBe(false);
  });

  it("저장 위치를 열 수 없으면(없는 디렉터리) 한국어 회복 지시로 throw한다", async () => {
    const bytes = new TextEncoder().encode("x");
    const fetch = makeFetch(() => streamResponse(bytes));
    const missingDir = path.join(dir, "does-not-exist");
    await expect(
      downloadToFile("http://x/f", "a.bin", missingDir, { fetch }),
    ).rejects.toThrow(/저장/);
  });

  it("악성 fileNm은 saveDir 하위에만 저장한다", async () => {
    const bytes = new TextEncoder().encode("x");
    const fetch = makeFetch(() => streamResponse(bytes));
    const { savedPath } = await downloadToFile("http://x/f", "../../etc/passwd", dir, { fetch });
    expect(savedPath).toBe(path.join(dir, "passwd"));
    expect(path.dirname(savedPath)).toBe(dir);
  });

  it("HTTP 오류 응답이면 파일을 남기지 않고 throw한다", async () => {
    const fetch = makeFetch(() => new Response("nope", { status: 404 }));
    await expect(downloadToFile("http://x/f", "err.bin", dir, { fetch })).rejects.toThrow();
    expect(existsSync(path.join(dir, "err.bin"))).toBe(false);
  });
});
