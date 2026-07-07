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
});
