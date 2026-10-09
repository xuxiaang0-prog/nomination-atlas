import { Fragment, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  Search,
} from "lucide-react";
import { RecordDialog } from "./HistoryEvidence";
import {
  basisNames,
  hasConflict,
  levelNames,
  matchesOccupation,
  type HistoryData,
  type HistoryRecord,
} from "./history-data";
import { occupationName } from "./occupation-names";
import groupReference from "./group-reference.json";

export type Dataset = {
  id: string;
  label: string;
  rows: HistoryRecord[];
  isFoi: boolean;
  isLatest: boolean;
  level: string;
};
const recordDate = (r: HistoryRecord) =>
  r.roundDate ?? r.roundMonth ?? r.periodEnd ?? "";
const isFoi = (r: HistoryRecord) =>
  r.invitationStage === "visa_application_after_nomination" ||
  r.countMethod === "derived_from_official_rows";
export function rankingDatasets(data: HistoryData, state: string): Dataset[] {
  const rows = data.records.filter(
    (r) => r.state === state && r.occupationCode && r.occupationLevel !== "all",
  );
  const result: Dataset[] = [];
  const current = rows.filter((r) => !isFoi(r));
  for (const level of [...new Set(current.map((r) => r.occupationLevel))]) {
    const levelRows = current.filter((r) => r.occupationLevel === level);
    const dates = new Map<string, string>();
    for (const r of levelRows)
      dates.set(
        r.occupationCode!,
        [dates.get(r.occupationCode!) ?? "", recordDate(r)].sort().at(-1)!,
      );
    result.push({
      id: "latest-" + level,
      label:
        "州邀请 · 全部" +
        (level === "occupation" ? "职业" : "职业组") +
        "的最新已录入记录",
      rows: levelRows.filter(
        (r) => recordDate(r) === dates.get(r.occupationCode!),
      ),
      isFoi: false,
      isLatest: true,
      level,
    });
  }
  const sourceKeys = [
    ...new Set(rows.map((r) => r.sourceId + "|" + r.occupationLevel)),
  ];
  for (const key of sourceKeys) {
    const [id, level] = key.split("|"),
      rs = rows.filter((r) => r.sourceId === id && r.occupationLevel === level),
      source = data.sources.find((s) => s.id === id);
    const foi = rs.some(isFoi);
    const dates = rs.map(recordDate).filter(Boolean).sort();
    result.push({
      id: key,
      label:
        (foi ? "签证邀请 FOI · " : "州邀请原表 · ") +
        dates[0] +
        (dates.at(-1) !== dates[0] ? " 至 " + dates.at(-1) : "") +
        " · " +
        levelNames[level] +
        " · " +
        (source?.shortTitle ?? id),
      rows: rs,
      isFoi: foi,
      isLatest: false,
      level,
    });
  }
  return result.sort(
    (a, b) =>
      Number(b.isLatest) - Number(a.isLatest) ||
      Number(b.rows.some((r) => r.visaSubclass === "190")) -
        Number(a.rows.some((r) => r.visaSubclass === "190")) ||
      recordDate(
        b.rows
          .slice()
          .sort((x, y) => recordDate(y).localeCompare(recordDate(x)))[0],
      ).localeCompare(
        recordDate(
          a.rows
            .slice()
            .sort((x, y) => recordDate(y).localeCompare(recordDate(x)))[0],
        ),
      ),
  );
}
export type OccupationRow = {
  code: string;
  name: string;
  rows: HistoryRecord[];
  low: number | null;
  high: number | null;
  start: string;
  end: string;
  count190: number | null;
  count491: number | null;
};
export function exactCount(rows: HistoryRecord[], visa: string): number | null {
  const rs = rows.filter((r) => r.visaSubclass === visa);
  if (
    !rs.length ||
    rs.some((r) => r.invitationCount === null || hasConflict(r))
  )
    return null;
  // Counts are summed only within one selected official release/round. Monthly,
  // annual, pathway and occupation totals never enter this occupation-only board.
  if (new Set(rs.map((r) => r.sourceId)).size > 1) return null;
  return rs.reduce((n, r) => n + r.invitationCount!, 0);
}
export function occupationRows(records: HistoryRecord[]): OccupationRow[] {
  const groups = new Map<string, HistoryRecord[]>();
  for (const r of records) {
    if (!r.occupationCode || r.occupationLevel === "all") continue;
    groups.set(r.occupationCode, [...(groups.get(r.occupationCode) ?? []), r]);
  }
  return [...groups].map(([code, rows]) => {
    const pts = rows
      .filter((r) => r.points !== null && !hasConflict(r))
      .map((r) => r.points!);
    const dates = rows.map(recordDate).filter(Boolean).sort();
    return {
      code,
      name: occupationName(code, rows[0].occupationTitle),
      rows,
      low: pts.length ? Math.min(...pts) : null,
      high: pts.length ? Math.max(...pts) : null,
      start: dates[0] ?? "",
      end: dates.at(-1) ?? "",
      count190: exactCount(rows, "190"),
      count491: exactCount(rows, "491"),
    };
  });
}
export function sortOccupationRows(rows: OccupationRow[], sort: string) {
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
      (av === null ? 1 : 0) - (bv === null ? 1 : 0) ||
      (av === null || bv === null
        ? 0
        : sort === "pointsAsc"
          ? av - bv
          : bv - av) ||
      a.code.localeCompare(b.code)
    );
  });
}
function countText(row: OccupationRow, visa: "190" | "491") {
  const rs = row.rows.filter((r) => r.visaSubclass === visa);
  if (!rs.length)
    return row.rows.some((r) => r.visaSubclass === "combined")
      ? "未按签证披露"
      : "不在本表范围";
  if (rs.some(hasConflict)) return "来源待核对";
  if (rs.some((r) => r.countStatus.includes("suppressed")))
    return rs.length === 1 ? "<5" : "含隐藏值";
  const n = visa === "190" ? row.count190 : row.count491;
  return n === null ? "未公布" : n.toLocaleString("en-AU");
}
function RowDetail({
  row,
  data,
  foi,
}: {
  row: OccupationRow;
  data: HistoryData;
  foi: boolean;
}) {
  const [record, setRecord] = useState<HistoryRecord>();
  const [limit, setLimit] = useState(20);
  const group =
    row.code.length === 2
      ? groupReference.groups.find((g) => g.code === row.code)
      : undefined;
  const bands = [
    ...new Set(
      row.rows.map((r) => r.points).filter((n): n is number => n !== null),
    ),
  ]
    .sort((a, b) => b - a)
    .map((points) => ({
      points,
      count: row.rows
        .filter((r) => r.points === points)
        .reduce((n, r) => n + (r.invitationCount ?? 0), 0),
    }));
  const sorted = [...row.rows].sort(
    (a, b) =>
      (b.points ?? -1) - (a.points ?? -1) ||
      recordDate(b).localeCompare(recordDate(a)),
  );
  return (
    <div className="occupation-detail">
      <h3>
        {row.name} · {row.code}
      </h3>
      <p>
        {foi
          ? "下表按官方逐 EOI 档案计数；每个分档与日期分别保留。它是获州提名后的签证申请邀请，不是获签。"
          : "下表逐条保留官方公布的通道、居住范围和轮次；多条末位分数不能合并为一条统一分数线。"}
      </p>
      {foi && (
        <section className="score-bands" aria-label="该职业分数与邀请数量分档">
          <h4>每个分数，实际邀请了多少 EOI？</h4>
          <div>
            {bands.map((b) => (
              <span key={b.points}>
                <b>{b.points} 分</b>
                <strong>{b.count.toLocaleString("en-AU")}</strong>
                <small>条邀请</small>
              </span>
            ))}
          </div>
          <p>
            按所选资料与筛选范围计算；最低分对应的数量可单独看，不表示全部人都以最低分获邀。
          </p>
        </section>
      )}
      <div className="table-scroll">
        <table className="detail-table">
          <thead>
            <tr>
              <th>记录日期</th>
              <th>签证 / 范围</th>
              <th>分数</th>
              <th>这一行邀请数</th>
              <th>依据</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((r) => (
              <tr key={r.id}>
                <td>{recordDate(r)}</td>
                <td>
                  {r.visaSubclass === "combined"
                    ? "190 / 491 未拆分"
                    : r.visaSubclass}
                  <small>
                    {r.stream} · {r.residence ?? "原表未分居住地"}
                    {r.englishLevel ? " · " + r.englishLevel : ""}
                  </small>
                </td>
                <td>
                  {r.points ?? "未公布"}
                  <small>{basisNames[r.pointsBasis] ?? r.pointsBasis}</small>
                </td>
                <td>
                  {hasConflict(r)
                    ? "来源待核对"
                    : r.countStatus.includes("suppressed")
                      ? "<5"
                      : (r.invitationCount ?? "未公布")}
                  <small>
                    {foi ? "该职业/组 · 本日期与分档" : "原表所示职业或组"}
                  </small>
                </td>
                <td>
                  <button
                    className="result-source"
                    onClick={() => setRecord(r)}
                    aria-label={"核对 " + r.id}
                  >
                    <BookOpen size={13} />
                    原表
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <button className="secondary" onClick={() => setLimit(limit + 50)}>
          再显示 {Math.min(50, sorted.length - limit)} 条分档记录
        </button>
      )}
      {group && (
        <details className="classification-reference">
          <summary>这个职业组包括哪些职业？（分类目录）</summary>
          <p>
            {groupReference.version} · {groupReference.noticeZh}{" "}
            历史移民表的代码版本可能不同，以下代码不替换历史原值。
          </p>
          <ul>
            {group.occupations.map((o) => (
              <li key={o.code}>
                <b>{occupationName(o.code, o.name)}</b>
                <span>
                  {o.name} · {o.code}
                </span>
              </li>
            ))}
          </ul>
          <a href={groupReference.sourceUrl} target="_blank" rel="noreferrer">
            ABS 分类原文 ↗
          </a>
        </details>
      )}
      {record && (
        <RecordDialog
          record={record}
          source={data.sources.find((s) => s.id === record.sourceId)}
          onClose={() => setRecord(undefined)}
        />
      )}
    </div>
  );
}
export function OccupationBoard({
  data,
  state,
  sourceScope = "all",
}: {
  data: HistoryData;
  state: string;
  sourceScope?: "all" | "state_rounds" | "archive";
}) {
  const datasets = useMemo(
    () =>
      rankingDatasets(data, state).filter(
        (d) =>
          sourceScope === "all" ||
          (sourceScope === "archive" ? d.isFoi : !d.isFoi),
      ),
    [data, state, sourceScope],
  );
  const [chosen, setChosen] = useState("");
  const dataset = datasets.find((d) => d.id === chosen) ?? datasets[0];
  const [query, setQuery] = useState("");
  const [visa, setVisa] = useState("");
  const [round, setRound] = useState("");
  const [stream, setStream] = useState("");
  const [residence, setResidence] = useState("");
  const [sort, setSort] = useState("pointsDesc");
  const [expanded, setExpanded] = useState("");
  const [page, setPage] = useState(1);
  const change = () => {
    setPage(1);
    setExpanded("");
  };
  const options = dataset?.rows ?? [];
  const filtered = options.filter(
    (r) =>
      (!visa || r.visaSubclass === visa) &&
      (!round || recordDate(r).startsWith(round)) &&
      (!stream || r.stream === stream) &&
      (!residence || r.residence === residence) &&
      (matchesOccupation(r, query, false) ||
        occupationName(r.occupationCode!, r.occupationTitle)
          .toLowerCase()
          .includes(query.toLowerCase().trim())),
  );
  const hasPoints = options.some((r) => r.points !== null);
  const sortValue = !hasPoints && sort.startsWith("points") ? "count190" : sort;
  const rows = sortOccupationRows(occupationRows(filtered), sortValue),
    pageSize = 25,
    pages = Math.max(1, Math.ceil(rows.length / pageSize)),
    active = Math.min(page, pages),
    shown = rows.slice((active - 1) * pageSize, active * pageSize);
  const dates = options.map(recordDate).filter(Boolean).sort();
  const scope = dataset?.isFoi
    ? "获州提名后 · 签证申请邀请（EOI记录）"
    : "州提名申请邀请";
  return (
    <section className="occupation-board" aria-label={state + " 全职业榜"}>
      <div className="board-heading">
        <div>
          <p className="eyebrow">ALL OCCUPATIONS · {state}</p>
          <h2>
            {dataset?.level === "occupation" ? "完整职业榜" : "完整职业组榜"}
          </h2>
          <p>不预选行业。按实际披露分数或邀请数量，探索所有已录入职业。</p>
        </div>
        <div className="board-actions">
          <button
            onClick={() => {
              setSort("pointsDesc");
              change();
            }}
            disabled={!hasPoints}
          >
            <ArrowDown size={14} /> 分数从高到低
          </button>
          <button
            onClick={() => {
              setSort("pointsAsc");
              change();
            }}
            disabled={!hasPoints}
          >
            <ArrowUp size={14} /> 从低分端探索
          </button>
        </div>
      </div>
      {!dataset ? (
        <div className="no-cutoff">
          <h3>
            {sourceScope === "state_rounds"
              ? "近期州邀请职业明细尚未取得"
              : "该范围尚未取得职业明细"}
          </h3>
          <p>
            可切换“近期职业数据”查看月末持邀 EOI
            与签证主申请量。这里不会用2019年的分数替代近期州邀请线。
          </p>
        </div>
      ) : (
        <>
          <div className="board-dataset">
            <label>
              选择资料与时间范围
              <select
                aria-label="职业榜资料集"
                value={dataset.id}
                onChange={(e) => {
                  setChosen(e.target.value);
                  setVisa("");
                  setRound("");
                  setStream("");
                  setResidence("");
                  change();
                }}
              >
                {datasets.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <span
              className={dataset.isFoi ? "badge historical" : "badge verified"}
            >
              {scope}
            </span>
          </div>
          <div
            className={
              dataset.isFoi ? "board-period historical-period" : "board-period"
            }
          >
            <strong>
              {dates[0]}
              {dates.at(-1) !== dates[0] ? " — " + dates.at(-1) : ""}
            </strong>
            <span>
              {dataset.isFoi
                ? "旧年 FOI 历史档案；不代表当前获邀分数或当前可选职业。"
                : dataset.isLatest
                  ? "每个职业分别取最新已录入记录，日期可能不同；可选单份原表再比较。"
                  : "同一官方发布资料；进一步选择签证、通道和居住范围后比较。"}
            </span>
          </div>
          <div className="board-filters">
            <label className="board-search">
              职业名称 / ANZSCO
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    change();
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
                  change();
                }}
              >
                <option value="">原表全部签证</option>
                {[...new Set(options.map((r) => r.visaSubclass))]
                  .sort()
                  .map((v) => (
                    <option key={v} value={v}>
                      {v === "combined" ? "190 / 491 未拆分" : v}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              邀请月份
              <select
                value={round}
                onChange={(e) => {
                  setRound(e.target.value);
                  change();
                }}
              >
                <option value="">资料内全部月份</option>
                {[
                  ...new Set(
                    options
                      .map((r) => recordDate(r).slice(0, 7))
                      .filter(Boolean),
                  ),
                ]
                  .sort()
                  .reverse()
                  .map((m) => (
                    <option key={m}>{m}</option>
                  ))}
              </select>
            </label>
            <label>
              排列方式
              <select
                value={sortValue}
                onChange={(e) => {
                  setSort(e.target.value);
                  change();
                }}
              >
                <option value="pointsDesc" disabled={!hasPoints}>
                  最低已披露分数：高 → 低
                </option>
                <option value="pointsAsc" disabled={!hasPoints}>
                  最低已披露分数：低 → 高
                </option>
                <option value="count190">190 邀请数：多 → 少</option>
                <option value="count491">491 邀请数：多 → 少</option>
              </select>
            </label>
          </div>
          <details className="board-scope">
            <summary>进一步限定通道和居住范围</summary>
            <div>
              <label>
                通道
                <select
                  value={stream}
                  onChange={(e) => {
                    setStream(e.target.value);
                    change();
                  }}
                >
                  <option value="">原表全部通道</option>
                  {[...new Set(options.map((r) => r.stream))].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                居住范围
                <select
                  value={residence}
                  onChange={(e) => {
                    setResidence(e.target.value);
                    change();
                  }}
                >
                  <option value="">原表全部居住范围</option>
                  {[
                    ...new Set(
                      options
                        .map((r) => r.residence)
                        .filter((r): r is string => Boolean(r)),
                    ),
                  ]
                    .sort()
                    .map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                </select>
              </label>
            </div>
          </details>
          <div className="board-count">
            <strong>
              {rows.length} 个
              {dataset.level === "occupation" ? "具体职业" : "职业组"}
            </strong>
            <span>
              {levelNames[dataset.level]} ·{" "}
              {hasPoints
                ? "按该行最低已披露分数排序；范围内各分数、人数可展开。"
                : "本资料未披露职业分数，先展示可核对的邀请数量。"}
            </span>
          </div>
          {dataset.level !== "occupation" && (
            <p className="board-group-note">
              本表只公布{levelNames[dataset.level]}
              ，不能把整组人数拆到组内某一具体职业。可在详情中查看已公布的分档。
            </p>
          )}
          {shown.length ? (
            <div className="table-scroll">
              <table className="result-table occupation-ranking">
                <thead>
                  <tr>
                    <th>职业 / 职业组</th>
                    <th>已披露分数</th>
                    <th>190 邀请数</th>
                    <th>491 邀请数</th>
                    <th>记录日期</th>
                    <th>展开明细</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <Fragment key={row.code}>
                      <tr>
                        <td>
                          <strong>{row.name}</strong>
                          <small>{row.rows[0].occupationTitle}</small>
                          <span className="occupation-code">
                            {row.code} · {levelNames[dataset.level]}
                          </span>
                        </td>
                        <td className="result-number">
                          {row.low === null
                            ? row.rows.every(
                                (r) => r.pointsStatus === "not_considered",
                              )
                              ? "本轮未考虑"
                              : row.rows.some(
                                    (r) => r.pointsStatus === "parse_failed",
                                  )
                                ? "待核对"
                                : "未公布"
                            : row.low === row.high
                              ? row.low
                              : row.low + "–" + row.high}
                          <small>
                            {dataset.isFoi
                              ? "EOI 获邀分档"
                              : row.rows[0].pointsBasis === "canberra_matrix"
                                ? "Canberra Matrix"
                                : "末位 EOI"}
                          </small>
                        </td>
                        <td
                          className={
                            row.count190 === null
                              ? "unreported"
                              : "result-number"
                          }
                        >
                          {countText(row, "190")}
                        </td>
                        <td
                          className={
                            row.count491 === null
                              ? "unreported"
                              : "result-number"
                          }
                        >
                          {countText(row, "491")}
                        </td>
                        <td>
                          {row.start}
                          <small>
                            {row.end !== row.start ? "至 " + row.end : ""}
                            {dataset.isLatest ? " · 各职业日期不同" : ""}
                          </small>
                        </td>
                        <td>
                          <button
                            className="row-expand"
                            onClick={() =>
                              setExpanded(expanded === row.code ? "" : row.code)
                            }
                            aria-expanded={expanded === row.code}
                            aria-label={"查看 " + row.code + " 分数和人数明细"}
                          >
                            明细
                            <ChevronDown size={14} />
                          </button>
                        </td>
                      </tr>
                      {expanded === row.code && (
                        <tr className="expanded-occupation">
                          <td colSpan={6}>
                            <RowDetail
                              key={dataset.id + row.code}
                              row={row}
                              data={data}
                              foi={dataset.isFoi}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              这个筛选范围没有记录；可清空职业搜索或切换资料集。
            </div>
          )}
          <div className="history-pagination">
            <p>
              第 {active} / {pages} 页 · 每页 {pageSize} 个职业或组
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
            分数范围表示所选资料实际出现的分值；低分和多人获邀都不能单独证明今天容易申请。职业评估、学历/注册、工作经验及当期州条件需另行核对。
            {dataset.isFoi
              ? "邀请数由单份官方逐 EOI 资料分组计数；不将重叠 FOI 相加。"
              : "未公布人数保留缺失；未将州或通道总数分配给具体职业。"}
          </p>
        </>
      )}
    </section>
  );
}
