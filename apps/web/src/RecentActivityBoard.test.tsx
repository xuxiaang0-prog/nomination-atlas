import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { activityCount, activityOccupations, recentDatasets, RecentActivityBoard, sortActivityOccupations } from "./RecentActivityBoard";
import type { HistoryData } from "./history-data";
const data: HistoryData = JSON.parse(readFileSync(path.resolve(import.meta.dirname,"../../../data/official/history.json"),"utf8"));
beforeEach(() => {});
afterEach(cleanup);

describe("current official occupation evidence", () => {
  it.each(["NSW","VIC","WA","SA","TAS","ACT","NT","QLD"])("%s defaults to 2026 evidence and offers full-year application activity", state => {
    const sets=recentDatasets(data,state);
    expect(sets[0].asOf).toBe("2026-06-30");
    expect(sets.some(s=>s.asOf==="2026-09-30")).toBe(true);
    expect(sets.some(s=>s.metric==="visa_lodged_primary" && s.periodEnd==="2026-06-30")).toBe(true);
  });
  it("NSW teacher count uses independently published totals while the score bands stay masked", () => {
    const ds=data.recentActivity!.datasets.find(d=>d.asOf==="2026-06-30")!;
    const records=data.recentActivity!.records.filter(r=>r.state==="NSW" && r.datasetId===ds.id && r.occupationCode==="241411");
    expect(activityCount(records,"190")).toBeNull();
    const occupation=activityOccupations(records,"190",ds.occupationTotals)[0];
    expect(occupation.count190).toBe(57);
    expect(records.find(r=>r.visaSubclass==="190"&&r.points===85)?.count).toBe(34);
    expect(records.some(r=>r.countDisplay==="<20"&&r.count===null)).toBe(true);
  });
  it("point ranking keeps 190 and 491 scores separate, and does not add two snapshots", () => {
    const base=data.recentActivity!.records.find(r=>r.count===null)!;
    const rs=[{...base,id:"a",visaSubclass:"190" as const,points:90,count:30,countStatus:"published"},{...base,id:"b",visaSubclass:"491" as const,points:65,count:24,countStatus:"published"}];
    expect(activityOccupations(rs,"190")[0].low).toBe(90);
    expect(activityOccupations(rs,"491")[0].low).toBe(65);
    expect(activityCount([rs[0],{...rs[0],id:"c",datasetId:"different-month"}],"190")).toBeNull();
    const rows=activityOccupations([{...rs[0],occupationCode:"261313"},{...rs[0],occupationCode:"241411",points:75},{...rs[0],occupationCode:"272511",points:null}],"190");
    expect(sortActivityOccupations(rows,"pointsAsc").map(r=>r.low)).toEqual([75,90,null]);
  });
  it("current detail exposes the exact 85-point teacher band and the snapshot definition", () => {
    render(<RecentActivityBoard data={data} state="NSW"/>);
    const board=screen.getByRole("region",{name:"NSW 近期职业数据"});
    expect(board).toHaveTextContent("2026-06-30");
    expect(board).toHaveTextContent("不一定等于获邀时分数");
    fireEvent.change(within(board).getByLabelText("职业名称 / ANZSCO"),{target:{value:"241411"}});
    const row=within(board).getByText("中学教师").closest("tr")!;
    expect(within(row).getAllByRole("cell")[2]).toHaveTextContent("57");
    fireEvent.click(within(board).getByRole("button",{name:"查看 241411 近期统计明细"}));
    const detail=within(board).getAllByRole("table")[1];
    const band=within(detail).getAllByRole("row").find(r=>within(r).queryAllByRole("cell")[0]?.textContent==="190"&&within(r).queryAllByRole("cell")[1]?.textContent==="85")!;
    expect(within(band).getAllByRole("cell")[2]).toHaveTextContent("34");
    expect(detail).toHaveTextContent("<20");
  });
  it("full-year primary applications are labeled as applications, never as invitation counts or score thresholds", () => {
    render(<RecentActivityBoard data={data} state="VIC"/>);
    const ds=data.recentActivity!.datasets.find(d=>d.metric==="visa_lodged_primary")!;
    fireEvent.change(screen.getByLabelText("近期职业资料集"),{target:{value:ds.id}});
    const board=screen.getByRole("region",{name:"VIC 近期职业数据"});
    expect(board).toHaveTextContent("190 个具体职业");
    expect(board).toHaveTextContent("2025-07-01 — 2026-06-30");
    expect(board).toHaveTextContent("主申请份数");
    expect(board).toHaveTextContent("原表没有分数字段");
    expect(within(board).getByRole("button",{name:"分数从高到低"})).toBeDisabled();
    expect(within(board).queryByRole("columnheader",{name:"190 邀请数"})).not.toBeInTheDocument();
  });
  it("September hidden amounts retain <20 and do not reuse June totals", () => {
    render(<RecentActivityBoard data={data} state="NSW"/>);
    const ds=data.recentActivity!.datasets.find(d=>d.asOf==="2026-09-30")!;
    fireEvent.change(screen.getByLabelText("近期职业资料集"),{target:{value:ds.id}});
    const board=screen.getByRole("region",{name:"NSW 近期职业数据"});
    expect(board).toHaveTextContent("2026-09-30");
    expect(board).toHaveTextContent("5 个具体职业");
    expect(within(board).getByRole("table")).toHaveTextContent("<20");
  });
});
