import { describe, expect, it } from "vitest";
import { listOperation } from "../api/endpoints.js";
import { makeTestClient, type OpStub } from "../test-helpers.js";
import { runGetNotice } from "./getNotice.js";

// 사전 인코딩된 키로 보이는 값 (%2F 포함). 기본 키 힌트 인터셉터를 발화시킨다.
const PRE_ENCODED_KEY = "abc%2Fdef";

describe("runGetNotice", () => {
  it("bidKind 미지정 시 매칭되는 구분의 공고를 반환한다", async () => {
    const { client } = makeTestClient({
      [listOperation("thng")]: {
        items: [{ bidNtceNo: "R25BK0001", bidNtceNm: "물품공고" }],
        totalCount: 1,
      },
    });
    const r = await runGetNotice(client, { bidNtceNo: "R25BK0001" });
    expect(r.found).toBe(true);
    expect(r.bidKind).toBe("thng");
    expect(r.notice?.bidNtceNm).toBe("물품공고");
    expect(r.invalidCount).toBe(0);
  });

  it("어디에도 없으면 found=false", async () => {
    const { client } = makeTestClient({});
    const r = await runGetNotice(client, { bidNtceNo: "X" });
    expect(r.found).toBe(false);
    expect(r.searchedKinds).toHaveLength(4);
  });

  it("모든 구분이 실패하면 found:false이고 errors가 포함된다", async () => {
    const all: Record<string, OpStub> = {};
    for (const k of ["cnstwk", "servc", "thng", "frgcpt"] as const) {
      all[listOperation(k)] = { errorCode: "30", errorMsg: "등록되지 않은 서비스키입니다." };
    }
    const { client } = makeTestClient(all);
    const r = await runGetNotice(client, { bidNtceNo: "X" });
    expect(r.found).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/등록되지 않은 서비스키/);
  });

  it("bidKind 지정 시 해당 구분만 조회한다", async () => {
    const { client, requests } = makeTestClient({
      [listOperation("cnstwk")]: { items: [{ bidNtceNo: "R1" }], totalCount: 1 },
    });
    const r = await runGetNotice(client, { bidNtceNo: "R1", bidKind: "cnstwk" });
    expect(requests).toHaveLength(1);
    expect(r.bidKind).toBe("cnstwk");
  });

  it("bidNtceOrd 포함 반환", async () => {
    const { client } = makeTestClient({
      [listOperation("thng")]: {
        items: [{ bidNtceNo: "R25", bidNtceOrd: "003", bidNtceNm: "공고" }],
        totalCount: 1,
      },
    });
    const out = await runGetNotice(client, { bidNtceNo: "R25", bidKind: "thng" });
    expect(out.found).toBe(true);
    expect(out.notice?.bidNtceOrd).toBe("003");
  });

  it("한 kind 에러여도 다른 kind found면 found 우선", async () => {
    const { client } = makeTestClient({
      [listOperation("cnstwk")]: { errorCode: "99", errorMsg: "일시오류" },
      [listOperation("servc")]: { items: [{ bidNtceNo: "R25", bidNtceOrd: "1" }], totalCount: 1 },
    });
    const out = await runGetNotice(client, { bidNtceNo: "R25" }); // 전 kind
    expect(out.found).toBe(true);
  });

  it("사전인코딩 키 + 인증류 에러면 errors에 Decoding 힌트가 붙는다", async () => {
    const all: Record<string, OpStub> = {};
    for (const k of ["cnstwk", "servc", "thng", "frgcpt"] as const) {
      all[listOperation(k)] = { errorCode: "30", errorMsg: "등록되지 않은 서비스키" };
    }
    const { client } = makeTestClient(all, { serviceKey: PRE_ENCODED_KEY });
    const r = await runGetNotice(client, { bidNtceNo: "X" });
    expect(r.found).toBe(false);
    expect(r.errors.some((m) => m.includes("Decoding 인증키"))).toBe(true);
  });

  it("사전인코딩이 아니면 인증류 에러에도 힌트가 붙지 않는다", async () => {
    const all: Record<string, OpStub> = {};
    for (const k of ["cnstwk", "servc", "thng", "frgcpt"] as const) {
      all[listOperation(k)] = { errorCode: "30", errorMsg: "등록되지 않은 서비스키" };
    }
    const { client } = makeTestClient(all);
    const r = await runGetNotice(client, { bidNtceNo: "X" });
    expect(r.found).toBe(false);
    expect(r.errors.some((m) => m.includes("Decoding 인증키"))).toBe(false);
  });
});
