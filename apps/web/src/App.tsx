import {
  ResultDashboard,
  StateResults,
  OccupationDirectory,
} from "./DecisionViews";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  HistoryExplorer,
  HistoryHighlights,
  HistoryPage,
  OfficialCoverage,
} from "./History";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Database,
  ExternalLink,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { AustraliaMap } from "./AustraliaMap";
import geometry from "./australia-map.json";
export { AustraliaMap } from "./AustraliaMap";
import {
  cacheKey,
  get,
  offline,
  post,
  type Env,
  type Filters,
  type Schema,
} from "./api";
import {
  date,
  display,
  metricNames,
  scoreDescription,
  statusNames,
} from "./logic";
type Context = {
  f: Filters;
  setF: (next: Filters) => void;
  source: (c: Schema<"Citation">) => void;
};
const Context = createContext<Context>(null!);
const useAtlas = () => useContext(Context);
function useApi<T>(
  path: string,
  extra: Record<string, string> = {},
  enabled = true,
) {
  const { f } = useAtlas();
  return useQuery({
    queryKey: cacheKey(path, f, extra),
    queryFn: ({ signal }) => get<Env<T>>(path, f, extra, signal),
    enabled,
  });
}
function Status({
  query,
  children,
}: {
  query: { isPending: boolean; error: Error | null };
  children: ReactNode;
}) {
  if (query.isPending)
    return (
      <p className="status" role="status">
        正在读取数据…
      </p>
    );
  if (query.error)
    return (
      <div className="empty" role="alert">
        <strong>暂时无法读取这个范围</strong>
        <p>{query.error.message}</p>
      </div>
    );
  return <>{children}</>;
}
function Meta({ value }: { value?: Env<unknown> }) {
  if (!value) return null;
  return (
    <div className="meta">
      <span className={"badge " + (value.meta.isDemo ? "demo" : "verified")}>
        {value.meta.coverageStatus === "catalog_only"
          ? "职业目录 · 候选名称待政策核对"
          : value.meta.isDemo
            ? "DEMO · 全部为合成数据"
            : "VERIFIED HISTORY · 已核对历史数据"}
      </span>
      <span>版本 {value.meta.datasetVersion}</span>
      <span>
        覆盖：
        {statusNames[value.meta.coverageStatus] ?? value.meta.coverageStatus}
      </span>
    </div>
  );
}
function Evidence({ value }: { value?: Env<unknown> }) {
  const { source } = useAtlas();
  if (!value) return null;
  return (
    <div className="evidence">
      <Meta value={value} />
      {value.warnings.map((w) => (
        <p key={w} className="note">
          {w}
        </p>
      ))}
      <div className="source-links">
        {(value.meta.coverageStatus === "catalog_only"
          ? []
          : value.sources
        ).map((s) => (
          <button key={s.sourceVersionId} onClick={() => source(s)}>
            <BookOpen size={14} /> {s.title}
            <ArrowUpRight size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}
function Title({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function Home() {
  const { f } = useAtlas();
  return f.mode === "verified_historical" ? (
    <ResultDashboard />
  ) : (
    <LegacyHome />
  );
}
function LegacyHome() {
  const q = useApi<Schema<"StatesData">>("/api/states");
  const navigate = useNavigate();
  const [selected, setSelected] = useState("WA");
  const { f } = useAtlas();
  const item = q.data?.data.items.find((s) => s.code === selected);
  return (
    <>
      <Title
        eyebrow="AUSTRALIAN NOMINATION ATLAS"
        title="看得见数字，也看得见依据。"
        description="澳洲州提名邀请档案 · 官方分数、邀请数量与来源追溯"
      />
      {f.mode === "verified_historical" && <HistoryHighlights />}
      <div className="home-grid">
        <section className="panel map-panel">
          <div className="panel-heading">
            <h2>选择州或领地</h2>
            <span>8 个区域</span>
          </div>
          <AustraliaMap selected={selected} onSelect={setSelected} />
          <p className="note map-note">
            点击地图或下面的列表；键盘也可操作。边界仅用于导航。
          </p>
        </section>
        <section className="panel selected-panel">
          <p className="eyebrow">
            <MapPin size={14} />
            {selected}
          </p>
          <h2>{item?.nameZh ?? "西澳大利亚"}</h2>
          <p className="english">{item?.nameEn ?? "Western Australia"}</p>
          <Status query={q}>
            <Meta value={q.data} />
            <div className="allocation-pair">
              <div>
                <span>190 州提名配额</span>
                <strong>{display(item?.allocation190)}</strong>
              </div>
              <div>
                <span>491 州提名配额</span>
                <strong>{display(item?.allocation491)}</strong>
              </div>
            </div>
            <p className="note">
              {f.mode === "demo"
                ? "演示模式不复制真实配额。职业轮次示例以 WA / 190 为主。"
                : "这里显示 2025–26 年度配额。真实邀请分数与数量请查看邀请档案，四个州及领地已有部分历史。"}
            </p>
            <button
              className="primary full"
              onClick={() => navigate("/states/" + selected)}
            >
              查看州详情 <ChevronRight size={16} />
            </button>
            <div className="definition">
              <ShieldCheck size={18} />
              <p>
                配额不是邀请数，也不是最终获签人数。空白代表缺少记录，不代表零。
              </p>
            </div>
          </Status>
        </section>
      </div>
      <section className="state-list" aria-label="与地图等价的州及领地列表">
        {q.data?.data.items.map((s) => (
          <button
            key={s.code}
            className={selected === s.code ? "active" : ""}
            onClick={() => setSelected(s.code)}
          >
            <strong>{s.code}</strong>
            <span>{s.nameZh}</span>
            <small>
              {f.mode === "demo"
                ? "合成演示"
                : ["WA", "ACT", "SA", "TAS"].includes(s.code)
                  ? "已有部分邀请历史"
                  : "轮次表尚未找到"}
            </small>
          </button>
        ))}
      </section>
      <Evidence value={q.data} />
      <section className="three-cards">
        <Link to="/occupations">
          <Search />
          <h3>找到具体职业</h3>
          <p>用中英文或职业代码搜索，再确认分类版本。</p>
        </Link>
        <Link to="/questions">
          <MessageSquare />
          <h3>问一个有范围的问题</h3>
          <p>先确认职业、州和年度，再读取模板回答。</p>
        </Link>
        <Link to="/coverage">
          <Database />
          <h3>检查数据覆盖</h3>
          <p>看清已有证据与尚未录入的部分。</p>
        </Link>
      </section>
    </>
  );
}
function Facts({
  items,
  sources = [],
}: {
  items: Schema<"MetricValue">[];
  sources?: Schema<"Citation">[];
}) {
  const { source } = useAtlas();
  return items.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>指标 / 范围</th>
            <th>数值</th>
            <th>时间</th>
            <th>状态及来源位置</th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id}>
              <td>
                {metricNames[f.metricType]}
                <small>
                  {f.state} · {f.visaSubclass} · {f.programYear}
                  <br />
                  {f.stream} / {f.residenceCategory} / {f.pointsBasis}
                  <br />
                  ANZSCO {f.classificationVersion} · {f.roundId ?? "无轮次"}
                </small>
              </td>
              <td className="number">
                {display(f.value)}
                <small>{f.unit === "points" ? "分" : "记录/配额单位"}</small>
              </td>
              <td>
                {f.eventDate ?? f.periodStart + " → " + f.periodEnd}
                {f.eoiEffectiveAt && (
                  <small>EOI 生效 {date(f.eoiEffectiveAt)}</small>
                )}
              </td>
              <td>
                <span>{statusNames[f.status]}</span>
                {f.nullReason && <small>{f.nullReason}</small>}
                <small className="locator">{f.locator}</small>
                <small>证据版本 {f.sourceVersionId.slice(0, 8)}</small>
                {sources.some(
                  (c) => c.sourceVersionId === f.sourceVersionId,
                ) && (
                  <button
                    className="row-source"
                    onClick={() =>
                      source(
                        sources.find(
                          (c) => c.sourceVersionId === f.sourceVersionId,
                        )!,
                      )
                    }
                  >
                    查看这条记录的证据
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="该范围的历史记录尚未录入。缺失不等于零。" />
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Database size={24} />
      <p>{text}</p>
    </div>
  );
}
function StatePage() {
  const { code = "WA" } = useParams();
  const q = useApi<Schema<"StateOverview">>(
    "/api/states/" + code + "/overview",
  );
  const [scopeId, setScopeId] = useState("");
  const [metric, setMetric] = useState("last_invited_eoi_points");
  const { f } = useAtlas();
  useEffect(
    () => setScopeId(""),
    [code, f.mode, f.visaSubclass, f.programYear],
  );
  const scope = q.data?.data.scopes.find((s) => s.id === scopeId);
  const top = useApi<Schema<"TopData">>(
    "/api/states/" + code + "/top-occupations",
    {
      metricType: metric,
      limit: "5",
      ...(scope
        ? {
            roundId: scope.roundId!,
            stream: scope.stream,
            residenceCategory: scope.residenceCategory,
          }
        : {}),
    },
    Boolean(q.data && (scope || !q.data.data.scopes.length)),
  );
  if (f.mode === "verified_historical")
    return (
      <>
        <StateResults state={code} />
        {["WA", "ACT", "SA", "TAS", "NSW", "VIC", "QLD", "NT"].includes(
          code,
        ) && (
          <details className="result-method full-archive">
            <summary>展开 {code} 的完整历史档案与筛选</summary>
            <HistoryExplorer key={code} fixedState={code} />
          </details>
        )}
      </>
    );
  return (
    <>
      <Link className="back" to="/">
        ← 返回地图
      </Link>
      <Title
        eyebrow={`${code} · STATE OVERVIEW`}
        title={q.data?.data.nameZh ?? code}
        description={q.data?.data.nameEn ?? "州提名历史数据"}
      />
      <Status query={q}>
        <Meta value={q.data} />
        <div className="two-cards">
          <section className="panel">
            <h2>{f.visaSubclass} 州提名配额</h2>
            <strong className="hero-number">
              {display(q.data?.data.allocations[0]?.value)}
            </strong>
            <p className="note">{f.programYear} · nomination_allocation</p>
            <p>年度配额反映可用提名名额，不代表已经发出的邀请。</p>
          </section>
          <section className="panel">
            <h2>政策原文</h2>
            <span className="badge neutral">尚未录入</span>
            <p>{q.data?.data.policySummary}</p>
            <p className="note">
              加入政策之前，需记录官方原文、适用日期和修订版本。
            </p>
          </section>
        </div>
        {f.mode === "demo" && (
          <section className="panel section-gap">
            <div className="panel-heading">
              <h2>Demo · 同一范围内的合成职业记录</h2>
              <span>最多展示 5 条</span>
            </div>
            <p className="notice">
              本表全部为合成样本。包括 75
              分在内的数值均非真实获邀历史，也不是获签结果。
            </p>
            <p>
              末位 EOI
              分数按从低到高显示；邀请数按从高到低显示。并列按职业代码排序。
            </p>
            {Boolean(q.data?.data.scopes.length) && (
              <div className="inline-controls">
                <label>
                  先确认可比较范围
                  <select
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                  >
                    <option value="">选择轮次、通道和居住类别</option>
                    {q.data?.data.scopes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.eventDate} · {s.stream} · {s.residenceCategory} ·{" "}
                        {s.pointsBasis}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  指标
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                  >
                    <option value="last_invited_eoi_points">
                      已公布末位 EOI 分数
                    </option>
                    <option value="nomination_invitation_count">
                      州提名邀请记录数
                    </option>
                  </select>
                </label>
              </div>
            )}
            {q.data?.data.scopes.length && !scope ? (
              <Empty text="确认一个轮次和范围后，才显示可比较的排名。" />
            ) : (
              <Status query={top}>
                {top.data?.data.items.length ? (
                  <>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>并列名次</th>
                            <th>职业 · ANZSCO 2022</th>
                            <th>{metricNames[metric]}</th>
                            <th>来源位置</th>
                          </tr>
                        </thead>
                        <tbody>
                          {top.data?.data.items.map((o) => (
                            <tr key={o.occupationId}>
                              <td>{o.rank}</td>
                              <td>
                                <Link
                                  to={`/occupations/ANZSCO/2022/${o.code}?state=${code}`}
                                >
                                  {o.titleZh}
                                  <small>
                                    {o.title} · {o.code}
                                  </small>
                                </Link>
                              </td>
                              <td className="number">
                                {display(o.value)}
                                <small className="demo-cell">DEMO · 合成</small>
                              </td>
                              <td>
                                <small>{o.locator}</small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="note">
                      有数值的可比较记录共 {top.data?.data.publishedRecords}{" "}
                      条；第 5 个显示位置所在分数组共有{" "}
                      {top.data?.data.tieCount} 条。显示上限可能截断并列项。
                    </p>
                    <p className="note">{scoreDescription(metric)}</p>
                  </>
                ) : (
                  <Empty
                    text={top.data?.data.reason ?? "该范围的职业记录尚未录入。"}
                  />
                )}
                <Evidence value={top.data} />
              </Status>
            )}
          </section>
        )}
        <section className="panel section-gap">
          <h2>配额观测与原始定位</h2>
          <Facts
            items={q.data?.data.allocations ?? []}
            sources={q.data?.sources}
          />
        </section>
        <Evidence value={q.data} />
      </Status>
    </>
  );
}
function Occupations() {
  const { f } = useAtlas();
  const [text, setText] = useState("软件工程师");
  const [search, setSearch] = useState(text);
  const q = useApi<Schema<"OccupationSummary">[]>("/api/occupations/search", {
    q: search,
  });
  if (f.mode === "verified_historical") return <OccupationDirectory />;
  return (
    <>
      <Title
        eyebrow="OCCUPATION SEARCH"
        title="先确认职业，再看记录。"
        description="支持中英文名称、常用名称和 ANZSCO 代码。名称匹配不代表职业符合州政策。"
      />
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) setSearch(text.trim());
        }}
      >
        <label htmlFor="occupation-search" className="sr-only">
          职业名称或代码
        </label>
        <Search size={20} />
        <input
          id="occupation-search"
          value={text}
          maxLength={120}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如 软件工程师 / Tiler / 261313"
        />
        <button className="primary">搜索</button>
      </form>
      <div className="chips">
        {["工程师", "程序员", "瓷砖工", "水管工", "木工"].map((t) => (
          <button
            key={t}
            onClick={() => {
              setText(t);
              setSearch(t);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <Status query={q}>
        <p className="note">
          {q.data?.data.length ?? 0}{" "}
          个候选。进入详情即确认所显示的职业代码与分类版本。
        </p>
        <div className="occupation-list">
          {q.data?.data.map((o) => (
            <Link
              key={o.id}
              to={`/occupations/${o.system}/${o.version}/${o.code}`}
            >
              <div>
                <h2>{o.titleZh}</h2>
                <p>{o.title}</p>
                <span className="badge neutral">
                  {o.system} {o.version} · {o.code}
                </span>
              </div>
              <ChevronRight />
            </Link>
          ))}
        </div>
        {q.data?.data.length === 0 && (
          <Empty text="未找到这个目录中的匹配项。请尝试更具体的名称或代码。" />
        )}
        <Evidence value={q.data} />
      </Status>
    </>
  );
}
function Distribution({ value }: { value?: Env<Schema<"DistributionData">> }) {
  if (!value) return null;
  const d = value.data;
  return (
    <section className="panel">
      <h2>分数分布</h2>
      <p className="note">指标：签证邀请记录数 · 群体：{d.cohortKind}</p>
      {d.chartAllowed ? (
        <>
          <div
            className="bar-chart"
            role="img"
            aria-label="完整已公布样本的分数分布；数值详见下表"
          >
            {d.bins.map((b) => (
              <div className="bar-row" key={b.lower}>
                <span>{b.lower} 分</span>
                <div>
                  <i style={{ width: b.percentage + "%" }} />
                </div>
                <strong>{b.percentage}%</strong>
              </div>
            ))}
          </div>
          <p>
            分母 N = {display(d.denominator)} · {d.denominatorDefinition}
          </p>
        </>
      ) : (
        <Empty text={d.reason} />
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>分数区间</th>
              <th>记录数</th>
              <th>占比</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {d.bins.map((b) => (
              <tr key={b.lower}>
                <td>
                  {b.lower === b.upper ? b.lower : `${b.lower}–${b.upper}`}
                </td>
                <td>{display(b.count)}</td>
                <td>{b.percentage == null ? "不计算" : b.percentage + "%"}</td>
                <td>{statusNames[b.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">{d.reason}。不据已公布分组反推出隐去值。</p>
      <Evidence value={value} />
    </section>
  );
}
function Trend({ value }: { value?: Env<Schema<"TrendData">> }) {
  if (!value) return null;
  const d = value.data;
  const complete = d.items.filter((p) => !p.isYtd);
  const max = Math.max(...complete.map((p) => Number(p.value)), 1);
  return (
    <section className="panel">
      <h2>年度流量</h2>
      <p className="note">{metricNames[d.metricType]} · 非重叠期间</p>
      {complete.length ? (
        <>
          <div
            className="columns"
            role="img"
            aria-label="完整年度记录数；数值详见下表"
          >
            {complete.map((p) => (
              <div key={p.programYear}>
                <strong>{display(p.value)}</strong>
                <i
                  style={{
                    height: Math.max(6, (Number(p.value) / max) * 120) + "px",
                  }}
                />
                <span>{p.programYear}</span>
              </div>
            ))}
          </div>
          {d.items
            .filter((p) => p.isYtd)
            .map((p) => (
              <div className="ytd" key={p.programYear}>
                <span>
                  {p.programYear} YTD · 截至 {p.periodEnd}
                </span>
                <strong>{display(p.value)}</strong>
                <small>单独列示，不与完整年度同比。</small>
              </div>
            ))}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>年度</th>
                  <th>记录数</th>
                  <th>统计结束</th>
                  <th>期间</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map((p) => (
                  <tr key={p.programYear}>
                    <td>{p.programYear}</td>
                    <td>{display(p.value)}</td>
                    <td>{p.periodEnd}</td>
                    <td>{p.isYtd ? "YTD" : "完整年度"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Empty text={d.reason ?? "尚无年度记录"} />
      )}
      <Evidence value={value} />
    </section>
  );
}
function OccupationPage() {
  const { system, version, code } = useParams();
  const { f } = useAtlas();
  const [state, setState] = useState(
    new URLSearchParams(window.location.hash.split("?")[1]).get("state") ??
      "WA",
  );
  const search = useApi<Schema<"OccupationSummary">[]>(
    "/api/occupations/search",
    { q: code ?? "" },
  );
  const o = search.data?.data.find(
    (x) => x.system === system && x.version === version && x.code === code,
  );
  const q = useApi<Schema<"OccupationData">>(
    "/api/occupations/" + (o?.id ?? "unknown"),
    { state },
    Boolean(o),
  );
  const distribution = useApi<Schema<"DistributionData">>(
    "/api/occupations/" + (o?.id ?? "unknown") + "/distribution",
    { state },
    Boolean(o),
  );
  const trend = useApi<Schema<"TrendData">>(
    "/api/occupations/" + (o?.id ?? "unknown") + "/annual-trend",
    { state, metricType: "nomination_invitation_count" },
    Boolean(o),
  );
  const [showOld, setShowOld] = useState(false);
  const old = useApi<Schema<"OccupationData">>(
    "/api/occupations/" + (o?.id ?? "unknown"),
    { state, datasetVersion: "demo-v1" },
    Boolean(o && showOld && f.mode === "demo"),
  );
  useEffect(() => setShowOld(false), [f.mode, code, state]);
  return (
    <>
      <Link className="back" to="/occupations">
        ← 返回职业搜索
      </Link>
      <Title
        eyebrow={`${system} ${version} · ${code}`}
        title={o?.titleZh ?? "职业详情"}
        description={o?.title ?? "请核对职业名称、代码和分类版本。"}
      />
      <label className="state-select">
        州或领地
        <select value={state} onChange={(e) => setState(e.target.value)}>
          {geometry.states.map((s) => (
            <option key={s.code}>{s.code}</option>
          ))}
        </select>
      </label>
      {f.mode === "verified_historical" ? (
        <HistoryExplorer fixedState={state} occupationCode={code} />
      ) : (
        <Status query={search}>
          {!o ? (
            <Empty text="该职业代码和分类版本不在本目录中。" />
          ) : (
            <>
              <Status query={q}>
                <Meta value={q.data} />
                <section className="panel section-gap">
                  <h2>已录入历史观测</h2>
                  <Facts
                    items={q.data?.data.observations ?? []}
                    sources={q.data?.sources}
                  />
                  <p className="note">
                    每条记录保留范围与来源。分数不是获邀保证；记录数不是个人概率。
                  </p>
                  {f.mode === "demo" &&
                    code === "261313" &&
                    state === "WA" &&
                    f.visaSubclass === "190" && (
                      <>
                        <button
                          className="secondary"
                          onClick={() => setShowOld(!showOld)}
                        >
                          {showOld
                            ? "收起旧版"
                            : "检查修订前的 demo-v1（35 → 40）"}
                        </button>
                        {showOld && (
                          <Status query={old}>
                            <Meta value={old.data} />
                            <Facts
                              items={
                                old.data?.data.observations.filter(
                                  (f) =>
                                    f.metricType ===
                                      "nomination_invitation_count" &&
                                    f.eventDate,
                                ) ?? []
                              }
                            />
                          </Status>
                        )}
                      </>
                    )}
                  <Evidence value={q.data} />
                </section>
              </Status>
              <div className="two-cards section-gap">
                <Status query={distribution}>
                  <Distribution value={distribution.data} />
                </Status>
                <Status query={trend}>
                  <Trend value={trend.data} />
                </Status>
              </div>
            </>
          )}
        </Status>
      )}
    </>
  );
}
const examples = [
  "WA 190 2025-26 软件工程师的历史记录",
  "WA 190 2025-26 配额是多少",
];
function Questions() {
  const { f } = useAtlas();
  const [text, setText] = useState(examples[0]);
  const [parsed, setParsed] = useState<Env<Schema<"Interpretation">>>();
  const [answer, setAnswer] = useState<Env<Schema<"AnswerData">>>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [occ, setOcc] = useState("");
  const [state, setState] = useState("WA");
  const [visa, setVisa] = useState("190");
  const [year, setYear] = useState("2025-26");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    setParsed(undefined);
    setAnswer(undefined);
    setConfirmed(false);
    setError("");
  }, [f.mode]);
  async function interpret() {
    setBusy(true);
    setError("");
    setAnswer(undefined);
    setConfirmed(false);
    try {
      const p = await post<Env<Schema<"Interpretation">>>(
        "/api/query/interpret",
        { text, mode: f.mode, locale: offline() ? "zh" : f.locale },
      );
      setParsed(p);
      setOcc(
        p.data.occupationCandidates.length === 1
          ? p.data.occupationCandidates[0].id
          : "",
      );
      setState(
        p.data.stateCandidates.length === 1 ? p.data.stateCandidates[0] : "",
      );
      setVisa(p.data.visaSubclass ?? "");
      setYear(p.data.programYear ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function ask() {
    setBusy(true);
    setError("");
    try {
      setAnswer(
        await post<Env<Schema<"AnswerData">>>("/api/answers", {
          question: text,
          state,
          visaSubclass: visa,
          programYear: year,
          mode: f.mode,
          locale: offline() ? "zh" : f.locale,
          occupationId: occ || null,
          datasetVersion: null,
          confirmed,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        eyebrow="EVIDENCE FIRST · TEMPLATE ANSWERS"
        title="先把问题说具体。"
        description="无需模型密钥。规则先识别候选，你确认范围后，回答只引用已录入记录。"
      />
      {f.mode === "verified_historical" && (
        <div className="notice">
          确认职业问题后将打开对应的官方历史筛选。未拆分 190 / 491
          的原表单独保留；年度配额仍按官方配额表回答。也可以直接进入{" "}
          <Link to="/history">真实邀请档案 →</Link>。
        </div>
      )}
      {offline() && (
        <p className="notice">
          这份可携带预览支持两个已验证示例；自由提问需要运行本地 API。
        </p>
      )}
      <section className="panel">
        <label htmlFor="question">
          <h2>你想查看什么？</h2>
        </label>
        <textarea
          id="question"
          value={text}
          maxLength={1200}
          onChange={(e) => {
            setText(e.target.value);
            setParsed(undefined);
            setAnswer(undefined);
            setConfirmed(false);
          }}
          rows={3}
        />
        <div className="chips">
          {examples.map((s) => (
            <button
              key={s}
              onClick={() => {
                setText(s);
                setParsed(undefined);
                setAnswer(undefined);
                setConfirmed(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          className="primary"
          disabled={busy || !text.trim()}
          onClick={interpret}
        >
          1. 识别问题范围 <ChevronRight size={15} />
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      {parsed && (
        <section className="panel section-gap">
          <h2>2. 核对候选和查询条件</h2>
          <p className="note">
            {parsed.data.needsClarification
              ? "存在歧义或缺少条件，请选择并补全。"
              : "已找到候选，仍需你确认。"}
          </p>
          <div className="confirm-grid">
            {parsed.data.intent !== "allocation" && (
              <label>
                职业与分类版本
                <select
                  value={occ}
                  onChange={(e) => {
                    setOcc(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  <option value="">请选择候选</option>
                  {parsed.data.occupationCandidates.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.titleZh} · {o.code} · {o.system} {o.version}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              州或领地
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="">请选择</option>
                {geometry.states.map((s) => (
                  <option key={s.code}>{s.code}</option>
                ))}
              </select>
            </label>
            <label>
              州提名签证
              <select
                value={visa}
                onChange={(e) => {
                  setVisa(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="">请选择</option>
                <option>190</option>
                <option>491</option>
              </select>
            </label>
            <label>
              项目年度
              <input
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setConfirmed(false);
                }}
                placeholder="2025-26"
              />
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            我已核对职业、分类版本和查询范围。
          </label>
          <button
            className="primary"
            disabled={
              !confirmed ||
              busy ||
              !state ||
              !visa ||
              !year ||
              (parsed.data.intent !== "allocation" && !occ)
            }
            onClick={ask}
          >
            3. 读取历史记录 <Check size={16} />
          </button>
          <Evidence value={parsed} />
        </section>
      )}
      {answer && f.mode === "verified_historical" && occ ? (
        <>
          <p className="notice">
            已确认 {state} / {visa} / {year}
            。下表按此范围读取；可以调整年度或签证筛选查看其他原表。跨范围记录不能当作当前范围的结果。
          </p>
          <HistoryExplorer
            key={`${state}-${visa}-${year}-${occ}`}
            fixedState={state}
            occupationCode={
              parsed?.data.occupationCandidates.find((c) => c.id === occ)?.code
            }
            initialYear={year}
            initialVisa={visa}
          />
        </>
      ) : (
        answer && (
          <section className="panel section-gap">
            <h2>模板回答</h2>
            <Meta value={answer} />
            <p className="answer-summary">{answer.data.summary}</p>
            <Facts items={answer.data.facts} sources={answer.sources} />
            {answer.data.limitations.map((l) => (
              <p className="note" key={l}>
                {l}
              </p>
            ))}
            <Evidence value={answer} />
          </section>
        )
      )}
    </>
  );
}
function Coverage() {
  const { f, setF } = useAtlas();
  return (
    <>
      <Title
        eyebrow="DATA COVERAGE"
        title="覆盖到哪里，证据就写到哪里。"
        description="八个州及领地均保留检索结果。已录入、未公布和暂未找到分别说明。"
      />
      {f.mode === "verified_historical" ? (
        <OfficialCoverage />
      ) : (
        <div className="empty">
          <p>Demo 的全部分数和人数为合成样本。官方资料覆盖请切换至真实历史。</p>
          <button
            className="primary"
            onClick={() => setF({ ...f, mode: "verified_historical" })}
          >
            切换到真实历史
          </button>
        </div>
      )}
    </>
  );
}
function SourceDialog({
  citation,
  onClose,
}: {
  citation: Schema<"Citation">;
  onClose: () => void;
}) {
  const q = useApi<Schema<"SourceData">>(
    `/api/sources/${citation.sourceId}/versions/${citation.sourceVersionId}`,
  );
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  const s = q.data?.data;
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>来源与版本</h2>
        <button onClick={onClose} aria-label="关闭来源详情">
          <X />
        </button>
      </div>
      <Status query={q}>
        {s && (
          <>
            <Meta value={q.data} />
            <h3>{s.title}</h3>
            <dl>
              <dt>发布机构</dt>
              <dd>{s.publisher}</dd>
              <dt>来源 ID</dt>
              <dd>{s.sourceId}</dd>
              <dt>证据版本 ID</dt>
              <dd className="hash">{s.sourceVersionId}</dd>
              <dt>发布时间</dt>
              <dd>{date(s.publishedAt)}</dd>
              <dt>生效日期</dt>
              <dd>{date(s.effectiveDate)}</dd>
              <dt>配额确定日期</dt>
              <dd>{date(s.decisionDate)}</dd>
              <dt>检索时间 UTC</dt>
              <dd>{s.retrievedAt}</dd>
              <dt>保留范围</dt>
              <dd>{s.snapshotScope}</dd>
              <dt>SHA-256</dt>
              <dd className="hash">{s.hash}</dd>
              <dt>数据版本成员</dt>
              <dd>{s.datasetVersions.join(", ")}</dd>
              <dt>许可</dt>
              <dd>{s.license}</dd>
            </dl>
            <p className="note">{s.reviewNote}</p>
            {s.url ? (
              <a
                className="primary"
                href={s.url}
                target="_blank"
                rel="noreferrer"
              >
                打开官方来源 <ExternalLink size={15} />
              </a>
            ) : (
              <p className="notice">合成数据没有官方来源链接。</p>
            )}
          </>
        )}
      </Status>
    </dialog>
  );
}
export default function App() {
  const [f, setF] = useState<Filters>({
    mode: "verified_historical",
    programYear: "2025-26",
    visaSubclass: "190",
    sponsorshipType: "state",
    locale: "zh",
  });
  const [citation, setCitation] = useState<Schema<"Citation">>();
  const [menu, setMenu] = useState(false);
  const en = f.locale === "en";
  const showLegacyFilters = f.mode === "demo";
  return (
    <Context.Provider value={{ f, setF, source: setCitation }}>
      <a className="skip" href="#main">
        跳到正文
      </a>
      <div className="app-shell">
        <header>
          <Link to="/" className="brand">
            <span>
              <MapPin size={19} />
            </span>
            Nomination Atlas<small>澳洲州提名历史</small>
          </Link>
          <button
            className="menu-toggle"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
          >
            菜单
          </button>
          <nav className={menu ? "open" : ""} aria-label="主导航">
            <NavLink to="/" end onClick={() => setMenu(false)}>
              {en ? "Overview" : "地图选州"}
            </NavLink>
            <NavLink to="/history" onClick={() => setMenu(false)}>
              {en ? "Invitation archive" : "真实邀请档案"}
            </NavLink>
            <NavLink to="/occupations" onClick={() => setMenu(false)}>
              {en ? "Occupations" : "职业查询"}
            </NavLink>
            <NavLink to="/questions" onClick={() => setMenu(false)}>
              {en ? "Questions" : "历史问答"}
            </NavLink>
            <NavLink to="/coverage" onClick={() => setMenu(false)}>
              {en ? "Coverage" : "数据覆盖"}
            </NavLink>
          </nav>
          <button
            className="language"
            onClick={() => setF({ ...f, locale: en ? "zh" : "en" })}
          >
            {en ? "中文" : "EN"}
          </button>
        </header>
        <div className="filter-bar">
          <div className="mode-switch" aria-label="数据模式">
            <button
              aria-pressed={f.mode === "verified_historical"}
              className={f.mode === "verified_historical" ? "active" : ""}
              onClick={() => {
                setF({ ...f, mode: "verified_historical" });
                setCitation(undefined);
              }}
            >
              <ShieldCheck size={14} />
              {en ? "Verified history" : "真实历史"}
            </button>
            <button
              aria-pressed={f.mode === "demo"}
              className={f.mode === "demo" ? "active demo" : ""}
              onClick={() => {
                setF({ ...f, mode: "demo" });
                setCitation(undefined);
              }}
            >
              Demo
            </button>
          </div>
          {showLegacyFilters && (
            <>
              <label>
                {en ? "Allocation / demo year" : "配额 / 演示年度"}
                <select
                  value={f.programYear}
                  onChange={(e) => setF({ ...f, programYear: e.target.value })}
                >
                  <option>2025-26</option>
                  {!offline() &&
                    ["2023-24", "2024-25", "2026-27"].map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                </select>
              </label>
              <label>
                {en ? "Allocation / demo visa" : "配额 / 演示签证"}
                <select
                  value={f.visaSubclass}
                  onChange={(e) => setF({ ...f, visaSubclass: e.target.value })}
                >
                  <option>190</option>
                  <option>491</option>
                </select>
              </label>
            </>
          )}
          <span className="local-tag">
            {offline() ? "可携带预览 · 官方证据已内置" : "本地只读服务"} · v0.5
          </span>
        </div>
        {f.mode === "demo" && (
          <div className="demo-banner">
            DEMO · 合成数据仅用于体验和测试，不能作为真实移民历史或申请依据。
          </div>
        )}
        <main id="main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/states/:code" element={<StatePage />} />
            <Route
              path="/history"
              element={
                <HistoryPage
                  demo={f.mode === "demo"}
                  onReal={() => setF({ ...f, mode: "verified_historical" })}
                />
              }
            />
            <Route path="/occupations" element={<Occupations />} />
            <Route
              path="/occupations/:system/:version/:code"
              element={<OccupationPage />}
            />
            <Route path="/questions" element={<Questions />} />
            <Route path="/coverage" element={<Coverage />} />
            <Route
              path="*"
              element={<Empty text="页面不存在。请返回地图选择一个州。" />}
            />
          </Routes>
        </main>
        <footer>
          <span>Nomination Atlas · Reference prototype</span>
          <p>
            历史数据工具；不预测个人获邀概率。
            <br />
            地图：Natural Earth · Public domain
          </p>
          <Link to="/coverage">
            查看数据边界 <ArrowUpRight size={13} />
          </Link>
        </footer>
      </div>
      {citation && (
        <SourceDialog
          citation={citation}
          onClose={() => setCitation(undefined)}
        />
      )}
    </Context.Provider>
  );
}
