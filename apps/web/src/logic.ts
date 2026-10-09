export const metricNames: Record<string, string> = {
  nomination_allocation: "州提名配额",
  nomination_invitation_count: "州提名邀请记录数",
  visa_invitation_count: "签证邀请记录数",
  eoi_stock_count: "EOI 池存量",
  last_invited_eoi_points: "已公布末位 EOI 分数",
};
export const statusNames: Record<string, string> = {
  available: "已录入",
  not_published: "未公布",
  not_ingested: "未录入",
  suppressed: "已隐去",
  not_applicable: "不适用",
  parse_failed: "解析失败",
  source_unavailable: "来源不可用",
  incomplete: "数据不完整",
  allocations_only: "仅有配额",
  synthetic: "演示样本",
  partial: "部分覆盖",
  catalog_only: "职业目录",
  interpretation_only: "仅解释查询范围",
  source_record: "来源记录",
};
export function display(value: number | string | null | undefined) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("en-AU").format(Number(value));
}
export function date(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "未注明";
}
export function scoreDescription(metric: string) {
  return metric === "last_invited_eoi_points"
    ? "历史末位记录，不是保证获邀的门槛。"
    : "记录数不等于获签人数。";
}
