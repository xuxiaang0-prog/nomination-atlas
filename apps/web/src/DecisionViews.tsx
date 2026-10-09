import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronRight, MapPin } from "lucide-react";
import { AustraliaMap } from "./AustraliaMap";
import { rankingDatasets } from "./OccupationBoard";
import {
  activityMetrics,
  recentDatasets,
  StateOccupationExplorer,
} from "./RecentActivityBoard";
import {
  stateNames,
  useHistory,
  type HistoryData,
  type StateNominations,
} from "./history-data";
const fullNames: Record<string, string> = {
  NSW: "新南威尔士州",
  VIC: "维多利亚州",
  QLD: "昆士兰州",
  WA: "西澳大利亚州",
  SA: "南澳大利亚州",
  TAS: "塔斯马尼亚州",
  ACT: "首都领地",
  NT: "北领地",
};
const stateOrder = ["WA", "NSW", "VIC", "QLD", "SA", "TAS", "ACT", "NT"];
const fmt = (v: number | null | undefined) =>
  v == null ? "未公布" : v.toLocaleString("en-AU");
function DataStatus({ error }: { error?: Error | null }) {
  return (
    <div className="empty" role={error ? "alert" : "status"}>
      {error ? error.message : "正在读取官方资料…"}
    </div>
  );
}
function SourceLink({ data, id }: { data: HistoryData; id?: string }) {
  const s = data.sources.find((s) => s.id === id);
  return s ? (
    <a className="result-source" href={s.url} target="_blank" rel="noreferrer">
      官方来源 <ArrowUpRight size={13} />
    </a>
  ) : null;
}
export function nominationDisplay(n: StateNominations, visa: "190" | "491") {
  return n[visa === "190" ? "countStatus190" : "countStatus491"] ===
    "suppressed_below_5"
    ? "<5"
    : fmt(n[visa === "190" ? "nomination190" : "nomination491"]);
}
export function ResultDashboard() {
  const q = useHistory();
  const [selected, setSelected] = useState("WA");
  if (!q.data) return <DataStatus error={q.error} />;
  const data = q.data,
    n = data.nominations?.find(
      (n) => n.state === selected && n.programYear === "2025-26",
    ),
    ds = rankingDatasets(data, selected),
    recent = recentDatasets(data, selected)[0],
    recentRows = (data.recentActivity?.records ?? []).filter(
      (r) => r.state === selected && r.datasetId === recent?.id,
    ),
    distinct = new Set(
      recentRows.length
        ? recentRows.map((r) => r.occupationCode)
        : ds.flatMap((d) => d.rows.map((r) => r.occupationCode)),
    ).size;
  const metric = recent ? activityMetrics[recent.metric] : undefined;
  const totalText = (visa: string) => {
    const total = recent?.stateTotals?.find(
      (r) => r.state === selected && r.visaSubclass === visa,
    );
    return total?.countStatus.startsWith("suppressed")
      ? (total.countDisplay ?? "小额隐藏")
      : total
        ? fmt(total.count)
        : "未取得";
  };
  return (
    <>
      <div className="result-title">
        <p className="eyebrow">AUSTRALIAN NOMINATION ATLAS</p>
        <h1>从地图出发，看看每个职业。</h1>
        <p>
          选一个州，打开完整职业榜。按分数高低或数量浏览，发现你还没关注过的方向。
        </p>
      </div>
      <div className="home-grid real-map-home">
        <section className="panel map-panel">
          <div className="panel-heading">
            <h2>选择州或领地</h2>
            <span>8 个区域</span>
          </div>
          <AustraliaMap selected={selected} onSelect={setSelected} />
          <p className="note map-note">
            点击地图或下方州名，再查看职业与邀请结果。
          </p>
        </section>
        <section className="panel selected-panel" aria-label="所选州真实结果">
          <p className="eyebrow">
            <MapPin size={14} />
            {selected} · 近期职业资料
          </p>
          <h2>{fullNames[selected]}</h2>
          <p className="selected-intro">
            {distinct} 个已收录{recent ? "具体职业" : "职业 / 职业组"}
            ；全名单可排序、搜索和展开。
          </p>
          <div className="map-evidence-level">
            {recent
              ? `${recent.asOf ?? recent.periodEnd} · ${metric?.short}`
              : selected === "WA"
                ? "职业末位 EOI · 2025–2026"
                : selected === "ACT"
                  ? "职业组 Matrix · 2025–2026"
                  : selected === "SA"
                    ? "近期职业组邀请量 + 2019 具体职业 FOI"
                    : "2019 职业 FOI 档案 · 近期职业明细未取得"}
          </div>
          <div className="allocation-pair">
            <div>
              <span>190 {metric?.short ?? "已提名 EOI"}</span>
              <strong>
                {recent
                  ? totalText("190")
                  : n
                    ? nominationDisplay(n, "190")
                    : "未取得"}
              </strong>
            </div>
            <div>
              <span>491 {metric?.short ?? "已提名 EOI"}</span>
              <strong>
                {recent
                  ? totalText("491")
                  : n
                    ? nominationDisplay(n, "491")
                    : "未取得"}
              </strong>
            </div>
          </div>
          <p className="note">
            {recent
              ? metric?.description
              : `2025–26 年度 · 截至 ${n?.asOf ?? "未注明"} · 官方页面历史索引。提名总数与职业邀请明细属于不同统计。`}
          </p>
          <Link className="primary full" to={"/states/" + selected}>
            查看{stateNames[selected]}完整职业榜 <ChevronRight size={16} />
          </Link>
          <p className="map-dataset-note">
            近期数据优先展示；可切换州邀请披露与历史档案。按分数或数量探索全部职业。
          </p>
        </section>
      </div>
      <section className="state-list" aria-label="与地图等价的州及领地列表">
        {stateOrder.map((state) => (
          <button
            key={state}
            className={selected === state ? "active" : ""}
            onClick={() => setSelected(state)}
          >
            <strong>{state}</strong>
            <span>{stateNames[state]}</span>
            <small>
              {recentDatasets(data, state).length
                ? "近期职业 / 分数"
                : state === "WA"
                  ? "具体职业 EOI"
                  : state === "ACT"
                    ? "职业组 Matrix"
                    : state === "SA"
                      ? "组人数 / 旧年 FOI"
                      : "旧年职业 FOI"}
            </small>
          </button>
        ))}
      </section>
      <div className="map-next">
        <Link to="/occupations">直接搜索全部已收录职业 →</Link>
        <span>每州独立查看；不同分数体系不混排。</span>
      </div>
      <details className="result-method">
        <summary>展开八州实际提名总量与统计日期</summary>
        <NominationBoard data={data} />
      </details>
    </>
  );
}
export function NominationBoard({ data }: { data: HistoryData }) {
  const [year, setYear] = useState("2025-26");
  const rows = (data.nominations ?? []).filter((n) => n.programYear === year);
  const first = rows[0];
  return (
    <section className="result-panel nationwide" aria-label="八州实际提名数量">
      <div className="result-panel-head">
        <div>
          <p className="eyebrow">03 · STATE NOMINATIONS</p>
          <h2>各州实际提名了多少 EOI？</h2>
          <p>
            这是已获得州提名的数量，区别于邀请申请州提名、年度配额及最终获签。
          </p>
        </div>
        <label>
          提名统计年度
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option>2025-26</option>
            <option>2026-27</option>
          </select>
        </label>
      </div>
      {first ? (
        <>
          <div className="nomination-period">
            <strong>
              {year} · 截至 {first.asOf}
            </strong>
            <span>
              {first.verificationStatus === "historical_index_only"
                ? "官方页面历史索引；现页已更新"
                : "官方当前页面快照"}
            </span>
            <SourceLink data={data} id={first.sourceId} />
          </div>
          <div className="table-scroll">
            <table className="result-table state-results">
              <thead>
                <tr>
                  <th>州 / 领地</th>
                  <th>190 已提名 EOI</th>
                  <th>491 已提名 EOI</th>
                  <th>职业分数是否可查？</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.state}>
                    <td>
                      <Link to={`/states/${n.state}`}>
                        <b>{n.state}</b> {stateNames[n.state]}
                      </Link>
                    </td>
                    <td className="result-number">
                      {nominationDisplay(n, "190")}
                    </td>
                    <td className="result-number">
                      {nominationDisplay(n, "491")}
                    </td>
                    <td>
                      {n.state === "WA"
                        ? "可查部分职业 EOI"
                        : n.state === "ACT"
                          ? "可查职业组 Matrix"
                          : n.state === "TAS"
                            ? "仅有州级优先属性分"
                            : "可查 2019 FOI 历史分数"}
                    </td>
                    <td>
                      <Link to={`/states/${n.state}`}>查看结果 →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="result-footnote">
            {first.verificationStatus === "historical_index_only"
              ? "本表保留 Home Affairs 官方 URL 的历史检索正文，未取得该旧版页面的原始 HTML；不是全年最终数。"
              : "本表仅累计到所示截至日。<5 表示官方隐去了具体小额数值，不能填成 0。"}{" "}
            各州规模、筛选政策与申请人数不同，提名量不是个人成功率。
          </p>
        </>
      ) : (
        <p className="result-footnote">这个年度的州级统计尚未载入。</p>
      )}
    </section>
  );
}

export function StateNominationSummary({
  data,
  state,
}: {
  data: HistoryData;
  state: string;
}) {
  const [year, setYear] = useState("2025-26");
  const n = data.nominations?.find(
    (x) => x.state === state && x.programYear === year,
  );
  const dated = data.records
    .filter(
      (r) =>
        r.state === state && r.points !== null && r.occupationLevel !== "all",
    )
    .map((r) => r.roundDate ?? r.roundMonth ?? "")
    .sort();
  const scoreStatus = dated.length
    ? "有职业/组分数，最近记录 " + dated.at(-1)
    : "未取得公开职业分数表";
  return (
    <section className="state-answer" aria-label={`${state} 已提名结果`}>
      <div className="state-answer-intro">
        <p className="eyebrow">STATE NOMINATION · 实际已提名</p>
        <h2>{stateNames[state]}提名了多少？</h2>
        <label>
          州级统计年度
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option>2025-26</option>
            <option>2026-27</option>
          </select>
        </label>
        {n && (
          <p>
            截至 <strong>{n.asOf}</strong> · 累计获得州提名的 EOI
          </p>
        )}
      </div>
      <div className="state-answer-numbers">
        <div>
          <span>190 已提名</span>
          <strong>{n ? nominationDisplay(n, "190") : "未取得"}</strong>
          <small>EOI</small>
        </div>
        <div>
          <span>491 已提名</span>
          <strong>{n ? nominationDisplay(n, "491") : "未取得"}</strong>
          <small>EOI</small>
        </div>
        <div className="state-score-status">
          <span>该州公开的获邀分数</span>
          <b>{scoreStatus}</b>
          <small>不能用 65 分资格门槛代替实际获邀分数。</small>
        </div>
      </div>
      {n && (
        <div className="nomination-provenance">
          <span>
            {n.verificationStatus === "historical_index_only"
              ? "来源：Home Affairs 官方页面历史索引；当前页面已更新。旧版 HTML 未取得，非全年最终数。"
              : "来源：Home Affairs 当前官方页面。<5 为小额数据隐去，不能当作 0。"}
          </span>
          <SourceLink data={data} id={n.sourceId} />
        </div>
      )}
    </section>
  );
}

function StateFlow({ data, state }: { data: HistoryData; state: string }) {
  const guide = data.guides?.find((g) => g.state === state);
  return (
    <section className="state-flow result-panel">
      <div className="result-panel-head">
        <div>
          <p className="eyebrow">HOW INVITATIONS WORK</p>
          <h2>这些邀请怎么发出？</h2>
        </div>
      </div>
      <div className="stage-explanation">
        <div>
          <b>州提名申请邀请</b>
          <p>
            州先筛选 EOI / ROI 或 Matrix，再邀请申请州提名。WA、SA、ACT、TAS
            的近期轮次记录主要属于此阶段。
          </p>
        </div>
        <div>
          <b>获提名后的签证申请邀请</b>
          <p>
            州提名后由 SkillSelect 发出签证申请邀请。新增 2019 FOI 逐 EOI
            档案属于此阶段，不能当成当前州预邀请分数线。
          </p>
        </div>
        <div>
          <b>签证获批</b>
          <p>
            后续由 Home Affairs
            审理。近期职业申请统计记录递交的主申请份数；获签与邀请属于不同阶段。
          </p>
        </div>
      </div>
      {guide && (
        <div className="state-guide">
          <p className="guide-date">
            核查日期 {guide.checkedAt} ·
            以下为官方流程说明，与上方各年份历史结果分开
          </p>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {guide.note && <p>{guide.note}</p>}
          <div className="guide-links">
            {guide.sourceIds.map((id) => (
              <SourceLink data={data} id={id} key={id} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
function StateTotals({ data, state }: { data: HistoryData; state: string }) {
  const rows = data.records.filter(
    (r) =>
      r.state === state &&
      r.occupationLevel === "all" &&
      r.invitationCount !== null,
  );
  const dates = rows
    .map((r) => r.roundDate ?? r.roundMonth ?? "")
    .filter(Boolean)
    .sort();
  const latest = dates.at(-1);
  const latestRows = rows
    .filter((r) => (r.roundDate ?? r.roundMonth) === latest)
    .slice(0, 20);
  return (
    <>
      {latestRows.length > 0 && (
        <details className="result-method">
          <summary>
            查看 {latest} 已公布的全州 / 通道邀请合计（不分配给具体职业）
          </summary>
          <div className="table-scroll">
            <table className="result-table">
              <thead>
                <tr>
                  <th>通道</th>
                  <th>签证</th>
                  <th>公布邀请数</th>
                  <th>分数指标</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {latestRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.stream}
                      <small>{r.residence}</small>
                    </td>
                    <td>{r.visaSubclass}</td>
                    <td>{r.invitationCount}</td>
                    <td>
                      {r.points ?? "未公布"}
                      {r.pointsBasis === "tasmania_priority_score"
                        ? "（塔州优先属性分）"
                        : ""}
                    </td>
                    <td>
                      <SourceLink data={data} id={r.sourceId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <details className="result-method">
        <summary>查看 {state} 190 / 491 州级实际提名累计</summary>
        <StateNominationSummary data={data} state={state} />
      </details>
    </>
  );
}
export function StateResults({ state }: { state: string }) {
  const q = useHistory();
  if (!q.data) return <DataStatus error={q.error} />;
  const data = q.data;
  return (
    <>
      <Link className="back" to="/">
        ← 返回地图选州
      </Link>
      <div className="result-title">
        <p className="eyebrow">{state} · ALL OCCUPATIONS</p>
        <h1>{fullNames[state]}：职业、分数与实际数量</h1>
        <p>
          查看全部已收录职业。每份资料保留真实年份、签证和公布层级，展开可看分数对应的人数。
        </p>
      </div>
      <nav className="state-nav" aria-label="切换州职业榜">
        {stateOrder.map((code) => (
          <Link
            className={code === state ? "active" : ""}
            key={code}
            to={"/states/" + code}
          >
            {code} {stateNames[code]}
          </Link>
        ))}
      </nav>
      <StateOccupationExplorer key={state} data={data} state={state} />
      <StateFlow data={data} state={state} />
      <StateTotals data={data} state={state} />
    </>
  );
}
export function OccupationDirectory() {
  const q = useHistory();
  const [state, setState] = useState("WA");
  if (!q.data) return <DataStatus error={q.error} />;
  return (
    <>
      <div className="result-title">
        <p className="eyebrow">OCCUPATION EXPLORER</p>
        <h1>从全部职业里寻找方向。</h1>
        <p>先选州，再按分数、人数或关键词探索。没有预设蓝领、IT 或任何行业。</p>
      </div>
      <div className="directory-state">
        <label>
          查看哪个州
          <select value={state} onChange={(e) => setState(e.target.value)}>
            {stateOrder.map((code) => (
              <option value={code} key={code}>
                {code} · {fullNames[code]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <StateOccupationExplorer key={state} data={q.data} state={state} />
    </>
  );
}
export function NoHistoryResult({ state }: { state: string }) {
  const q = useHistory();
  if (!q.data) return <DataStatus error={q.error} />;
  return (
    <>
      <StateNominationSummary data={q.data} state={state} />
      <p className="no-cutoff">
        当前档案未取得这个范围的职业行。可从完整职业榜选择其他官方资料。
      </p>
      <Link to={"/states/" + state}>打开 {state} 完整职业榜 →</Link>
    </>
  );
}
