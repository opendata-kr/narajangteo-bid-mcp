import { describe, it, expect } from "vitest";
import { makeTestClient } from "../test-helpers.js";
import { runEligibility } from "./eligibility.js";

const LICENSE_LIMIT_OP = "getBidPblancListInfoLicenseLimit"; // E 면허제한
const REGION_OP = "getBidPblancListInfoPrtcptPsblRgn"; // F 참가가능지역

describe("runEligibility", () => {
  it("면허제한·참가가능지역을 라벨로 구분, bidNtceOrd 전송", async () => {
    // 스텁이 op별로 다른 표식(bidNtceNo=op명)을 반환 → 라벨↔op 대응 검증 가능
    const { client, requests } = makeTestClient({
      [LICENSE_LIMIT_OP]: { items: [{ bidNtceNo: LICENSE_LIMIT_OP, bidNtceOrd: "3" }], totalCount: 1 },
      [REGION_OP]: { items: [{ bidNtceNo: REGION_OP, bidNtceOrd: "3" }], totalCount: 1 },
    });

    const out = await runEligibility(client, { bidNtceNo: "R25", bidNtceOrd: "003" });

    // 두 라벨이 모두 results에 존재
    expect(Object.keys(out.results).sort()).toEqual(["licenseLimit", "region"]);

    // 라벨↔op 대응: licenseLimit는 면허제한 op, region은 참가가능지역 op에 붙는다.
    const licenseLimit = out.results.licenseLimit;
    const region = out.results.region;
    expect(licenseLimit).toHaveProperty("status", "ok");
    expect(region).toHaveProperty("status", "ok");
    if (licenseLimit.status === "ok") {
      expect(licenseLimit.items[0]).toHaveProperty("bidNtceNo", LICENSE_LIMIT_OP);
    }
    if (region.status === "ok") {
      expect(region.items[0]).toHaveProperty("bidNtceNo", REGION_OP);
    }

    // 호출된 op가 ELIG_OPS 순서(E, F)와 일치하고 각각 inqryDiv="2"·bidNtceOrd 전달
    expect(requests).toHaveLength(2);
    const ops = requests.map((q) => q.op).sort();
    expect(ops).toEqual([LICENSE_LIMIT_OP, REGION_OP].sort());
    for (const q of requests) {
      expect(q.params.get("inqryDiv")).toBe("2");
      expect(q.params.get("bidNtceNo")).toBe("R25");
      expect(q.params.get("bidNtceOrd")).toBe("003");
    }
  });

  it("bidNtceOrd 미지정 시 기본 000", async () => {
    const { client, requests } = makeTestClient({});
    await runEligibility(client, { bidNtceNo: "R25" });
    expect(requests[0]!.params.get("bidNtceOrd")).toBe("000");
    expect(requests[1]!.params.get("bidNtceOrd")).toBe("000");
  });
});
