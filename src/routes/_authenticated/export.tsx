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
  const pdfRef = useRef<HTMLDivElement>(null);

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
    // BOM for Excel UTF-8 compatibility
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

  // Render the off-screen HTML to canvas, paginate vertically into a PDF.
  // This embeds text as images, so any Unicode script (Chinese, Japanese,
  // Korean, Arabic, etc.) renders correctly using the browser's system fonts.
  async function exportPDF() {
    if (!pdfRef.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      let heightLeft = imgH;
      let position = 0;
      const img = canvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`lexica-${stamp()}.pdf`);
      toast.success("PDF exported");
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
      </div>

      {!loading && rows.length === 0 && (
        <div className="paper-card p-10 text-center text-muted-foreground">
          You haven't added any words yet.
        </div>
      )}

      {/* Off-screen render target for PDF — keeps real fonts so CJK / RTL / etc. work */}
      <div style={{ position: "fixed", left: "-10000px", top: 0, width: "1400px", background: "#fff", color: "#1a1a1a", fontFamily: "system-ui, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif", padding: "32px" }} ref={pdfRef}>
        <div style={{ borderBottom: "2px solid #6b3a3a", paddingBottom: "12px", marginBottom: "20px" }}>
          <div style={{ fontSize: "24px", fontWeight: 600 }}>Lexica — Vocabulary Progress</div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>Exported {new Date().toLocaleString()} · {rows.length} words</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#6b3a3a", color: "#fff" }}>
              <th style={th}>Word</th>
              <th style={th}>POS</th>
              <th style={{ ...th, width: "30%" }}>Definition</th>
              <th style={{ ...th, width: "28%" }}>Example</th>
              <th style={th}>Status</th>
              <th style={th}>Reviews</th>
              <th style={th}>Acc.</th>
              <th style={th}>Next</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? "#faf6f1" : "#fff" }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.word}</td>
                <td style={{ ...td, fontStyle: "italic", color: "#666" }}>{r.part_of_speech}</td>
                <td style={td}>{r.definition}</td>
                <td style={{ ...td, color: "#555" }}>{r.example}</td>
                <td style={td}>{r.status}</td>
                <td style={td}>{r.reviews}</td>
                <td style={td}>{r.accuracy}</td>
                <td style={td}>{r.next_review}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #ddd" };
const td: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #eee", verticalAlign: "top" };

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
