import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, FileType } from "lucide-react";
import { masteryLevel } from "@/lib/sm2";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({ meta: [{ title: "Export — Lexica" }] }),
  component: ExportPage,
});

interface Row {
  word: string; definition: string; translation: string; part_of_speech: string;
  example: string; status: string; reviews: number; accuracy: string;
  ease_factor: number; interval_days: number; next_review: string; last_reviewed: string;
}

function ExportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("words").select("*").order("word");
      const mapped: Row[] = (data || []).map((w: any) => ({
        word: w.word,
        definition: w.definition || "",
        translation: w.translation || "",
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
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `lexica-${stamp()}.csv`);
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

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(18);
    doc.text("Lexica — Vocabulary Progress", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Exported ${new Date().toLocaleString()} · ${rows.length} words`, 14, 25);

    autoTable(doc, {
      startY: 32,
      head: [["Word", "POS", "Definition", "Translation", "Status", "Reviews", "Acc.", "Next"]],
      body: rows.map((r) => [r.word, r.part_of_speech, r.definition, r.translation, r.status, String(r.reviews), r.accuracy, r.next_review]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [102, 51, 51] },
      columnStyles: { 2: { cellWidth: 60 }, 3: { cellWidth: 40 } },
    });

    doc.save(`lexica-${stamp()}.pdf`);
    toast.success("PDF exported");
  }

  function stamp() { return new Date().toISOString().slice(0, 10); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Export your progress</h1>
        <p className="mt-1 text-muted-foreground">Download your full journal with review stats in any format.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ExportCard icon={FileSpreadsheet} title="CSV" desc="Plain spreadsheet, works everywhere" onClick={exportCSV} disabled={loading || rows.length === 0} />
        <ExportCard icon={FileSpreadsheet} title="Excel (.xlsx)" desc="With formatted columns" onClick={exportXLSX} disabled={loading || rows.length === 0} />
        <ExportCard icon={FileType} title="PDF" desc="Printable progress report" onClick={exportPDF} disabled={loading || rows.length === 0} />
      </div>

      <div className="paper-card p-6">
        <h2 className="font-serif text-xl font-semibold">What's included</h2>
        <ul className="mt-3 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
          <li>· Word, definition, translation, part of speech, example</li>
          <li>· Mastery status (New → Mastered)</li>
          <li>· Review count and accuracy</li>
          <li>· SM-2 ease factor and interval</li>
          <li>· Next review date</li>
          <li>· Last reviewed date</li>
        </ul>
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
