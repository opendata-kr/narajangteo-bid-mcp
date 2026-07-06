import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RawApiResponse } from "./api/types.js";
import { extractItems, formatItem, formatItems } from "./format.js";

function loadFixture(name: string): RawApiResponse {
  const url = new URL(`../tests/fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as RawApiResponse;
}

describe("format", () => {
  it("원본 item을 핵심 필드로 정제한다", () => {
    const fx = loadFixture("search-cnstwk.json");
    const items = extractItems(fx.response.body);
    const first = formatItem(items[0]!);
    expect(first.bidNtceNo).toBe("R25BK00932003");
    expect(first.bidNtceNm).toBe("문성고등학교 비탈면공사 수의계약 안내공고");
    expect(first.presmptPrce).toBe("180645355");
    expect(first.bidNtceDtlUrl).toBe("https://www.g2b.go.kr/example1");
  });

  it("누락 필드는 빈 문자열로 채운다", () => {
    const result = formatItem({ bidNtceNo: "X1" });
    expect(result.bidNtceNo).toBe("X1");
    expect(result.bidNtceNm).toBe("");
    expect(result.dminsttNm).toBe("");
  });

  it("빈 문자열 items를 빈 배열로 해석한다", () => {
    const fx = loadFixture("no-data.json");
    expect(extractItems(fx.response.body)).toEqual([]);
  });

  it("formatItems는 배열을 매핑한다", () => {
    const fx = loadFixture("search-cnstwk.json");
    const out = formatItems(extractItems(fx.response.body));
    expect(out).toHaveLength(2);
    expect(out[1]!.bidNtceNo).toBe("R25BK00932010");
  });
});
