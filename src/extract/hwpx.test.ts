import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { extractHwpx } from "./hwpx.js";

// OWPML(HWPX 본문 XML 포맷) 픽스처를 in-test로 zip해 실파일 없이 검증한다.
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "hwpx-test-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeZip(
  files: Record<string, string>,
  name: string,
): Promise<string> {
  const enc = new TextEncoder();
  const entries: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) entries[k] = enc.encode(v);
  const buf = zipSync(entries);
  const filePath = join(dir, name);
  await writeFile(filePath, buf);
  return filePath;
}

describe("extractHwpx", () => {
  it("section*.xml에서 태그 제거·엔티티 디코드·공백 정규화한 본문을 full로 반환", async () => {
    const filePath = await writeZip(
      { "Contents/section0.xml": "<p>제안<b>요청서</b> &amp; 과업</p>" },
      "ok.hwpx",
    );
    const r = await extractHwpx(filePath);
    expect(r.status).toBe("full");
    // 태그가 공백으로 치환되고(스펙: `<[^>]+>`→공백) 엔티티가 디코드된다.
    expect(r.text).toBe("제안 요청서 & 과업");
    // 태그·미디코드 엔티티가 남지 않는다.
    expect(r.text).not.toContain("<");
    expect(r.text).not.toContain("&amp;");
  });

  it("여러 section을 번호순으로 이어붙인다", async () => {
    const filePath = await writeZip(
      {
        "Contents/section1.xml": "<p>둘째</p>",
        "Contents/section0.xml": "<p>첫째</p>",
      },
      "multi.hwpx",
    );
    const r = await extractHwpx(filePath);
    expect(r.status).toBe("full");
    expect(r.text).toBe("첫째 둘째");
  });

  it("숫자참조(&#dddd; ·&#xHHHH;)를 디코드한다", async () => {
    // &#44032; = '가', &#xAC01; = '각'
    const filePath = await writeZip(
      { "Contents/section0.xml": "<p>&#44032;&#xAC01;</p>" },
      "num.hwpx",
    );
    const r = await extractHwpx(filePath);
    expect(r.status).toBe("full");
    expect(r.text).toBe("가각");
  });

  it("section*.xml이 없으면 error", async () => {
    const filePath = await writeZip(
      { "Contents/header.xml": "<x/>" },
      "nosection.hwpx",
    );
    const r = await extractHwpx(filePath);
    expect(r.status).toBe("error");
    expect(r.error).toBeTruthy();
  });

  it("zip이 아니면(손상) error", async () => {
    const filePath = join(dir, "broken.hwpx");
    await writeFile(filePath, Buffer.from([0x00, 0x01, 0x02, 0x03]));
    const r = await extractHwpx(filePath);
    expect(r.status).toBe("error");
    expect(r.error).toBeTruthy();
  });

  it("추출 텍스트가 비면 error", async () => {
    const filePath = await writeZip(
      { "Contents/section0.xml": "<p>   </p>" },
      "empty.hwpx",
    );
    const r = await extractHwpx(filePath);
    expect(r.status).toBe("error");
  });
});
