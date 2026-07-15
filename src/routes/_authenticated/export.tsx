import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, FileType } from "lucide-react";
import { masteryLevel } from "@/lib/sm2";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({ meta: [{ title: "Export — Lexica" }] }),
  component: ExportPage,
});

interface Row {
  word: string; definition: string; part_of_speech: string;
  example: string; status: string; reviews: number; accuracy: string;
  ease_factor: number; interval_days: number; next_review: string; last_reviewed: string;
}

function ExportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("words").select("*").order("word");
      const mapped: Row[] = (data || []).map((w: any) => ({
        word: w.word,
        definition: w.definition || "",
        part_of_speech: w.part_of_speech || "",
        example: w.example || "",
        status: masteryLevel(w.repetitions, w.ease_factor),
        reviews: w.review_count,
        accuracy: w.review_count ? Math.round(100 * w.correct_count / w.review_count) + "%" : "—",
        ease_factor: w.ease_factor,
        interval_days: w.interval_days,
        next_review: new Date(w.due_date).toLocaleDateString(),
        last_reviewed: w.last_reviewed_at ? new Date(w.last_reviewed_at).toLocaleDateString() : "—",
      }));
      setRows(mapped);
      setLoading(false);
    })();
  }, []);

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const csv = Papa.unparse(rows);
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `lexica-${stamp()}.csv`);
    toast.success("CSV exported");
  }

  function exportXLSX() {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vocabulary");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    download(new Blob([out], { type: "application/octet-stream" }), `lexica-${stamp()}.xlsx`);
    toast.success("Excel exported");
  }

  // Open a print-ready HTML document in a new window and trigger the native
  // browser "Save as PDF" dialog. The browser handles all font shaping, so
  // Chinese, Japanese, Korean, Arabic, etc. render perfectly using system
  // fonts — no font embedding, no rasterization, no oklch() color issues.
  function escapeHtml(s: string) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function exportPDF() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const win = window.open("", "_blank", "width=1200,height=900");
      if (!win) {
        toast.error("Please allow pop-ups to export PDF");
        setBusy(false);
        return;
      }
      const tableRows = rows.map((r, i) => `
        <tr style="background:${i % 2 ? "#faf6f1" : "#fff"}">
          <td class="c" style="font-weight:600">${escapeHtml(r.word)}</td>
          <td class="c" style="font-style:italic;color:#666">${escapeHtml(r.part_of_speech)}</td>
          <td class="c">${escapeHtml(r.definition)}</td>
          <td class="c" style="color:#555">${escapeHtml(r.example)}</td>
          <td class="c">${escapeHtml(r.status)}</td>
          <td class="c">${r.reviews}</td>
          <td class="c">${escapeHtml(r.accuracy)}</td>
          <td class="c">${escapeHtml(r.next_review)}</td>
        </tr>
      `).join("");

      const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Lexica — Vocabulary Progress</title>
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
    <div class="title">Lexica — Vocabulary Progress</div>
    <div class="sub">Exported ${escapeHtml(new Date().toLocaleString())} · ${rows.length} words</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Word</th>
        <th>POS</th>
        <th style="width:28%">Definition</th>
        <th style="width:26%">Example</th>
        <th>Status</th>
        <th>Reviews</th>
        <th>Acc.</th>
        <th>Next</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="foot">Lexica</div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 200);
    });
  <\/script>
</body>
</html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
      toast.success("Opening print dialog — choose 'Save as PDF'");
    } catch (e: any) {
      toast.error("PDF export failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  function stamp() { return new Date().toISOString().slice(0, 10); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Export your progress</h1>
        <p className="mt-1 text-muted-foreground">Download your full journal with review stats in any format.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ExportCard icon={FileSpreadsheet} title="CSV" desc="Plain spreadsheet, works everywhere" onClick={exportCSV} disabled={loading || rows.length === 0 || busy} />
        <ExportCard icon={FileSpreadsheet} title="Excel (.xlsx)" desc="With formatted columns" onClick={exportXLSX} disabled={loading || rows.length === 0 || busy} />
        <ExportCard icon={FileType} title="PDF" desc="Printable report — supports every language" onClick={exportPDF} disabled={loading || rows.length === 0 || busy} />
      </div>

      <div className="paper-card p-6">
        <h2 className="font-serif text-xl font-semibold">What's included</h2>
        <ul className="mt-3 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
          <li>· Word, definition, part of speech, example</li>
          <li>· Mastery status (New → Mastered)</li>
          <li>· Review count and accuracy</li>
          <li>· Ease factor and interval</li>
          <li>· Next review date</li>
          <li>· Last reviewed date</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          PDF export opens a print preview — choose <strong>Save as PDF</strong> as the destination. This preserves Chinese, Japanese, and every other language perfectly.
        </p>
      </div>

      {!loading && rows.length === 0 && (
        <div className="paper-card p-10 text-center text-muted-foreground">
          You haven't added any words yet.
        </div>
      )}
    </div>
  );
}

function ExportCard({ icon: Icon, title, desc, onClick, disabled }: any) {
  return (
    <button onClick={onClick} disabled={disabled} className="paper-card group p-6 text-left transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/40 disabled:opacity-50">
      <Icon className="mb-3 size-7 text-primary" />
      <div className="font-serif text-xl font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4 text-sm font-medium text-primary group-hover:underline">Download →</div>
    </button>
  );
}
