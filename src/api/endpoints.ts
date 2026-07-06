export type BidKind = "cnstwk" | "servc" | "thng" | "frgcpt";

export const ALL_BID_KINDS: readonly BidKind[] = [
  "cnstwk",
  "servc",
  "thng",
  "frgcpt",
];

export const BID_KIND_LABEL: Record<BidKind, string> = {
  cnstwk: "공사",
  servc: "용역",
  thng: "물품",
  frgcpt: "외자",
};

const SUFFIX: Record<BidKind, string> = {
  cnstwk: "Cnstwk",
  servc: "Servc",
  thng: "Thng",
  frgcpt: "Frgcpt",
};

export function listOperation(kind: BidKind): string {
  return `getBidPblancListInfo${SUFFIX[kind]}`;
}

export function searchOperation(kind: BidKind): string {
  return `getBidPblancListInfo${SUFFIX[kind]}PPSSrch`;
}
