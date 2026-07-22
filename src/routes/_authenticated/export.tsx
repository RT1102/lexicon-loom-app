import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, FileType } from "lucide-react";
import { getStage } from "@/lib/sm2";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({ meta: [{ title: "Export — Lexica" }] }),
  component: ExportPage,
});

interface RawWord {
  word: string;
  definition: string | null;
  part_of_speech: string | null;
  example: string | null;
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  review_count: number;
  correct_count: number;
  due_date: string;
  last_reviewed_at: string | null;
}

function ExportPage() {
  const { t } = useLanguage();
  const [raw, setRaw] = useState<RawWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("words").select("*").order("word");
      setRaw((data as RawWord[]) || []);
      setLoading(false);
    })();
  }, []);

  // Build rows fresh at each export so column headers follow the current
  // language selection.
  function buildRows() {
    const H = {
      word: t("words.colWord"),
      pos: t("imp.colPos"),
      definition: t("words.colDefinition"),
      example: t("imp.colExample"),
      status: t("words.colStage"),
      reviews: t("dashboard.reviewsLast14").split(" · ")[0],
      accuracy: t("dashboard.accuracy"),
      ease: "ease_factor",
      interval: "interval_days",
      next: t("words.colNext"),
      last: t("exp.incl6").replace(/^· /, ""),
    };
    return raw.map((w) => ({
      [H.word]: w.word,
      [H.pos]: w.part_of_speech || "",
      [H.definition]: w.definition || "",
      [H.example]: w.example || "",
      [H.status]: t(getStage(w.repetitions).labelKey),
      [H.reviews]: w.review_count,
      [H.accuracy]: w.review_count ? Math.round(100 * w.correct_count / w.review_count) + "%" : "—",
      [H.ease]: w.ease_factor,
      [H.interval]: w.interval_days,
      [H.next]: new Date(w.due_date).toLocaleDateString(),
      [H.last]: w.last_reviewed_at ? new Date(w.last_reviewed_at).toLocaleDateString() : "—",
    }));
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const csv = Papa.unparse(buildRows());
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `lexica-${stamp()}.csv`);
    toast.success(t("exp.csvDone"));
  }

  function exportXLSX() {
    const ws = XLSX.utils.json_to_sheet(buildRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vocabulary");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    download(new Blob([out], { type: "application/octet-stream" }), `lexica-${stamp()}.xlsx`);
    toast.success(t("exp.xlsxDone"));
  }

  function escapeHtml(s: any) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function exportPDF() {
    if (raw.length === 0) return;
    setBusy(true);
    try {
      const win = window.open("", "_blank", "width=1200,height=900");
      if (!win) {
        toast.error(t("exp.allowPopups"));
        setBusy(false);
        return;
      }
      const rows = raw.map((w, i) => {
        const stage = t(getStage(w.repetitions).labelKey);
        const acc = w.review_count ? Math.round(100 * w.correct_count / w.review_count) + "%" : "—";
        return `
        <tr style="background:${i % 2 ? "#faf6f1" : "#fff"}">
          <td class="c" style="font-weight:600">${escapeHtml(w.word)}</td>
          <td class="c" style="font-style:italic;color:#666">${escapeHtml(w.part_of_speech || "")}</td>
          <td class="c">${escapeHtml(w.definition || "")}</td>
          <td class="c" style="color:#555">${escapeHtml(w.example || "")}</td>
          <td class="c">${escapeHtml(stage)}</td>
          <td class="c">${w.review_count}</td>
          <td class="c">${escapeHtml(acc)}</td>
          <td class="c">${escapeHtml(new Date(w.due_date).toLocaleDateString())}</td>
        </tr>`;
      }).join("");

      const title = t("app.name") + " — " + t("exp.title");
      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC",
      "Noto Sans", sans-serif;
    color: #1a1a1a; margin: 0; padding: 24px;
  }
  .head { border-bottom: 2px solid #6b3a3a; padding-bottom: 10px; margin-bottom: 16px; }
  .title { font-size: 22px; font-weight: 600; }
  .sub { font-size: 11px; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th {
    background: #6b3a3a; color: #fff; text-align: left; font-weight: 600;
    padding: 8px 8px; border-bottom: 1px solid #ddd;
  }
  tbody td.c { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; word-break: break-word; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .foot { margin-top: 12px; font-size: 10px; color: #888; text-align: right; }
</style>
</head>
<body>
  <div class="head">
    <div class="title">${escapeHtml(title)}</div>
    <div class="sub">${escapeHtml(new Date().toLocaleString())} · ${raw.length}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(t("words.colWord"))}</th>
        <th>${escapeHtml(t("imp.colPos"))}</th>
        <th style="width:28%">${escapeHtml(t("words.colDefinition"))}</th>
        <th style="width:26%">${escapeHtml(t("imp.colExample"))}</th>
        <th>${escapeHtml(t("words.colStage"))}</th>
        <th>${escapeHtml(t("dashboard.reviewsLast14").split(" · ")[0])}</th>
        <th>${escapeHtml(t("dashboard.accuracy"))}</th>
        <th>${escapeHtml(t("words.colNext"))}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">${escapeHtml(t("app.name"))}</div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.focus(); window.print(); }, 200);
    });
  <\/script>
</body>
</html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
      toast.success(t("exp.pdfOpening"));
    } catch (e: any) {
      toast.error(t("exp.pdfFail", { msg: e.message }));
    } finally {
      setBusy(false);
    }
  }

  function stamp() { return new Date().toISOString().slice(0, 10); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">{t("exp.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("exp.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ExportCard icon={FileSpreadsheet} title={t("exp.csv")} desc={t("exp.csvDesc")} download={t("exp.download")} onClick={exportCSV} disabled={loading || raw.length === 0 || busy} />
        <ExportCard icon={FileSpreadsheet} title={t("exp.xlsx")} desc={t("exp.xlsxDesc")} download={t("exp.download")} onClick={exportXLSX} disabled={loading || raw.length === 0 || busy} />
        <ExportCard icon={FileType} title={t("exp.pdf")} desc={t("exp.pdfDesc")} download={t("exp.download")} onClick={exportPDF} disabled={loading || raw.length === 0 || busy} />
      </div>

      <div className="paper-card p-6">
        <h2 className="font-serif text-xl font-semibold">{t("exp.whatsIncluded")}</h2>
        <ul className="mt-3 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
          <li>{t("exp.incl1")}</li>
          <li>{t("exp.incl2")}</li>
          <li>{t("exp.incl3")}</li>
          <li>{t("exp.incl4")}</li>
          <li>{t("exp.incl5")}</li>
          <li>{t("exp.incl6")}</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">{t("exp.pdfNote")}</p>
      </div>

      {!loading && raw.length === 0 && (
        <div className="paper-card p-10 text-center text-muted-foreground">
          {t("exp.empty")}
        </div>
      )}
    </div>
  );
}

function ExportCard({ icon: Icon, title, desc, download, onClick, disabled }: any) {
  return (
    <button onClick={onClick} disabled={disabled} className="paper-card group p-6 text-left transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/40 disabled:opacity-50">
      <Icon className="mb-3 size-7 text-primary" />
      <div className="font-serif text-xl font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4 text-sm font-medium text-primary group-hover:underline">{download}</div>
    </button>
  );
}
