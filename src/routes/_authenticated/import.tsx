import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Papa from "papaparse";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Import — Lexica" }] }),
  component: ImportPage,
});

interface ParsedWord {
  word: string;
  definition?: string;
  translation?: string;
  part_of_speech?: string;
  example?: string;
}

function ImportPage() {
  const nav = useNavigate();
  const [parsed, setParsed] = useState<ParsedWord[]>([]);
  const [working, setWorking] = useState(false);
  const [pasted, setPasted] = useState("");

  function normalizeRow(row: any): ParsedWord | null {
    const keys = Object.keys(row).reduce((acc: any, k) => { acc[k.toLowerCase().trim()] = row[k]; return acc; }, {});
    const word = keys["word"] || keys["term"] || keys["vocabulary"] || keys["english"] || Object.values(row)[0];
    if (!word) return null;
    return {
      word: String(word).trim(),
      definition: keys["definition"] || keys["meaning"] || keys["def"] || "",
      translation: keys["translation"] || keys["chinese"] || keys["native"] || "",
      part_of_speech: keys["part_of_speech"] || keys["pos"] || keys["type"] || "",
      example: keys["example"] || keys["sentence"] || "",
    };
  }

  async function handleFile(file: File) {
    setWorking(true);
    try {
      const name = file.name.toLowerCase();
      let rows: ParsedWord[] = [];

      if (name.endsWith(".csv")) {
        const text = await file.text();
        const res = Papa.parse(text, { header: true, skipEmptyLines: true });
        rows = (res.data as any[]).map(normalizeRow).filter((x): x is ParsedWord => !!x);
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        rows = data.map(normalizeRow).filter((x): x is ParsedWord => !!x);
      } else if (name.endsWith(".pdf")) {
        const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
        // @ts-ignore
        const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        let text = "";
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((it: any) => it.str).join(" ") + "\n";
        }
        rows = parseText(text);
      } else {
        const text = await file.text();
        rows = parseText(text);
      }

      if (rows.length === 0) {
        toast.error("No words found in this file");
      } else {
        setParsed(rows);
        toast.success(`Found ${rows.length} ${rows.length === 1 ? "word" : "words"}`);
      }
    } catch (err: any) {
      toast.error("Failed to parse file: " + err.message);
    } finally {
      setWorking(false);
    }
  }

  function parseText(text: string): ParsedWord[] {
    // Try line-by-line: "word - definition" or "word: definition" or just "word"
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      const m = line.match(/^([^\-:|–—\t]+)[\-:|–—\t]+(.+)$/);
      if (m) return { word: m[1].trim(), definition: m[2].trim() };
      return { word: line };
    }).filter((w) => w.word.length > 0 && w.word.length < 200);
  }

  function parsePasted() {
    const rows = parseText(pasted);
    if (rows.length === 0) return toast.error("No words found");
    setParsed(rows);
    toast.success(`Found ${rows.length} ${rows.length === 1 ? "word" : "words"}`);
  }

  async function commit() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setWorking(true);
    const payload = parsed.map((w) => ({
      user_id: u.user!.id,
      word: w.word,
      definition: w.definition || null,
      translation: w.translation || null,
      part_of_speech: w.part_of_speech || null,
      example: w.example || null,
    }));
    // chunk to avoid huge inserts
    const chunkSize = 200;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const { error } = await supabase.from("words").insert(payload.slice(i, i + chunkSize));
      if (error) {
        toast.error(error.message);
        setWorking(false);
        return;
      }
    }
    toast.success(`Imported ${payload.length} words`);
    setWorking(false);
    nav({ to: "/words" });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Import your words</h1>
        <p className="mt-1 text-muted-foreground">Upload a file or paste a list. We'll detect the columns.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="paper-card p-6">
          <h2 className="font-serif text-xl font-semibold">From a file</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accepts .txt, .csv, .xlsx, .xls, .pdf</p>

          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:border-primary hover:bg-muted/50">
            <Upload className="size-8 text-muted-foreground" />
            <span className="font-medium">Choose a file</span>
            <span className="text-xs text-muted-foreground">or drag & drop</span>
            <input
              type="file"
              accept=".txt,.csv,.xlsx,.xls,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><FileText className="size-3" /> Text/CSV</div>
            <div className="flex items-center gap-1"><FileSpreadsheet className="size-3" /> Excel</div>
            <div className="flex items-center gap-1"><FileType className="size-3" /> PDF</div>
          </div>
        </div>

        <div className="paper-card p-6">
          <h2 className="font-serif text-xl font-semibold">Paste a list</h2>
          <p className="mt-1 text-sm text-muted-foreground">One word per line. Optional: <code>word - definition</code></p>
          <Textarea
            rows={8}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"ephemeral - lasting a very short time\nsanguine - optimistic\nverbose"}
            className="mt-4 font-mono text-sm"
          />
          <Button onClick={parsePasted} className="mt-3" variant="outline">Parse list</Button>
        </div>
      </div>

      {parsed.length > 0 && (
        <div className="paper-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold">Preview ({parsed.length})</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setParsed([])}>Discard</Button>
              <Button onClick={commit} disabled={working}>{working ? "Importing…" : `Import ${parsed.length} words`}</Button>
            </div>
          </div>
          <div className="max-h-96 overflow-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-widest text-muted-foreground">
                <tr><th className="px-3 py-2 text-left">Word</th><th className="px-3 py-2 text-left">Definition</th><th className="px-3 py-2 text-left">Translation</th></tr>
              </thead>
              <tbody>
                {parsed.slice(0, 100).map((w, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 font-serif">{w.word}</td>
                    <td className="px-3 py-2 text-muted-foreground">{w.definition}</td>
                    <td className="px-3 py-2 text-muted-foreground">{w.translation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 100 && <div className="p-2 text-center text-xs text-muted-foreground">…and {parsed.length - 100} more</div>}
          </div>
        </div>
      )}

      <div className="paper-card bg-muted/30 p-5 text-sm text-muted-foreground">
        <strong className="text-foreground">Tip:</strong> for spreadsheets and CSVs, use column headers like
        {" "}<code className="rounded bg-paper px-1">word</code>,
        {" "}<code className="rounded bg-paper px-1">definition</code>,
        {" "}<code className="rounded bg-paper px-1">translation</code>,
        {" "}<code className="rounded bg-paper px-1">part_of_speech</code>,
        {" "}<code className="rounded bg-paper px-1">example</code>.
      </div>
    </div>
  );
}
