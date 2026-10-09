import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import App, { AustraliaMap } from "./App";
import { cacheKey, get, post, type Filters } from "./api";
import { date, display } from "./logic";
import {
  exactCount,
  occupationRows,
  rankingDatasets,
  sortOccupationRows,
} from "./OccupationBoard";
import map from "./australia-map.json";
const snapshot = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../artifacts/snapshot.json"),
    "utf8",
  ),
);
const filters: Filters = {
  mode: "verified_historical",
  programYear: "2025-26",
  visaSubclass: "190",
  sponsorshipType: "state",
  locale: "zh",
};
function app(route = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  window.ATLAS_SNAPSHOT = structuredClone(snapshot);
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});
afterEach(() => {
  cleanup();
  delete window.ATLAS_SNAPSHOT;
});
describe("data meaning and isolation", () => {
  it("preserves missing separately from observed zero", () => {
    expect(display(null)).toBe("—");
    expect(display(0)).toBe("0");
    expect(display("2100")).toBe("2,100");
  });
  it("unknown publication date is not retrieval date", () =>
    expect(date(null)).toBe("未注明"));
  it.each(["mode", "programYear", "visaSubclass", "locale"])(
    "cache includes %s",
    (key) => {
      const change = {
        mode: "demo",
        programYear: "2024-25",
        visaSubclass: "491",
        locale: "en",
      };
      expect(cacheKey("/api/states", filters)).not.toEqual(
        cacheKey("/api/states", {
          ...filters,
          [key]: change[key as keyof typeof change],
        } as Filters),
      );
    },
  );
  it("cache includes exact release and comparable round", () => {
    expect(
      cacheKey("/api/states", filters, { datasetVersion: "demo-v1" }),
    ).not.toEqual(
      cacheKey("/api/states", filters, { datasetVersion: "demo-v2" }),
    );
    expect(cacheKey("/api/states", filters, { roundId: "a" })).not.toEqual(
      cacheKey("/api/states", filters, { roundId: "b" }),
    );
  });
  it("offline snapshot remains separated by mode", async () => {
    const a = await get<{
      meta: { isDemo: boolean };
      data: { items: { allocation190: number | null }[] };
    }>("/api/states", filters);
    const b = await get<typeof a>("/api/states", { ...filters, mode: "demo" });
    expect(a.meta.isDemo).toBe(false);
    expect(b.meta.isDemo).toBe(true);
    expect(b.data.items.every((s) => s.allocation190 === null)).toBe(true);
  });
  it("offline arbitrary questions are explicitly unavailable", async () => {
    await expect(
      post("/api/query/interpret", {
        text: "arbitrary",
        mode: "demo",
        locale: "zh",
      }),
    ).rejects.toThrow("离线预览");
  });
});
describe("map navigation", () => {
  it("eight geographic regions, with NSW ACT hole", () => {
    expect(map.states).toHaveLength(8);
    expect(map.states.find((s) => s.code === "NSW")?.holeCount).toBe(1);
  });
  it("geographic paths support keyboard selection", () => {
    const choose = vi.fn();
    render(<AustraliaMap onSelect={choose} />);
    const wa = screen.getByRole("button", { name: "Western Australia WA" });
    fireEvent.keyDown(wa, { key: "Enter" });
    fireEvent.keyDown(wa, { key: " " });
    expect(choose.mock.calls).toEqual([["WA"], ["WA"]]);
  });
  it("ACT has an enlarged keyboard and click target", () => {
    const choose = vi.fn();
    render(<AustraliaMap onSelect={choose} />);
    const act = screen.getByRole("button", {
      name: "选择首都领地 ACT（放大点击区域）",
    });
    fireEvent.click(act);
    fireEvent.keyDown(act, { key: "Enter" });
    expect(choose.mock.calls).toEqual([["ACT"], ["ACT"]]);
  });
  it("uses evenodd fill so ACT is not painted as NSW", () => {
    render(<AustraliaMap onSelect={() => {}} />);
    expect(
      screen.getByRole("button", { name: "New South Wales NSW" }),
    ).toHaveAttribute("fill-rule", "evenodd");
  });
  it("equivalent text list exposes all eight regions", async () => {
    app();
    fireEvent.click(screen.getByRole("button", { name: "Demo" }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("region", { name: "与地图等价的州及领地列表" })
          .querySelectorAll("button"),
      ).toHaveLength(8),
    );
  });
});
describe("review workflow", () => {
  it("real home opens with the eight-state map and navigates to complete NSW occupations", async () => {
    app();
    await screen.findByRole("button", { name: "New South Wales NSW" });
    fireEvent.click(
      screen.getByRole("button", { name: "New South Wales NSW" }),
    );
    const panel = screen.getByRole("region", { name: "所选州真实结果" });
    expect(panel).toHaveTextContent("120");
    expect(panel).toHaveTextContent("2026-06-30");
    expect(panel).not.toHaveTextContent("2019");
    fireEvent.click(within(panel).getByRole("link", { name: /完整职业榜/ }));
    expect(
      await screen.findByRole("region", { name: "NSW 近期职业数据" }),
    ).toHaveTextContent("120 个具体职业");
  });
  it("changing mode clears real nomination totals from the map card", async () => {
    app();
    await screen.findByRole("button", { name: "New South Wales NSW" });
    fireEvent.click(
      screen.getByRole("button", { name: "New South Wales NSW" }),
    );
    expect(
      screen.getByRole("region", { name: "所选州真实结果" }),
    ).toHaveTextContent("815");
    fireEvent.click(screen.getByRole("button", { name: "Demo" }));
    expect(
      screen.queryByRole("region", { name: "所选州真实结果" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/DEMO · 合成数据仅/)).toBeInTheDocument();
  });
  it("occupation round is held until user confirms scope", async () => {
    app("/states/WA");
    fireEvent.click(screen.getByRole("button", { name: "Demo" }));
    expect(
      await screen.findByText("确认一个轮次和范围后，才显示可比较的排名。"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("先确认可比较范围"), {
      target: {
        value:
          snapshot.get[
            Object.keys(snapshot.get).find(
              (k) =>
                k.startsWith("/api/states/WA/overview?") &&
                k.includes("mode=demo") &&
                k.includes("visaSubclass=190"),
            )!
          ].data.scopes[0].id,
      },
    });
    expect(
      await screen.findByRole("link", { name: /瓷砖工/ }),
    ).toBeInTheDocument();
  });
  it("occupation search returns code and version before opening detail", async () => {
    app("/occupations");
    fireEvent.click(screen.getByRole("button", { name: "Demo" }));
    expect(await screen.findByText("ANZSCO 2022 · 261313")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /软件工程师/ })).toHaveAttribute(
      "href",
      "/occupations/ANZSCO/2022/261313",
    );
  });
  it("occupation detail opens the actual source and its full checksum", async () => {
    app("/states/NSW");
    fireEvent.click(await screen.findByRole("tab", {name:"历史档案"}));
    const board = await screen.findByRole("region", { name: "NSW 全职业榜" });
    fireEvent.change(within(board).getByLabelText("职业名称 / ANZSCO"), {
      target: { value: "261313" },
    });
    fireEvent.click(
      within(board).getByRole("button", { name: "查看 261313 分数和人数明细" }),
    );
    fireEvent.click(
      within(board).getAllByRole("button", { name: /^核对 / })[0],
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("分组计数");
    expect(
      within(dialog).getByText("SHA-256").nextElementSibling?.textContent,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(
      within(dialog).getByRole("link", { name: /打开官方原文/ }),
    ).toHaveAttribute("href", expect.stringContaining("fa-191201127"));
  });
  it("template question requires a confirmation checkbox", async () => {
    app("/questions");
    fireEvent.click(screen.getByRole("button", { name: /1. 识别问题范围/ }));
    const ask = await screen.findByRole("button", { name: /3. 读取历史记录/ });
    expect(ask).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(ask).toBeEnabled();
    fireEvent.click(ask);
    expect(
      await screen.findByText("这个范围没有已录入的记录"),
    ).toBeInTheDocument();
  });
});

describe("official invitation archive", () => {
  it("opens actual Analyst Programmer scores with missing counts and an unsplit visa scope", async () => {
    app("/history?state=WA&q=261311&year=2024-25");
    expect(await screen.findByText("3 条")).toBeInTheDocument();
    expect(
      screen.getAllByRole("cell", { name: /190 \/ 491 未拆分/ }),
    ).toHaveLength(3);
    expect(screen.getAllByText("未公布")).toHaveLength(3);
    expect(screen.getByText("程序分析员是什么？")).toBeInTheDocument();
    expect(screen.getByRole("table").textContent).toContain("105");
    expect(screen.getByRole("table").textContent).not.toContain("75");
  });
  it("does not assign combined WA occupation profiles to a selected 190 visa", async () => {
    app("/history?state=WA&q=261311&year=2024-25");
    await screen.findByText("3 条");
    fireEvent.change(screen.getByLabelText("历史签证范围"), {
      target: { value: "190" },
    });
    expect(await screen.findByText("0 条")).toBeInTheDocument();
    expect(screen.getByText(/WA 职业末位 EOI 表没有拆分/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("SA group counts cannot masquerade as Analyst Programmer counts", async () => {
    app("/history?state=SA&q=261311&year=2025-26");
    await screen.findByText("0 条");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(await screen.findByRole("table")).toHaveTextContent(
      "2 位职业子大类",
    );
    expect(screen.getAllByText("非具体职业人数").length).toBeGreaterThan(0);
    expect(screen.getByRole("table")).toHaveTextContent("ICT Professionals");
  });
  it("keeps Tasmania priority points above 200 and explicit round totals together", async () => {
    app("/history?state=TAS&year=2026-27");
    await screen.findByText("6 条");
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("323");
    expect(table).toHaveTextContent("37");
    expect(table).toHaveTextContent("塔州优先属性分数");
    expect(table).toHaveTextContent("全州全职业 · 本轮人数");
  });
  it("surfaces source conflicts without presenting the disputed number as a clean count", async () => {
    app("/history?state=WA&year=2025-26");
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("记录筛选"), {
      target: { value: "issues" },
    });
    await screen.findByText("2 条");
    expect(screen.getAllByText("来源冲突")).toHaveLength(2);
    expect(screen.getByRole("table")).not.toHaveTextContent("37份");
  });
  it("opens the exact official source, locator and checksum for a historical row", async () => {
    app("/history?state=WA&q=261311&year=2024-25");
    await screen.findByText("3 条");
    fireEvent.click(
      screen.getAllByRole("button", { name: /^查看 wa-profile/ })[0],
    );
    expect(await screen.findByText("原始证据与统计口径")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /打开官方原文/ })).toHaveAttribute(
      "href",
      expect.stringContaining("migration.wa.gov.au"),
    );
    expect(screen.getByText("原表定位")).toBeInTheDocument();
    expect(screen.getByText("SHA-256").nextElementSibling?.textContent).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
  it("requires leaving Demo mode before displaying real archive rows", async () => {
    app("/history?state=WA&q=261311&year=2024-25");
    await screen.findByText("3 条");
    fireEvent.click(screen.getByRole("button", { name: "Demo" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "切换到真实历史" }));
    expect(await screen.findByText("3 条")).toBeInTheDocument();
  });
});

describe("map and full occupation discovery", () => {
  it.each(["WA", "NSW", "VIC", "QLD", "SA", "TAS", "ACT", "NT"])(
    "%s has the same occupation board entry point",
    async (state) => {
      app("/states/" + state);
      const board = await screen.findByRole("region", {
        name: state + " 近期职业数据",
      });
      expect(within(board).getByRole("table")).toBeInTheDocument();
      expect(within(board).getByLabelText("近期职业排列方式")).toBeInTheDocument();
      expect(
        screen
          .getByRole("navigation", { name: "切换州职业榜" })
          .querySelectorAll("a"),
      ).toHaveLength(8);
    },
  );
  it("WA exposes all 181 recorded occupations, with pharmacists and teachers searchable", async () => {
    app("/states/WA");
    fireEvent.click(await screen.findByRole("tab", {name:"州邀请披露"}));
    const board = await screen.findByRole("region", { name: "WA 全职业榜" });
    expect(board).toHaveTextContent("181 个具体职业");
    const search = within(board).getByLabelText("职业名称 / ANZSCO");
    fireEvent.change(search, { target: { value: "药剂师" } });
    expect(within(board).getByRole("table")).toHaveTextContent("医院药剂师");
    expect(within(board).getByRole("table")).toHaveTextContent("零售药剂师");
    fireEvent.change(search, { target: { value: "教师" } });
    expect(within(board).getByRole("table")).toHaveTextContent("幼儿教师");
    expect(within(board).getByRole("table")).toHaveTextContent("职业教育教师");
  });
  it("score sorting changes high-to-low and low-to-high while null remains last", async () => {
    app("/states/WA");
    fireEvent.click(await screen.findByRole("tab", {name:"州邀请披露"}));
    const board = await screen.findByRole("region", { name: "WA 全职业榜" });
    const values = () =>
      within(within(board).getByRole("table"))
        .getAllByRole("row")
        .slice(1)
        .map((r) =>
          parseInt(within(r).getAllByRole("cell")[1].textContent ?? ""),
        );
    const desc = values();
    expect(desc.every((n, i) => i === 0 || desc[i - 1] >= n)).toBe(true);
    fireEvent.click(
      within(board).getByRole("button", { name: "从低分端探索" }),
    );
    const asc = values();
    expect(asc.every((n, i) => i === 0 || asc[i - 1] <= n)).toBe(true);
    expect(asc[0]).toBeLessThan(desc[0]);
  });
  it("NSW FOI shows 2019 clearly, exact occupation count and count per score band", async () => {
    app("/states/NSW");
    fireEvent.click(await screen.findByRole("tab", {name:"历史档案"}));
    const board = await screen.findByRole("region", { name: "NSW 全职业榜" });
    expect(board).toHaveTextContent("旧年 FOI 历史档案");
    expect(board).toHaveTextContent("2019-");
    expect(board).toHaveTextContent("签证申请邀请");
    fireEvent.change(within(board).getByLabelText("职业名称 / ANZSCO"), {
      target: { value: "261313" },
    });
    const table = within(board).getByRole("table");
    expect(table).toHaveTextContent("70–95");
    expect(table).toHaveTextContent("388");
    fireEvent.click(
      within(board).getByRole("button", { name: "查看 261313 分数和人数明细" }),
    );
    const bands = within(board).getByRole("region", {
      name: "该职业分数与邀请数量分档",
    });
    expect(within(bands).getByText("70 分").parentElement).toHaveTextContent(
      "3条邀请",
    );
    fireEvent.change(within(board).getByLabelText("职业名称 / ANZSCO"), {
      target: { value: "211213" },
    });
    expect(within(board).getByRole("table")).toHaveTextContent("器乐演奏家");
  });
  it("SA keeps all 17 current groups, observed zero and classification separate", async () => {
    app("/states/SA");
    fireEvent.click(await screen.findByRole("tab", {name:"州邀请披露"}));
    const board = await screen.findByRole("region", { name: "SA 全职业榜" });
    expect(board).toHaveTextContent("17 个职业组");
    expect(
      within(board).getByRole("button", { name: "分数从高到低" }),
    ).toBeDisabled();
    const table = within(board).getByRole("table");
    const health = within(table).getByText("医疗卫生专业人员").closest("tr")!;
    expect(
      within(health)
        .getAllByRole("cell")
        .map((c) => c.textContent)
        .slice(2, 4),
    ).toEqual(["59", "7"]);
    const ict = within(table).getByText("ICT专业人员").closest("tr")!;
    expect(
      within(ict)
        .getAllByRole("cell")
        .map((c) => c.textContent)
        .slice(2, 4),
    ).toEqual(["0", "6"]);
    fireEvent.click(
      within(board).getByRole("button", { name: "查看 25 分数和人数明细" }),
    );
    expect(board).toHaveTextContent("不代表该轮职业获邀名单");
    fireEvent.click(screen.getByRole("tab", {name:"历史档案"}));
    const archive = screen.getByRole("region", {name:"SA 全职业榜"});
    expect(archive).toHaveTextContent("旧年 FOI 历史档案");
    expect(archive).toHaveTextContent("6 位具体职业");
  });
  it("occupation summaries do not double count overlapping sources or include pathway totals", () => {
    const source = snapshot.officialHistory.records.filter(
      (r: any) =>
        r.sourceId === "nsw-foi-fa191201127" && r.occupationCode === "261313",
    );
    const row = occupationRows(source)[0];
    expect(row.count190).toBe(388);
    expect(row.low).toBe(70);
    expect(row.high).toBe(95);
    expect(
      exactCount(
        [
          ...source,
          { ...source[0], id: "cross-check", sourceId: "overlapping-source" },
        ],
        "190",
      ),
    ).toBeNull();
    expect(
      occupationRows([
        { ...source[0], occupationCode: null, occupationLevel: "all" },
      ]),
    ).toHaveLength(0);
    const missing = { ...row, code: "missing", low: null };
    expect(sortOccupationRows([missing, row], "pointsAsc").at(-1)?.code).toBe(
      "missing",
    );
    expect(
      rankingDatasets(snapshot.officialHistory, "VIC")[0].rows.every(
        (r) => r.visaSubclass === "190",
      ),
    ).toBe(true);
  });
});
