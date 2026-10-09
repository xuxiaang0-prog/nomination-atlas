import { useQuery } from "@tanstack/react-query";
import { ApiError, offline } from "./api";

export type HistoryRecord = {
  id: string;
  invitationStage?: string;
  countMethod?: string;
  englishLevel?: string | null;
  classificationVersion?: string | null;
  state: string;
  programYear: string;
  roundDate: string | null;
  roundMonth: string | null;
  roundLabel: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  visaSubclass: string;
  stream: string;
  residence: string | null;
  occupationCode: string | null;
  occupationTitle: string;
  occupationLevel: "occupation" | "unit_group" | "sub_major_group" | "all";
  points: number | null;
  pointsBasis: string;
  pointsStatus: string;
  invitationCount: number | null;
  countStatus: string;
  countScope: string;
  sourceId: string;
  locator: string;
  note: string;
  recordKind: string;
  eoiDate?: string | null;
  qualityFlags?: string[];
  sourceValue?: string;
  publicationDate?: string | null;
};
export type HistorySource = {
  id: string;
  shortTitle?: string;
  title: string;
  publisher: string;
  url: string;
  retrievedAt: string;
  publishedAt: string | null;
  sha256: string;
  snapshotKind: string;
  note: string | null;
};
export type HistoryCoverage = {
  state: string;
  status: string;
  sourceIds: string[];
  note: string;
  officialContext?: string;
  period?: string;
};
export type HistoryData = {
  datasetVersion: string;
  createdAt: string;
  records: HistoryRecord[];
  sources: HistorySource[];
  coverage: HistoryCoverage[];
  methodology: string[];
  nominations?: StateNominations[];
  recentActivity?: RecentActivity;
  guides?: {
    state: string;
    checkedAt: string;
    steps: string[];
    note?: string;
    sourceIds: string[];
  }[];
  stats: {
    records: number;
    scores: number;
    invitationCounts: number;
    sources: number;
    statesWithHistory: number;
  };
};
export type ActivityMetric =
  | "visa_lodged_primary"
  | "visa_granted_primary"
  | "eoi_invited_snapshot"
  | "eoi_submitted_snapshot";
export type ActivityDataset = {
  id: string;
  title: string;
  metric: ActivityMetric;
  programYear?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  asOf?: string | null;
  sourceId: string;
  note: string;
  verificationStatus?: string;
  defaultForComparison?: boolean;
  occupationTotals?: (ActivityCount & {
    datasetId: string;
    occupationCode: string;
    occupationTitle: string;
  })[];
  stateTotals?: {
    state: string;
    visaSubclass: "190" | "491";
    count: number | null;
    countStatus: string;
    countDisplay?: string;
    sourceId: string;
    locator: string;
  }[];
};
export type ActivityCount = {
  state: string;
  visaSubclass: "190" | "491";
  count: number | null;
  countStatus: string;
  countDisplay?: string;
  sourceId: string;
  locator: string;
};
export type ActivityRecord = {
  id: string;
  datasetId: string;
  state: string;
  visaSubclass: "190" | "491";
  occupationCode: string;
  occupationTitle: string;
  occupationLevel: "occupation" | "unit_group";
  points: number | null;
  count: number | null;
  countStatus: string;
  countDisplay?: string;
  sourceId: string;
  locator: string;
  note?: string;
};
export type RecentActivity = {
  datasets: ActivityDataset[];
  records: ActivityRecord[];
  methodology: string[];
};
export type StateNominations = {
  state: string;
  programYear: string;
  asOf: string;
  nomination190: number | null;
  nomination491: number | null;
  countStatus190: string;
  countStatus491: string;
  sourceId: string;
  verificationStatus: string;
  note?: string;
};
export function useHistory() {
  return useQuery<HistoryData>({
    queryKey: ["official-history", offline()],
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      if (window.ATLAS_SNAPSHOT) {
        if (!window.ATLAS_SNAPSHOT.officialHistory)
          throw new ApiError(
            422,
            "HISTORY_NOT_EXPORTED",
            "这份旧预览没有真实轮次数据，请使用 v0.5 预览。",
          );
        return window.ATLAS_SNAPSHOT.officialHistory;
      }
      const r = await fetch("/api/history?mode=verified_historical", {
        signal,
      });
      const data = await r.json();
      if (!r.ok) throw new ApiError(r.status, data.code, data.title);
      return data;
    },
  });
}
export const stateNames: Record<string, string> = {
  WA: "西澳",
  ACT: "首都领地",
  SA: "南澳",
  TAS: "塔州",
  NSW: "新州",
  VIC: "维州",
  QLD: "昆州",
  NT: "北领地",
};
export const levelNames: Record<string, string> = {
  occupation: "6 位具体职业",
  unit_group: "4 位职业组",
  sub_major_group: "2 位职业子大类",
  all: "全职业 / 通道合计",
};
export const basisNames: Record<string, string> = {
  subclass_score_as_published: "EOI 原表 Subclass Score",
  eoi_total_points_as_published: "EOI 原表 Points Score",
  last_invited_eoi_points: "末位 EOI 分数",
  canberra_matrix: "Canberra Matrix 分数",
  tasmania_priority_score: "塔州优先属性分数",
  not_applicable: "本记录无分数指标",
  not_reported: "官方未公布分数",
};
export const countScopeNames: Record<string, string> = {
  one_published_eoi_row: "一条公开 EOI 签证邀请记录",
  occupation_points_date: "具体职业 · 邀请日与分数档",
  unit_group_points_english_date: "四位职业组 · 邀请日、分数与英语档",
  occupation_in_stream: "该职业 · 指定通道",
  unit_group: "4 位职业组",
  sub_major_group: "2 位职业子大类",
  stream_subclass_month: "整条通道 · 月度邀请份数",
  stream_subclass_round: "整条通道 · 本轮邀请份数",
  pathway_total: "整条通道 · 本轮人数",
  state_round_total: "全州全职业 · 本轮人数",
  state_round_stream: "全职业 · 通道子集",
  state_subclass_total: "全州全职业 · 签证合计",
  sub_major_group_interim: "职业子大类 · 截至该日累计",
  state_interim_total: "全州 · 截至该日累计",
};
export function hasConflict(r: HistoryRecord) {
  return (
    r.countStatus === "source_conflict" ||
    Boolean(r.qualityFlags?.some((f) => /conflict|mismatch/.test(f)))
  );
}
const aliases: Record<string, string[]> = {
  程序分析员: ["261311"],
  程序分析师: ["261311"],
  分析程序员: ["261311"],
  软件工程师: ["261313"],
  开发程序员: ["261312"],
  程序员: ["261311", "261312", "261313"],
  瓷砖工: ["333411"],
  木工: ["331212"],
  水管工: ["334111"],
  土木工程师: ["233211"],
  会计: ["221111"],
  护士: ["2544"],
  教师: ["241"],
};
export function matchesOccupation(
  r: Pick<
    HistoryRecord,
    "occupationCode" | "occupationTitle" | "occupationLevel"
  >,
  input: string,
  related: boolean,
) {
  const query = input.toLowerCase().trim();
  if (!query) return true;
  const codes = aliases[query] ?? (/^\d{2,6}$/.test(query) ? [query] : []);
  if (codes.length)
    return Boolean(
      r.occupationCode &&
      codes.some(
        (code) =>
          r.occupationCode!.startsWith(code) ||
          (related &&
            code.startsWith(r.occupationCode!) &&
            r.occupationLevel !== "occupation"),
      ),
    );
  return `${r.occupationTitle} ${r.occupationCode ?? ""}`
    .toLowerCase()
    .includes(query);
}
