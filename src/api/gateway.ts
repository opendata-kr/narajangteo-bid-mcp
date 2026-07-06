import { createClient, type DataGoKrClient } from "@opendata-kr/core";

const SERVICE_PATH = "/1230000/ad/BidPublicInfoService";

export function createGateway(): DataGoKrClient {
  return createClient({ path: SERVICE_PATH, params: { type: "json" } });
}
