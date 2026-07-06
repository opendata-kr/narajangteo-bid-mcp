import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { searchOperation } from "./endpoints.js";
import { callOperation } from "./client.js";

const hasKey = Boolean(process.env.DATA_GO_KR_SERVICE_KEY);

describe.skipIf(!hasKey)("client 통합(실 API)", () => {
  it("공사 검색이 응답한다", async () => {
    const config = loadConfig(process.env);
    const r = await callOperation(config, searchOperation("cnstwk"), {
      pageNo: 1,
      numOfRows: 1,
    });
    expect(r.totalCount).toBeGreaterThanOrEqual(0);
  }, 15_000);
});
