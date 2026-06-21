import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, FileSpreadsheet, Download } from "lucide-react";
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
  part_of_speech?: string;
  example?: string;
}

const REQUIRED_HEADERS = ["word", "definition"];
const OPTIONAL_HEADERS = ["part_of_speech", "example"];
const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

const HEADER_ALIASES: Record<string, string> = {
  word: "word", term: "word", vocabulary: "word", english: "word",
  definition: "definition", meaning: "definition", def: "definition",
  part_of_speech: "part_of_speech", pos: "part_of_speech", type: "part_of_speech", "parts of speech": "part_of_speech", "part of speech": "part_of_speech",
  example: "example", sentence: "example", "example sentence": "example",
};

function canonicalHeader(h: string): string | null {
  return HEADER_ALIASES[h.toLowerCase().trim()] ?? null;
}

function normalizeRow(row: any): ParsedWord | null {
  const out: any = {};
  for (const k of Object.keys(row)) {
    const canon = canonicalHeader(k);
    if (canon) out[canon] = String(row[k] ?? "").trim();
  }
  if (!out.word) return null;
  return {
    word: out.word,
    definition: out.definition || "",
    part_of_speech: out.part_of_speech || "",
    example: out.example || "",
  };
}

function validateHeaders(headers: string[]): { ok: boolean; missing: string[] } {
  const canon = new Set(headers.map(canonicalHeader).filter(Boolean) as string[]);
  const missing = REQUIRED_HEADERS.filter((h) => !canon.has(h));
  return { ok: missing.length === 0, missing };
}

// 4-field manual format: word | definition | part_of_speech | example
// Accepts these delimiters between fields: tab, |, em dash (—), en dash (–), hyphen ( - ), colon (:)
const FIELD_SPLIT = /\s*(?:\t|\||—|–|\s-\s|:)\s*/;

function parseManualText(text: string): ParsedWord[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines
    .map((line) => {
      const parts = line.split(FIELD_SPLIT).map((p) => p.trim());
      const [word, definition = "", part_of_speech = "", example = ""] = parts;
      if (!word) return null;
      return { word, definition, part_of_speech, example };
    })
    .filter((w): w is ParsedWord => !!w && w.word.length > 0 && w.word.length < 200);
}

function ImportPage() {
  const nav = useNavigate();
  const [parsed, setParsed] = useState<ParsedWord[]>([]);
  const [working, setWorking] = useState(false);
  const [pasted, setPasted] = useState("");

  async function handleFile(file: File) {
    setWorking(true);
    try {
      const name = file.name.toLowerCase();
      let rows: ParsedWord[] = [];

      if (name.endsWith(".csv")) {
        const text = await file.text();
        const res = Papa.parse(text, { header: true, skipEmptyLines: true });
        const headers = res.meta.fields || [];
        const check = validateHeaders(headers);
        if (!check.ok) {
          toast.error(`Missing required column(s): ${check.missing.join(", ")}. Required headers: word, definition.`);
          setWorking(false);
          return;
        }
        rows = (res.data as any[]).map(normalizeRow).filter((x): x is ParsedWord => !!x);
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
        const headers = data.length > 0 ? Object.keys(data[0]) : [];
        const check = validateHeaders(headers);
        if (!check.ok) {
          toast.error(`Missing required column(s): ${check.missing.join(", ")}. Required headers: word, definition.`);
          setWorking(false);
          return;
        }
        rows = data.map(normalizeRow).filter((x): x is ParsedWord => !!x);
      } else if (name.endsWith(".txt")) {
        const text = await file.text();
        rows = parseManualText(text);
      } else {
        toast.error("Unsupported file type. Use .csv, .xlsx, .xls, or .txt");
        setWorking(false);
        return;
      }

      if (rows.length === 0) {
        toast.error("No valid rows found. Check the format and try again.");
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

  function parsePasted() {
    const rows = parseManualText(pasted);
    if (rows.length === 0) return toast.error("No valid lines found. Use: word | definition | part of speech | example");
    setParsed(rows);
    toast.success(`Found ${rows.length} ${rows.length === 1 ? "word" : "words"}`);
  }

  function downloadTemplate() {
    const csv = "word,definition,part_of_speech,example\nephemeral,lasting a very short time,adjective,The ephemeral beauty of cherry blossoms.\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "lexica-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function commit() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setWorking(true);
    const payload = parsed.map((w) => ({
      user_id: u.user!.id,
      word: w.word,
      definition: w.definition || null,
      translation: null,
      part_of_speech: w.part_of_speech || null,
      example: w.example || null,
    }));
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
        <p className="mt-1 text-muted-foreground">Use the strict format below so every word is detected correctly.</p>
      </div>

      <div className="paper-card bg-muted/30 p-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-foreground">Required format</div>
            <p className="mt-1 text-muted-foreground">
              Spreadsheets / CSV: first row must be headers <code className="rounded bg-paper px-1">word</code>, <code className="rounded bg-paper px-1">definition</code>
              {" "}(required), plus optional <code className="rounded bg-paper px-1">part_of_speech</code>, <code className="rounded bg-paper px-1">example</code>.
            </p>
            <p className="mt-1 text-muted-foreground">
              Text / paste: one entry per line in this exact order — <code className="rounded bg-paper px-1">word | definition | part of speech | example</code>.
              Separators allowed: <code>|</code>, tab, <code> - </code>, <code>:</code>, em/en dash.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-2 size-4" /> Download CSV template</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="paper-card p-6">
          <h2 className="font-serif text-xl font-semibold">From a file</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accepts .csv, .xlsx, .xls, .txt</p>

          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:border-primary hover:bg-muted/50">
            <Upload className="size-8 text-muted-foreground" />
            <span className="font-medium">Choose a file</span>
            <span className="text-xs text-muted-foreground">.csv, .xlsx, .xls, .txt</span>
            <input
              type="file"
              accept=".txt,.csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><FileSpreadsheet className="size-3" /> CSV / Excel with headers</div>
            <div className="flex items-center gap-1"><FileText className="size-3" /> .txt with field delimiters</div>
          </div>
        </div>

        <div className="paper-card p-6">
          <h2 className="font-serif text-xl font-semibold">Paste a list</h2>
          <p className="mt-1 text-sm text-muted-foreground">Format: <code>word | definition | part of speech | example</code></p>
          <Textarea
            rows={8}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"ephemeral | lasting a very short time | adjective | The ephemeral beauty of cherry blossoms.\nsanguine | optimistic, hopeful | adjective | She remained sanguine about the outcome."}
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
                <tr>
                  <th className="px-3 py-2 text-left">Word</th>
                  <th className="px-3 py-2 text-left">Definition</th>
                  <th className="px-3 py-2 text-left">POS</th>
                  <th className="px-3 py-2 text-left">Example</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 100).map((w, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 font-serif">{w.word}</td>
                    <td className="px-3 py-2 text-muted-foreground">{w.definition}</td>
                    <td className="px-3 py-2 text-muted-foreground italic">{w.part_of_speech}</td>
                    <td className="px-3 py-2 text-muted-foreground">{w.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 100 && <div className="p-2 text-center text-xs text-muted-foreground">…and {parsed.length - 100} more</div>}
          </div>
        </div>
      )}
    </div>
  );
}
