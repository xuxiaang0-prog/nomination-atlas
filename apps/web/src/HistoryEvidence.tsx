import { useEffect, useRef } from "react";
import { X, ArrowUpRight } from "lucide-react";
import {
  basisNames,
  countScopeNames,
  type HistoryRecord,
  type HistorySource,
} from "./history-data";

export function RecordDialog({
  record: r,
  source: s,
  onClose,
}: {
  record: HistoryRecord;
  source?: HistorySource;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="history-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>原始证据与统计口径</h2>
        <button aria-label="关闭原始证据" onClick={onClose}>
          <X />
        </button>
      </div>
      <span className="badge verified">官方来源 · {r.state}</span>
      <h3>{r.occupationTitle}</h3>
      <p className="record-note">{r.note}</p>
      <dl>
        <dt>原表定位</dt>
        <dd>{r.locator}</dd>
        <dt>分数体系</dt>
        <dd>{basisNames[r.pointsBasis] ?? r.pointsBasis}</dd>
        <dt>邀请阶段</dt>
        <dd>
          {r.invitationStage === "visa_application_after_nomination"
            ? "获州提名后，SkillSelect 签证申请邀请（非获签）"
            : "州提名申请邀请 / 原表所示阶段"}
        </dd>
        <dt>数量生成方式</dt>
        <dd>
          {r.countMethod === "derived_from_official_rows"
            ? "由单份官方公开逐 EOI 行分组计数；不代表去重人数"
            : "原表公布值；未公布不作推算"}
        </dd>
        <dt>人数范围</dt>
        <dd>{countScopeNames[r.countScope] ?? r.countScope}</dd>
        <dt>轮次</dt>
        <dd>{r.roundLabel}</dd>
        <dt>EOI 提交日期</dt>
        <dd>{r.eoiDate ?? "未提供 / 不适用"}</dd>
        <dt>发布机构</dt>
        <dd>{s?.publisher}</dd>
        <dt>来源标题</dt>
        <dd>{s?.title}</dd>
        <dt>发布时间</dt>
        <dd>
          {s?.publishedAt ?? r.publicationDate ?? "未注明；不以检索时间替代"}
        </dd>
        <dt>检索时间 UTC</dt>
        <dd>{s?.retrievedAt}</dd>
        <dt>保留形式</dt>
        <dd>
          {s?.snapshotKind === "retrieved_document_text"
            ? "官方文档的检索文本；校验值对应提取文本，不是原 PDF"
            : s?.snapshotKind === "original_pdf"
              ? "原始 PDF 文件"
              : s?.snapshotKind === "official_search_index" ||
                  s?.snapshotKind === "official_web_retrieval_json"
                ? "官方网页检索文本；并非原始 HTML"
                : "官方网页快照"}
        </dd>
        <dt>SHA-256</dt>
        <dd className="hash">{s?.sha256}</dd>
      </dl>
      {s?.note && <p className="note">{s.note}</p>}
      {s && (
        <a className="primary" href={s.url} target="_blank" rel="noreferrer">
          打开官方原文 <ArrowUpRight size={15} />
        </a>
      )}
    </dialog>
  );
}
