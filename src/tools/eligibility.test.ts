import { describe, it, expect, vi } from "vitest";
import { runEligibility } from "./eligibility.js";

const LICENSE_LIMIT_OP = "getBidPblancListInfoLicenseLimit"; // E 면허제한
const REGION_OP = "getBidPblancListInfoPrtcptPsblRgn"; // F 참가가능지역

describe("runEligibility", () => {
  it("면허제한·참가가능지역을 라벨로 구분, bidNtceOrd 전송", async () => {
    // mock이 op별로 다른 표식(bidNtceNo=op명)을 반환 → 라벨↔op 대응 검증 가능
    const mockClient = {
      call: vi.fn(async (op: string) => ({
        totalCount: 1,
        items: [{ bidNtceNo: op, bidNtceOrd: "3" }],
      })),
    } as any;

    const out = await runEligibility(mockClient, { bidNtceNo: "R25", bidNtceOrd: "003" });

    // 두 라벨이 모두 results에 존재
    expect(Object.keys(out.results).sort()).toEqual(["licenseLimit", "region"]);

    // 라벨↔op 대응: licenseLimit는 면허제한 op, region은 참가가능지역 op에 붙는다.
    // mock이 op명을 표식으로 반환하므로 라벨이 뒤바뀌면 실패한다.
    const licenseLimit = out.results.licenseLimit;
    const region = out.results.region;
    expect(licenseLimit).toHaveProperty("status", "ok");
    expect(region).toHaveProperty("status", "ok");
    if (licenseLimit?.status === "ok") {
      expect(licenseLimit.items[0]).toHaveProperty("bidNtceNo", LICENSE_LIMIT_OP);
    }
    if (region?.status === "ok") {
      expect(region.items[0]).toHaveProperty("bidNtceNo", REGION_OP);
    }

    // 호출된 op가 ELIG_OPS 순서(E, F)와 일치하고 각각 inqryDiv="2"·bidNtceOrd 전달
    const calls = mockClient.call.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(LICENSE_LIMIT_OP);
    expect(calls[1][0]).toBe(REGION_OP);
    expect(calls[0][1]).toMatchObject({ inqryDiv: "2", bidNtceNo: "R25", bidNtceOrd: "003" });
    expect(calls[1][1]).toMatchObject({ inqryDiv: "2", bidNtceNo: "R25", bidNtceOrd: "003" });
  });

  it("bidNtceOrd 미지정 시 기본 000", async () => {
    const mockClient = {
      call: vi.fn(async () => ({ totalCount: 0, items: [] })),
    } as any;

    await runEligibility(mockClient, { bidNtceNo: "R25" });

    const calls = mockClient.call.mock.calls;
    expect(calls[0][1]).toMatchObject({ bidNtceOrd: "000" });
    expect(calls[1][1]).toMatchObject({ bidNtceOrd: "000" });
  });
});
