import { describe, it, expect } from "vitest";
import { z } from "zod";
import { makeTestClient } from "../test-helpers.js";
import { runOps } from "./runOps.js";

const AnySchema = z.looseObject({});
type AnyRaw = z.infer<typeof AnySchema>;
const identity = (r: AnyRaw): AnyRaw => r;

// 사전 인코딩된 키로 보이는 값 (%2F 포함). 기본 키 힌트 인터셉터를 발화시킨다.
const PRE_ENCODED_KEY = "abc%2Fdef";

describe("runOps", () => {
  it("op별 성공/에러를 개별 status로 유지 (flatten 금지)", async () => {
    const { client } = makeTestClient({
      opA: { items: [{ x: "opA" }], totalCount: 1 },
      opB: { errorCode: "30", errorMsg: "인증오류" },
    });
    const { results, anySucceeded } = await runOps(
      client,
      [
        { label: "a", op: "opA", params: {} },
        { label: "b", op: "opB", params: {} },
      ],
      AnySchema,
      identity,
    );
    expect(results.a).toEqual({ status: "ok", totalCount: 1, invalidCount: 0, items: [{ x: "opA" }] });
    expect(results.b).toEqual({ status: "error", error: "[30] 인증오류" });
    expect(anySucceeded).toBe(true);
  });

  it("전부 실패면 anySucceeded=false", async () => {
    const { client } = makeTestClient({ o: { errorCode: "99", errorMsg: "fail" } });
    const { anySucceeded } = await runOps(
      client, [{ label: "a", op: "o", params: {} }], AnySchema, identity,
    );
    expect(anySucceeded).toBe(false);
  });

  it("사전인코딩 키 + 인증류 에러(코드 30)면 Decoding 힌트가 붙는다", async () => {
    const { client } = makeTestClient(
      { o: { errorCode: "30", errorMsg: "등록되지 않은 서비스키" } },
      { serviceKey: PRE_ENCODED_KEY },
    );
    const { results } = await runOps(
      client, [{ label: "a", op: "o", params: {} }], AnySchema, identity,
    );
    const a = results.a;
    expect(a.status).toBe("error");
    if (a.status === "error") expect(a.error).toContain("Decoding 인증키");
  });

  it("사전인코딩 키가 아니면 인증류 에러에도 힌트가 붙지 않는다", async () => {
    const { client } = makeTestClient({
      o: { errorCode: "30", errorMsg: "등록되지 않은 서비스키" },
    });
    const { results } = await runOps(
      client, [{ label: "a", op: "o", params: {} }], AnySchema, identity,
    );
    const a = results.a;
    if (a.status === "error") expect(a.error).not.toContain("Decoding 인증키");
  });

  it("스키마 탈락 item은 items에서 빠지고 invalidCount로 집계된다", async () => {
    const StrictSchema = z.looseObject({ id: z.string() });
    const { client } = makeTestClient({
      o: { items: [{ id: "ok" }, { id: 123 }], totalCount: 2 },
    });
    const { results } = await runOps(
      client,
      [{ label: "a", op: "o", params: {} }],
      StrictSchema,
      (r: z.infer<typeof StrictSchema>) => r.id,
    );
    expect(results.a).toEqual({ status: "ok", totalCount: 2, invalidCount: 1, items: ["ok"] });
  });
});
