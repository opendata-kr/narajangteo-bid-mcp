import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RawItem } from "@opendata-kr/core";
import { formatItem, formatItems } from "./format.js";

interface Fixture {
  response: { body: { items: RawItem[] } };
}

function loadFixture(name: string): Fixture {
  const url = new URL(`../tests/fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as Fixture;
}

describe("format", () => {
  it("원본 item을 핵심 필드로 정제한다", () => {
    const fx = loadFixture("search-cnstwk.json");
    const first = formatItem(fx.response.body.items[0]!);
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

  it("formatItems는 배열을 매핑한다", () => {
    const fx = loadFixture("search-cnstwk.json");
    const out = formatItems(fx.response.body.items);
    expect(out).toHaveLength(2);
    expect(out[1]!.bidNtceNo).toBe("R25BK00932010");
  });
});
