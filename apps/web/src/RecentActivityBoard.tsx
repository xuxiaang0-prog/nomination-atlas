import { Fragment, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  Search,
} from "lucide-react";
import {
  matchesOccupation,
  type ActivityDataset,
  type ActivityCount,
  type ActivityMetric,
  type ActivityRecord,
  type HistoryData,
} from "./history-data";
import { occupationName } from "./occupation-names";
import { OccupationBoard, rankingDatasets } from "./OccupationBoard";

export const activityMetrics: Record<
  ActivityMetric,
  { title: string; count: string; short: string; description: string }
> = {
  visa_lodged_primary: {
    title: "近期职业申请量",
    count: "主申请份数",
    short: "已递交签证申请",
    description:
      "统计期内已递交的签证主申请，按提名州和具体职业划分。这说明哪些职业实际进入了签证申请阶段；不是当期新发邀请数，也不含家属人数。",
  },
  visa_granted_primary: {
    title: "近期职业获签量",
    count: "主申请获签数",
    short: "已获批签证",
    description:
      "统计期内签证主申请获批的数量。获批申请可能来自更早年份，不等于这一年的州邀请数量。",
  },
  eoi_invited_snapshot: {
    title: "月末持有邀请的职业与分数",
    count: "EOI 条数",
    short: "月末持有邀请",
    description:
      "统计日处于 Invited 状态的 EOI。州是申请人填写的提名意向；分数是快照时记录，可能已变化，不一定等于获邀时分数。它不是当月新发邀请数，不能跨月份累加。",
  },
  eoi_submitted_snapshot: {
    title: "月末候邀职业与分数",
    count: "EOI 条数",
    short: "月末候邀池",
    description:
      "统计日处于 Submitted 状态的 EOI，表示仍在候选池中的记录。它不是获邀数量，同一人可以有多个 EOI。",
  },
};
export function recentDatasets(data: HistoryData, state: string) {
  const a = data.recentActivity;
  return (a?.datasets ?? [])
    .filter((d) =>
      a?.records.some((r) => r.state === state && r.datasetId === d.id),
    )
    .sort(
      (x, y) =>
        Number(Boolean(y.defaultForComparison)) -
          Number(Boolean(x.defaultForComparison)) ||
        (y.asOf ?? y.periodEnd ?? "").localeCompare(
          x.asOf ?? x.periodEnd ?? "",
        ),
    );
}
export type ActivityOccupation = {
  code: string;
  name: string;
  title: string;
  rows: ActivityRecord[];
  low: number | null;
  high: number | null;
  count190: number | null;
  count491: number | null;
  points190: number[];
  points491: number[];
  direct190?: ActivityCount;
  direct491?: ActivityCount;
};
export function activityCount(
  rows: ActivityRecord[],
  visa: string,
): number | null {
  const matched = rows.filter((r) => r.visaSubclass === visa);
  if (
    !matched.length ||
    matched.some((r) => r.count === null || r.countStatus !== "published") ||
    new Set(matched.map((r) => r.sourceId)).size > 1 ||
    new Set(matched.map((r) => r.datasetId)).size > 1
  )
    return null;
  return matched.reduce((sum, r) => sum + r.count!, 0);
}
export function activityOccupations(
  records: ActivityRecord[],
  scoreVisa = "190",
  totals: NonNullable<ActivityDataset["occupationTotals"]> = [],
): ActivityOccupation[] {
  const groups = new Map<string, ActivityRecord[]>();
  for (const row of records)
    groups.set(row.occupationCode, [
      ...(groups.get(row.occupationCode) ?? []),
      row,
    ]);
  return [...groups].map(([code, rows]) => {
    const points190 = rows
      .filter(
        (r) => r.visaSubclass === "190" && r.points !== null && r.count !== 0,
      )
      .map((r) => r.points!);
    const points491 = rows
      .filter(
        (r) => r.visaSubclass === "491" && r.points !== null && r.count !== 0,
      )
      .map((r) => r.points!);
    const points = scoreVisa === "491" ? points491 : points190;
    const direct = (visa: "190" | "491") =>
      totals.find(
        (t) =>
          t.occupationCode === code &&
          t.visaSubclass === visa &&
          rows.some(
            (r) =>
              r.visaSubclass === visa &&
              r.state === t.state &&
              r.datasetId === t.datasetId &&
              r.sourceId === t.sourceId,
          ),
      );
    const direct190 = direct("190"),
      direct491 = direct("491");
    return {
      code,
      name: occupationName(code, rows[0].occupationTitle),
      title: rows[0].occupationTitle,
      rows,
      low: points.length ? Math.min(...points) : null,
      high: points.length ? Math.max(...points) : null,
      count190: direct190 ? direct190.count : activityCount(rows, "190"),
      count491: direct491 ? direct491.count : activityCount(rows, "491"),
      points190,
      points491,
      direct190,
      direct491,
    };
  });
}
export function sortActivityOccupations(
  rows: ActivityOccupation[],
  sort: string,
) {
  return [...rows].sort((a, b) => {
    const av = sort.startsWith("points")
      ? a.low
      : sort === "count491"
        ? a.count491
        : a.count190;
    const bv = sort.startsWith("points")
      ? b.low
      : sort === "count491"
        ? b.count491
        : b.count190;
    return (
      Number(av === null) - Number(bv === null) ||
      (av === null || bv === null
        ? 0
        : sort === "pointsAsc"
          ? av - bv
          : bv - av) ||
      a.code.localeCompare(b.code)
    );
  });
}
function countValue(row: ActivityOccupation, visa: string) {
  const direct = visa === "190" ? row.direct190 : row.direct491;
  if (direct)
    return direct.countStatus.startsWith("suppressed")
      ? (direct.countDisplay ?? "小额隐藏")
      : (direct.count?.toLocaleString("en-AU") ?? "未公布");
  const rs = row.rows.filter((r) => r.visaSubclass === visa);
  if (!rs.length) return "不在本表范围";
  if (rs.length === 1 && rs[0].countStatus.startsWith("suppressed"))
    return rs[0].countDisplay ?? "小额隐藏";
  const count = activityCount(row.rows, visa);
  if (count !== null) return count.toLocaleString("en-AU");
  return rs.some((r) => r.countStatus.startsWith("suppressed"))
    ? "含隐藏值"
    : "未公布";
}
const pointsText = (points: number[]) =>
  !points.length
    ? "未公布"
    : Math.min(...points) === Math.max(...points)
      ? String(points[0])
      : Math.min(...points) + "–" + Math.max(...points);
const period = (d: ActivityDataset) =>
  d.asOf
    ? "快照日期 " + d.asOf
    : (d.periodStart ?? "") + " — " + (d.periodEnd ?? "");
export function RecentActivityBoard({
  data,
  state,
}: {
  data: HistoryData;
  state: string;
}) {
  const datasets = useMemo(() => recentDatasets(data, state), [data, state]);
  const [chosen, setChosen] = useState("");
  const dataset = datasets.find((d) => d.id === chosen) ?? datasets[0];
  const [query, setQuery] = useState("");
  const [visa, setVisa] = useState("");
  const [sort, setSort] = useState("pointsDesc");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState("");
  const reset = () => {
    setPage(1);
    setExpanded("");
  };
  const options = (data.recentActivity?.records ?? []).filter(
    (r) => r.datasetId === dataset?.id && r.state === state,
  );
  const filtered = options.filter(
    (r) =>
      (!visa || r.visaSubclass === visa) &&
      (matchesOccupation(r, query, false) ||
        occupationName(r.occupationCode, r.occupationTitle)
          .toLowerCase()
          .includes(query.trim().toLowerCase())),
  );
  const hasPoints = options.some((r) => r.points !== null);
  const sorting =
    !hasPoints && sort.startsWith("points")
      ? visa === "491"
        ? "count491"
        : "count190"
      : sort;
  const rows = sortActivityOccupations(
    activityOccupations(
      filtered,
      visa === "491" ? "491" : "190",
      dataset?.occupationTotals,
    ),
    sorting,
  );
  const pageSize = 25,
    pages = Math.max(1, Math.ceil(rows.length / pageSize)),
    active = Math.min(page, pages);
  const shown = rows.slice((active - 1) * pageSize, active * pageSize);
  if (!dataset)
    return (
      <div className="no-cutoff">
        <h3>近期职业数据尚未取得</h3>
        <p>
          可查看州已公布的邀请记录与历史档案。此处不会用2019年替代近期数据。
        </p>
      </div>
    );
  const metric = activityMetrics[dataset.metric];
  const source = data.sources.find((s) => s.id === dataset.sourceId);
  return (
    <section
      className="occupation-board recent-activity"
      aria-label={state + " 近期职业数据"}
    >
      <div className="board-heading">
        <div>
          <p className="eyebrow">RECENT OCCUPATION DATA · {state}</p>
          <h2>{metric.title}</h2>
          <p>完整浏览这份近期资料中的具体职业，寻找之前没关注的方向。</p>
        </div>
        <div className="board-actions">
          <button
            disabled={!hasPoints}
            onClick={() => {
              setSort("pointsDesc");
              reset();
            }}
          >
            <ArrowDown size={14} /> 分数从高到低
          </button>
          <button
            disabled={!hasPoints}
            onClick={() => {
              setSort("pointsAsc");
              reset();
            }}
          >
            <ArrowUp size={14} /> 分数从低到高
          </button>
        </div>
      </div>
      <div className="board-dataset">
        <label>
          近期资料与统计口径
          <select
            aria-label="近期职业资料集"
            value={dataset.id}
            onChange={(e) => {
              setChosen(e.target.value);
              setVisa("");
              reset();
            }}
          >
            {datasets.map((d) => (
              <option value={d.id} key={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        <span className="badge verified">{metric.short}</span>
      </div>
      <div className="board-period">
        <strong>{period(dataset)}</strong>
        <span>
          {dataset.programYear ? dataset.programYear + " 年度 · " : ""}
          {dataset.verificationStatus === "third_party_derived"
            ? "第三方整理；原始官方数据未取得"
            : "官方原表可核对"}
        </span>
        {source && (
          <a
            className="result-source"
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            {dataset.verificationStatus === "third_party_derived"
              ? "资料来源"
              : "官方原表"}
            <ArrowUpRight size={14} />
          </a>
        )}
      </div>
      <p className="activity-definition">{metric.description}</p>
      {!hasPoints && (
        <div className="activity-score-gap">
          <b>这份资料没有职业分数</b>
          <span>
            下面按实际{metric.count}
            排序。近期州邀请分数可切换到“州邀请披露”；未公布的分数保留空值。
          </span>
        </div>
      )}
      <div className="board-filters">
        <label className="board-search">
          职业名称 / ANZSCO
          <span>
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                reset();
              }}
              placeholder="搜索全部职业，例如 教师、药剂师、工程师、翻译"
            />
          </span>
        </label>
        <label>
          签证范围
          <select
            value={visa}
            onChange={(e) => {
              setVisa(e.target.value);
              if (!sort.startsWith("points"))
                setSort(e.target.value === "491" ? "count491" : "count190");
              reset();
            }}
          >
            <option value="">190 与 491</option>
            <option value="190">190</option>
            <option value="491">491</option>
          </select>
        </label>
        <label>
          排列方式
          <select
            aria-label="近期职业排列方式"
            value={sorting}
            onChange={(e) => {
              setSort(e.target.value);
              reset();
            }}
          >
            <option value="count190">190 {metric.count}：多 → 少</option>
            <option value="count491">491 {metric.count}：多 → 少</option>
            <option disabled={!hasPoints} value="pointsDesc">
              {visa === "491" ? "491" : "190"} 最低快照分数：高 → 低
            </option>
            <option disabled={!hasPoints} value="pointsAsc">
              {visa === "491" ? "491" : "190"} 最低快照分数：低 → 高
            </option>
          </select>
        </label>
      </div>
      <div className="board-count">
        <strong>{rows.length} 个具体职业</strong>
        <span>
          6 位 ANZSCO · 同一份资料与统计期
          {hasPoints
            ? ` · 按${visa === "491" ? "491" : "190"}最低快照分数排序`
            : ""}
        </span>
      </div>
      <div className="table-scroll">
        <table className="result-table occupation-ranking">
          <thead>
            <tr>
              <th>具体职业</th>
              <th>{hasPoints ? "分数范围" : "职业分数"}</th>
              <th>190 {metric.count}</th>
              <th>491 {metric.count}</th>
              <th>核对明细</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <Fragment key={row.code}>
                <tr>
                  <td>
                    <strong>{row.name}</strong>
                    <small>{row.title}</small>
                    <span className="occupation-code">
                      {row.code} · 6 位具体职业
                    </span>
                  </td>
                  <td
                    className={
                      row.low === null ? "unreported" : "result-number"
                    }
                  >
                    {hasPoints ? (
                      <>
                        <span>190 · {pointsText(row.points190)}</span>
                        <small>491 · {pointsText(row.points491)}</small>
                      </>
                    ) : (
                      "未公布"
                    )}
                    <small>
                      {hasPoints
                        ? "EOI 原表分数；非州邀请门槛"
                        : "原表没有分数字段"}
                    </small>
                  </td>
                  <td
                    className={
                      row.count190 === null ? "unreported" : "result-number"
                    }
                  >
                    {countValue(row, "190")}
                  </td>
                  <td
                    className={
                      row.count491 === null ? "unreported" : "result-number"
                    }
                  >
                    {countValue(row, "491")}
                  </td>
                  <td>
                    <button
                      className="row-expand"
                      aria-expanded={expanded === row.code}
                      aria-label={"查看 " + row.code + " 近期统计明细"}
                      onClick={() =>
                        setExpanded(expanded === row.code ? "" : row.code)
                      }
                    >
                      明细
                      <ChevronDown size={14} />
                    </button>
                  </td>
                </tr>
                {expanded === row.code && (
                  <tr className="expanded-occupation">
                    <td colSpan={5}>
                      <div className="occupation-detail">
                        <h3>
                          {row.name} · {row.code}
                        </h3>
                        <p>{metric.description}</p>
                        {(row.direct190 || row.direct491) && (
                          <p className="result-footnote">
                            职业总数与各分档分别取自官方公开表；总数不是把隐藏分档相加或推算出来的。
                          </p>
                        )}
                        <table className="detail-table">
                          <thead>
                            <tr>
                              <th>签证</th>
                              <th>分数</th>
                              <th>{metric.count}</th>
                              <th>原表定位</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[row.direct190, row.direct491]
                              .filter((t): t is ActivityCount => Boolean(t))
                              .map((t) => (
                                <tr key={"total-" + t.visaSubclass}>
                                  <td>{t.visaSubclass}</td>
                                  <td>官方职业总数 · 全分档</td>
                                  <td>{countValue(row, t.visaSubclass)}</td>
                                  <td>{t.locator}</td>
                                </tr>
                              ))}
                            {[...row.rows]
                              .sort(
                                (a, b) =>
                                  a.visaSubclass.localeCompare(
                                    b.visaSubclass,
                                  ) || (b.points ?? -1) - (a.points ?? -1),
                              )
                              .map((r) => (
                                <tr key={r.id}>
                                  <td>{r.visaSubclass}</td>
                                  <td>{r.points ?? "未公布"}</td>
                                  <td>
                                    {r.countStatus.startsWith("suppressed")
                                      ? (r.countDisplay ?? "小额隐藏")
                                      : (r.count?.toLocaleString("en-AU") ??
                                        "未公布")}
                                  </td>
                                  <td>
                                    {r.locator}
                                    {r.note && <small>{r.note}</small>}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {source && (
                          <p className="result-footnote">
                            {source.publisher} · {source.title} · 检索于{" "}
                            {source.retrievedAt.slice(0, 10)}
                            <br />
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              打开原始资料 ↗
                            </a>
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && (
        <p className="empty">当前筛选没有记录。可清空搜索或切换签证范围。</p>
      )}
      <div className="history-pagination">
        <p>
          第 {active} / {pages} 页 · 每页 {pageSize} 个职业
        </p>
        <div>
          <button
            disabled={active === 1}
            onClick={() => {
              setPage(active - 1);
              setExpanded("");
            }}
          >
            上一页
          </button>
          <button
            disabled={active === pages}
            onClick={() => {
              setPage(active + 1);
              setExpanded("");
            }}
          >
            下一页
          </button>
        </div>
      </div>
      <p className="result-footnote">
        {dataset.note}{" "}
        小额隐藏值按原表保留，不推算为0；表内没有该职业不等于该职业不符合资格。申请数量可帮助发现实际需求方向，不能单独证明当前容易获邀。
      </p>
    </section>
  );
}

export function StateOccupationExplorer({
  data,
  state,
}: {
  data: HistoryData;
  state: string;
}) {
  const hasRecent = recentDatasets(data, state).length > 0;
  const hasRounds = rankingDatasets(data, state).some((d) => !d.isFoi);
  const [tab, setTab] = useState(
    hasRecent ? "recent" : hasRounds ? "rounds" : "recent",
  );
  return (
    <>
      <div
        className="occupation-view-tabs"
        role="tablist"
        aria-label="职业数据类型"
      >
        <button
          role="tab"
          aria-selected={tab === "recent"}
          onClick={() => setTab("recent")}
        >
          近期职业数据
        </button>
        <button
          role="tab"
          aria-selected={tab === "rounds"}
          onClick={() => setTab("rounds")}
        >
          州邀请披露
        </button>
        <button
          role="tab"
          aria-selected={tab === "archive"}
          onClick={() => setTab("archive")}
        >
          历史档案
        </button>
      </div>
      {tab === "recent" ? (
        <RecentActivityBoard key={state} data={data} state={state} />
      ) : (
        <OccupationBoard
          key={state + tab}
          data={data}
          state={state}
          sourceScope={tab === "rounds" ? "state_rounds" : "archive"}
        />
      )}
    </>
  );
}
