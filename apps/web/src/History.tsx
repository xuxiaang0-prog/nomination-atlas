import { NoHistoryResult } from "./DecisionViews";
import { RecordDialog } from "./HistoryEvidence";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import {
  basisNames,
  countScopeNames,
  hasConflict,
  levelNames,
  matchesOccupation,
  stateNames,
  useHistory,
  type HistoryRecord,
} from "./history-data";

const number = (n: number) => n.toLocaleString("en-AU");
const streamName = (s: string) =>
  ({
    all_streams: "全部通道",
    all: "全部通道",
    total: "本轮合计",
    all_priority_passes: "全部优先类别 · 本轮合计",
  })[s] ?? s;
const residenceName = (s: string | null) =>
  ({
    not_reported: "居住类别未公布",
    WA: "西澳居民",
    "Canberra resident": "堪培拉居民",
    "Overseas applicant": "境外申请人",
  })[s ?? ""] ??
  s ??
  "居住类别未公布";
const countMissing = (r: HistoryRecord) =>
  r.countStatus === "source_conflict"
    ? "官方表格冲突"
    : r.countStatus === "not_reported" || r.countStatus === "not_published"
      ? "未公布"
      : "无已公布数值";
const scoreMissing = (r: HistoryRecord) =>
  r.pointsStatus === "not_considered"
    ? "N/A · 本轮未考虑"
    : r.pointsStatus === "parse_failed"
      ? "原表提取待核对"
      : "未公布";

export function AnalystDefinition() {
  return (
    <div className="occupation-definition">
      <span className="badge neutral">职业解释 · ANZSCO 261311</span>
      <h3>程序分析员是什么？</h3>
      <p>
        <strong>Analyst Programmer</strong>
        ：分析用户需求，编写需求与系统设计，再进行程序开发、测试、调试和维护。中文也常译作“分析程序员”。
      </p>
      <p>
        Graduate stream
        是毕业生通道，不能据此判断申请人当时“在校”。历史末位获邀分数也不表示签证获批。
      </p>
      <a
        className="note"
        href="https://www.abs.gov.au/statistics/classifications/anzsco-australian-and-new-zealand-standard-classification-occupations/2021/browse-classification/2/26/261/2613"
        target="_blank"
        rel="noreferrer"
      >
        ABS 职业定义（2021） ↗
      </a>
    </div>
  );
}

export function HistoryHighlights() {
  const q = useHistory();
  return (
    <section className="history-hero">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="live-dot" /> OFFICIAL EVIDENCE · 真实邀请记录
        </p>
        <h2>
          多少分，
          <br />
          邀请了多少人。
        </h2>
        <p>
          把职业、轮次、通道和来源放在一起。
          <br />
          有据可查的显示原数，未公布的保留缺口。
        </p>
        <div className="hero-actions">
          <Link className="primary" to="/history">
            查看真实历史 <ArrowUpRight size={17} />
          </Link>
          <Link to="/history?state=WA&q=261311&year=2024-25">
            先看程序分析员 →
          </Link>
        </div>
      </div>
      <div className="hero-evidence">
        <div className="eyebrow">本版证据覆盖</div>
        {q.data ? (
          <>
            <div className="hero-count">
              <strong>{q.data.stats.statesWithHistory}</strong>
              <span>
                / 8 州及领地
                <br />
                已有部分邀请历史
              </span>
            </div>
            <div className="evidence-metrics">
              <div>
                <b>{number(q.data.stats.records)}</b>
                <span>来源记录，含缺失状态</span>
              </div>
              <div>
                <b>{q.data.stats.sources}</b>
                <span>官方来源快照</span>
              </div>
            </div>
          </>
        ) : (
          <p>{q.error ? "历史数据暂时无法读取" : "正在读取证据…"}</p>
        )}
        <p className="hero-footnote">分数体系分开列示 · 人数注明统计层级</p>
      </div>
    </section>
  );
}

export function HistoryPage({
  demo,
  onReal,
}: {
  demo: boolean;
  onReal: () => void;
}) {
  const [params] = useSearchParams();
  return (
    <>
      <div className="page-title">
        <p className="eyebrow">INVITATION ARCHIVE</p>
        <h1>真实轮次，逐条可查。</h1>
        <p>
          分数与人数并排显示。每条记录保留官方发布的层级，不把通道合计分配给具体职业。
        </p>
      </div>
      {demo ? (
        <div className="empty">
          <h2>真实邀请历史位于真实数据模式</h2>
          <button className="primary" onClick={onReal}>
            切换到真实历史
          </button>
        </div>
      ) : (
        <HistoryExplorer
          key={params.toString()}
          initialState={params.get("state") ?? ""}
          initialQuery={params.get("q") ?? ""}
          initialYear={params.get("year") ?? ""}
        />
      )}
    </>
  );
}

export function HistoryExplorer({
  fixedState,
  occupationCode,
  initialState = "",
  initialQuery = "",
  initialYear = "",
  initialVisa = "",
}: {
  fixedState?: string;
  occupationCode?: string;
  initialState?: string;
  initialQuery?: string;
  initialYear?: string;
  initialVisa?: string;
}) {
  const q = useHistory();
  const [state, setState] = useState(fixedState ?? initialState);
  const [year, setYear] = useState(initialYear);
  const [visa, setVisa] = useState(initialVisa);
  const [round, setRound] = useState("");
  const [stream, setStream] = useState("");
  const [query, setQuery] = useState(occupationCode ?? initialQuery);
  const [kind, setKind] = useState("");
  const [related, setRelated] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HistoryRecord>();
  useEffect(() => {
    if (fixedState !== undefined) setState(fixedState);
  }, [fixedState]);
  useEffect(() => {
    if (occupationCode !== undefined) setQuery(occupationCode);
  }, [occupationCode]);
  useEffect(
    () => setPage(1),
    [state, year, visa, round, stream, query, kind, related],
  );
  const base = useMemo(
    () =>
      (q.data?.records ?? []).filter(
        (r) =>
          (!state || r.state === state) &&
          (!year || r.programYear === year) &&
          (!visa || r.visaSubclass === visa),
      ),
    [q.data, state, year, visa],
  );
  const rounds = [
    ...new Set(
      base.map((r) => r.roundDate ?? r.roundMonth ?? r.periodEnd ?? ""),
    ),
  ]
    .filter(Boolean)
    .sort()
    .reverse();
  const streams = [...new Set(base.map((r) => r.stream))].sort();
  const records = useMemo(
    () =>
      base
        .filter(
          (r) =>
            (!round ||
              (r.roundDate ?? r.roundMonth ?? r.periodEnd) === round) &&
            (!stream || r.stream === stream) &&
            matchesOccupation(r, query, related) &&
            (kind === "scores"
              ? r.points !== null
              : kind === "counts"
                ? r.invitationCount !== null && !hasConflict(r)
                : kind === "issues"
                  ? hasConflict(r) || r.pointsStatus === "parse_failed"
                  : true),
        )
        .sort(
          (a, b) =>
            (b.roundDate ?? b.roundMonth ?? b.periodEnd ?? "").localeCompare(
              a.roundDate ?? a.roundMonth ?? a.periodEnd ?? "",
            ) ||
            a.state.localeCompare(b.state) ||
            (a.occupationCode ?? "").localeCompare(b.occupationCode ?? "") ||
            a.stream.localeCompare(b.stream) ||
            a.visaSubclass.localeCompare(b.visaSubclass),
        ),
    [base, round, stream, query, related, kind],
  );
  const coverage = q.data?.coverage.find((c) => c.state === state);
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(records.length / pageSize));
  const activePage = Math.min(page, pages);
  const visible = records.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );
  function resetDependent() {
    setRound("");
    setStream("");
  }
  function preset(s: string, y = "", term = "", view = "") {
    setState(fixedState ?? s);
    setYear(y);
    setQuery(occupationCode ?? term);
    setKind(view);
    setVisa("");
    resetDependent();
  }
  function downloadCsv() {
    const fields: (keyof HistoryRecord)[] = [
      "state",
      "programYear",
      "roundDate",
      "roundMonth",
      "periodEnd",
      "visaSubclass",
      "stream",
      "residence",
      "occupationCode",
      "occupationTitle",
      "occupationLevel",
      "points",
      "pointsBasis",
      "pointsStatus",
      "invitationCount",
      "countStatus",
      "countScope",
      "sourceId",
      "locator",
      "note",
    ];
    const cell = (v: unknown) =>
      '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const body = [
      [...fields, "sourceUrl", "datasetVersion"].join(","),
      ...records.map((r) =>
        [
          ...fields.map((f) => cell(r[f])),
          cell(q.data?.sources.find((s) => s.id === r.sourceId)?.url),
          cell(q.data?.datasetVersion),
        ].join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `NominationAtlas_${state || "all"}_${year || "history"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  if (q.isPending) return <p role="status">正在读取官方历史记录…</p>;
  if (q.error)
    return (
      <div className="empty" role="alert">
        {q.error.message}
      </div>
    );
  if (state && q.data && !q.data.records.some((r) => r.state === state))
    return <NoHistoryResult state={state} />;
  return (
    <section
      className="history-workspace section-gap"
      aria-label="真实邀请历史"
    >
      <div className="archive-heading">
        <div>
          <span className="badge verified">
            <Check size={12} /> 官方来源 · 部分历史
          </span>
          <h2>邀请记录档案</h2>
        </div>
        <Link to="/coverage">
          覆盖与缺口 <ArrowUpRight size={15} />
        </Link>
      </div>
      {!fixedState && !occupationCode && (
        <div className="history-presets">
          <span>快速查看</span>
          <button onClick={() => preset("WA", "2024-25", "261311")}>
            程序分析员 · WA
          </button>
          <button onClick={() => preset("SA", "2025-26", "26", "counts")}>
            ICT 人数 · SA
          </button>
          <button onClick={() => preset("ACT", "2025-26", "2613", "scores")}>
            开发与编程职业组 · ACT
          </button>
          <button onClick={() => preset("TAS", "2026-27")}>
            最新轮次 · TAS
          </button>
        </div>
      )}
      <div className="history-filters">
        <label>
          历史州 / 领地
          <select
            value={state}
            disabled={Boolean(fixedState)}
            onChange={(e) => {
              setState(e.target.value);
              resetDependent();
            }}
          >
            <option value="">全部地区</option>
            {Object.entries(stateNames).map(([s, n]) => (
              <option key={s} value={s}>
                {s} · {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          历史项目年度
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              resetDependent();
            }}
          >
            <option value="">全部已录入年度</option>
            {["2026-27", "2025-26", "2024-25", "2023-24"].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          历史签证范围
          <select
            value={visa}
            onChange={(e) => {
              setVisa(e.target.value);
              resetDependent();
            }}
          >
            <option value="">全部，含未拆分</option>
            <option value="190">190 · 已明确拆分</option>
            <option value="491">491 · 已明确拆分</option>
            <option value="combined">190 / 491 未拆分</option>
          </select>
        </label>
        <label>
          历史轮次 / 月份
          <select value={round} onChange={(e) => setRound(e.target.value)}>
            <option value="">全部已录入轮次</option>
            {rounds.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="history-search">
          职业名称或代码
          <span>
            <Search size={16} />
            <input
              value={query}
              readOnly={Boolean(occupationCode)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例如 261311 / 程序分析员 / Nurse"
            />
          </span>
        </label>
        <label>
          通道
          <select value={stream} onChange={(e) => setStream(e.target.value)}>
            <option value="">全部已录入通道</option>
            {streams.map((s) => (
              <option key={s} value={s}>
                {streamName(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          记录筛选
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">全部记录及缺失状态</option>
            <option value="scores">有已公布分数</option>
            <option value="counts">有无冲突邀请数</option>
            <option value="issues">来源冲突 / 待核对</option>
          </select>
        </label>
      </div>
      <div className="history-controls">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={related}
            onChange={(e) => setRelated(e.target.checked)}
          />{" "}
          包含代码对应的职业组（组人数不等于该职业人数）
        </label>
        <button className="text-button" onClick={() => preset("")}>
          重置筛选
        </button>
      </div>
      {coverage && (
        <div className="coverage-context">
          <strong>{state} 的官方数据口径</strong>
          <p>{coverage.note}</p>
          {coverage.status === "not_located_in_checked_sources" && (
            <p>{coverage.officialContext}</p>
          )}
        </div>
      )}
      {visa && visa !== "combined" && (state === "WA" || !state) && (
        <p className="notice">
          WA 职业末位 EOI 表没有拆分 190 /
          491，因此不会出现在当前单签证筛选中。选择“全部，含未拆分”可查看。
        </p>
      )}
      {(query === "261311" || query === "程序分析员") && <AnalystDefinition />}
      <div className="archive-results">
        <div>
          <strong>{number(records.length)} 条</strong>
          <span>当前筛选记录 · 不是获邀人数总和</span>
        </div>
        <button
          className="secondary"
          onClick={downloadCsv}
          disabled={!records.length}
        >
          <ArrowDownToLine size={15} /> 导出当前筛选 CSV
        </button>
      </div>
      <div className="history-legend">
        <span>
          <i className="legend-dot teal" /> 分数按官方体系显示
        </span>
        <span>
          <i className="legend-dot gold" /> 邀请数保留统计范围
        </span>
        <span>“未公布” ≠ 0 · 邀请 ≠ 获签</span>
      </div>
      {records.length ? (
        <div className="table-scroll history-table">
          <table>
            <thead>
              <tr>
                <th>轮次 / 地区</th>
                <th>职业 / 统计层级</th>
                <th>通道 / 签证</th>
                <th>已公布分数</th>
                <th>获邀人数 / 份数</th>
                <th>证据</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={hasConflict(r) ? "conflict-row" : ""}>
                  <td>
                    <strong>
                      {r.roundDate ?? r.roundMonth ?? r.periodEnd ?? "未注明"}
                    </strong>
                    <small>
                      {r.state} · {r.programYear}
                    </small>
                    {r.recordKind === "interim" && (
                      <span className="badge neutral">截至该日累计</span>
                    )}
                  </td>
                  <td>
                    <strong>
                      {r.occupationLevel === "all"
                        ? "全职业 / 所示通道"
                        : r.occupationTitle}
                    </strong>
                    <small>
                      {r.occupationCode ? `ANZSCO ${r.occupationCode} · ` : ""}
                      {levelNames[r.occupationLevel]}
                    </small>
                  </td>
                  <td>
                    {streamName(r.stream)}
                    <small>
                      {r.visaSubclass === "combined"
                        ? "190 / 491 未拆分"
                        : `Subclass ${r.visaSubclass}`}
                      <br />
                      {residenceName(r.residence)}
                    </small>
                  </td>
                  <td className="history-value">
                    {r.points !== null ? (
                      <strong>
                        {number(r.points)}
                        <em>分</em>
                      </strong>
                    ) : (
                      <span className="missing-value">{scoreMissing(r)}</span>
                    )}
                    <small>{basisNames[r.pointsBasis] ?? r.pointsBasis}</small>
                  </td>
                  <td className="history-value">
                    {hasConflict(r) ? (
                      <>
                        <span className="badge conflict">来源冲突</span>
                        {r.invitationCount !== null && (
                          <small>
                            原表记载 {number(r.invitationCount)}，待核对
                          </small>
                        )}
                      </>
                    ) : r.invitationCount !== null ? (
                      <strong>
                        {number(r.invitationCount)}
                        <em>{r.state === "WA" ? "份" : "邀请"}</em>
                      </strong>
                    ) : (
                      <span className="missing-value">{countMissing(r)}</span>
                    )}
                    <small>
                      {countScopeNames[r.countScope] ?? r.countScope}
                    </small>
                    {r.occupationLevel !== "occupation" &&
                      r.invitationCount !== null && (
                        <small className="scope-caution">非具体职业人数</small>
                      )}
                  </td>
                  <td>
                    <button
                      className="source-pill"
                      aria-label={`查看 ${r.id} 的原始证据`}
                      onClick={() => setSelected(r)}
                    >
                      <BookOpen size={15} /> 原始证据
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <h3>这个范围没有已录入的记录</h3>
          <p>
            请调整职业、轮次或签证筛选。没有记录不能推断为零邀请；覆盖页保留已检查的官方来源。
          </p>
        </div>
      )}
      <div className="history-pagination">
        <p>
          第 {activePage} / {pages} 页 · 每页 {pageSize} 条
        </p>
        <div>
          <button
            className="secondary"
            disabled={activePage === 1}
            onClick={() => setPage(activePage - 1)}
          >
            <ChevronLeft size={16} /> 上一页
          </button>
          <button
            className="secondary"
            disabled={activePage === pages}
            onClick={() => setPage(activePage + 1)}
          >
            下一页 <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <p className="note archive-version">
        证据版本 {q.data?.datasetVersion} · 不跨层级相加，不用配额替代邀请数。
      </p>
      {selected && (
        <RecordDialog
          record={selected}
          source={q.data?.sources.find((s) => s.id === selected.sourceId)}
          onClose={() => setSelected(undefined)}
        />
      )}
    </section>
  );
}

export function OfficialCoverage() {
  const q = useHistory();
  if (q.isPending) return <p role="status">正在读取覆盖范围…</p>;
  if (q.error)
    return (
      <div className="empty" role="alert">
        {q.error.message}
      </div>
    );
  return (
    <>
      <div className="coverage-summary">
        <div>
          <strong>{q.data.stats.statesWithHistory} / 8</strong>
          <span>州及领地有部分邀请历史</span>
        </div>
        <div>
          <strong>{number(q.data.stats.records)}</strong>
          <span>来源记录（含缺失状态）</span>
        </div>
        <div>
          <strong>{q.data.stats.sources}</strong>
          <span>可追溯官方来源快照</span>
        </div>
      </div>
      <div className="coverage-grid">
        {q.data.coverage.map((c) => (
          <article className="panel coverage-card" key={c.state}>
            <div className="panel-heading">
              <h2>
                {c.state} <small>{stateNames[c.state]}</small>
              </h2>
              <span
                className={
                  "badge " +
                  (c.status === "not_located_in_checked_sources"
                    ? "neutral"
                    : "verified")
                }
              >
                {c.status === "not_located_in_checked_sources"
                  ? "所查来源未找到轮次表"
                  : "已录入部分历史"}
              </span>
            </div>
            <p>{c.note}</p>
            {c.officialContext && <p className="note">{c.officialContext}</p>}
            <div className="coverage-sources">
              {q.data.sources
                .filter((s) => c.sourceIds.includes(s.id))
                .map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                    <BookOpen size={13} /> {s.title} <ArrowUpRight size={12} />
                  </a>
                ))}
            </div>
            <Link className="coverage-action" to={`/history?state=${c.state}`}>
              查看 {c.state} 已录入记录 →
            </Link>
          </article>
        ))}
      </div>
      <section className="panel section-gap">
        <h2>如何阅读这些数据</h2>
        <ul>
          {q.data.methodology.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="note">
          当前没有完整全国逐职业历史、完整 EOI 分布或个人获签结果。NSW / VIC /
          QLD / NT 的缺口仅说明本次检查的来源中未找到对应数据。
        </p>
      </section>
    </>
  );
}
