import { describe, it, expect } from "vitest";
import { runOps } from "./runOps.js";

const fakeClient = (impl: (op: string) => Promise<{ totalCount: number; items: any[] }>) =>
  ({ call: (op: string) => impl(op) } as any);

describe("runOps", () => {
  it("op별 성공/에러를 개별 status로 유지 (flatten 금지)", async () => {
    const client = fakeClient(async (op) => {
      if (op === "opB") throw new Error("[30] 인증오류");
      return { totalCount: 1, items: [{ x: op }] };
    });
    const { results, anySucceeded } = await runOps(
      client,
      [
        { label: "a", op: "opA", params: {} },
        { label: "b", op: "opB", params: {} },
      ],
      (r) => r,
    );
    expect(results.a).toEqual({ status: "ok", totalCount: 1, items: [{ x: "opA" }] });
    expect(results.b).toEqual({ status: "error", error: "[30] 인증오류" });
    expect(anySucceeded).toBe(true);
  });

  it("전부 실패면 anySucceeded=false", async () => {
    const client = fakeClient(async () => { throw new Error("fail"); });
    const { anySucceeded } = await runOps(client, [{ label: "a", op: "o", params: {} }], (r) => r);
    expect(anySucceeded).toBe(false);
  });

  it("사전인코딩 키 + HTTP 401 에러면 Decoding 힌트가 붙는다", async () => {
    const client = {
      serviceKeyLooksPreEncoded: true,
      call: async () => {
        throw new Error("data.go.kr HTTP 401 오류 (operation=x)");
      },
    } as any;
    const { results } = await runOps(client, [{ label: "a", op: "o", params: {} }], (r) => r);
    const a = results.a as { status: "error"; error: string };
    expect(a.status).toBe("error");
    expect(a.error).toContain("Decoding 인증키");
  });

  it("사전인코딩 키가 아니면 HTTP 401 에러에도 힌트가 붙지 않는다", async () => {
    const client = {
      serviceKeyLooksPreEncoded: false,
      call: async () => {
        throw new Error("data.go.kr HTTP 401 오류 (operation=x)");
      },
    } as any;
    const { results } = await runOps(client, [{ label: "a", op: "o", params: {} }], (r) => r);
    const a = results.a as { status: "error"; error: string };
    expect(a.error).not.toContain("Decoding 인증키");
  });
});
