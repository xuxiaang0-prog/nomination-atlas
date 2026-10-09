import type { components } from "./generated/api";
export type Schema<K extends keyof components["schemas"]> =
  components["schemas"][K];
export type Env<T> = {
  data: T;
  meta: Schema<"Meta">;
  sources: Schema<"Citation">[];
  warnings: string[];
};
export type Filters = {
  mode: "verified_historical" | "demo";
  programYear: string;
  visaSubclass: string;
  sponsorshipType: "state";
  locale: "zh" | "en";
};
type Snapshot = {
  get: Record<string, unknown>;
  interpret: Record<string, unknown>;
  answers: Record<string, unknown>;
  occupations: Schema<"OccupationSummary">[];
  officialHistory?: import("./history-data").HistoryData;
};
declare global {
  interface Window {
    ATLAS_SNAPSHOT?: Snapshot;
  }
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const offline = () => Boolean(window.ATLAS_SNAPSHOT);
export function url(
  path: string,
  filters: Filters,
  extra: Record<string, string> = {},
) {
  const values = { ...filters, ...extra };
  const params = new URLSearchParams(
    Object.entries(values).sort(([a], [b]) => a.localeCompare(b)),
  );
  return path + "?" + params.toString().replace(/\+/g, "%20");
}
export function cacheKey(
  path: string,
  f: Filters,
  e: Record<string, string> = {},
) {
  return ["evidence", url(path, f, e), offline()];
}
export async function get<T>(
  path: string,
  filters: Filters,
  extra: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const endpoint = url(path, filters, extra);
  const snapshot = window.ATLAS_SNAPSHOT;
  if (snapshot) {
    const key = url(path, { ...filters, locale: "zh" }, extra);
    const data = snapshot.get[key];
    if (data !== undefined) return structuredClone(data) as T;
    if (path === "/api/occupations/search") {
      const q = (extra.q ?? "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
      const items = snapshot.occupations.filter(
        (o) =>
          [o.code, o.title, o.titleZh].some((s) =>
            s
              .toLowerCase()
              .replace(/[\s\p{P}\p{S}]/gu, "")
              .includes(q),
          ) ||
          (q === "tiler" && o.code === "333411") ||
          (q === "程序员" && o.code.startsWith("2613")),
      );
      const shell = snapshot.get[
        url("/api/states", { ...filters, locale: "zh" })
      ] as Env<unknown>;
      return { ...structuredClone(shell), data: items } as T;
    }
    throw new ApiError(
      422,
      "OFFLINE_SCOPE_UNAVAILABLE",
      "这份离线预览未导出该范围。运行源码中的本地服务后可查询完整 API。",
    );
  }
  const response = await fetch(endpoint, { signal });
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      body.code ?? "REQUEST_FAILED",
      body.title ?? "Request failed",
    );
  return body;
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
      .join(",") +
    "}"
  );
}
export async function post<T>(path: string, body: unknown): Promise<T> {
  if (window.ATLAS_SNAPSHOT) {
    const collection =
      path === "/api/query/interpret"
        ? window.ATLAS_SNAPSHOT.interpret
        : window.ATLAS_SNAPSHOT.answers;
    const data = Object.entries(collection).find(
      ([k]) => canonical(JSON.parse(k)) === canonical(body),
    )?.[1];
    if (data) return structuredClone(data) as T;
    throw new ApiError(
      422,
      "OFFLINE_QUESTION_UNAVAILABLE",
      "离线预览支持下面两个已验证的示例问题；自由输入请运行本地 API。",
    );
  }
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok)
    throw new ApiError(
      r.status,
      j.code ?? "REQUEST_FAILED",
      j.title ?? "Request failed",
    );
  return j;
}
