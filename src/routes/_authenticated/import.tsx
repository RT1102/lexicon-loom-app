import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { useLanguage } from "@/i18n/LanguageProvider";

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

const FIELD_SPLIT = /\s*(?:\t|\||—|–|\s-\s|:)\s*/;

function parseManualText(text: string): ParsedWord[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedWord[] = [];
  for (const line of lines) {
    const parts = line.split(FIELD_SPLIT).map((p) => p.trim());
    const [word, definition = "", part_of_speech = "", example = ""] = parts;
    if (!word || word.length >= 200) continue;
    out.push({ word, definition, part_of_speech, example });
  }
  return out;
}

function ImportPage() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const [parsed, setParsed] = useState<ParsedWord[]>([]);
  const [working, setWorking] = useState(false);
  const [pasted, setPasted] = useState("");

  const foundToast = (n: number) => toast.success(n === 1 ? t("imp.foundOne") : t("imp.foundOther", { n }));

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
          toast.error(t("imp.missingCols", { cols: check.missing.join(", ") }));
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
          toast.error(t("imp.missingCols", { cols: check.missing.join(", ") }));
          setWorking(false);
          return;
        }
        rows = data.map(normalizeRow).filter((x): x is ParsedWord => !!x);
      } else if (name.endsWith(".txt")) {
        const text = await file.text();
        rows = parseManualText(text);
      } else {
        toast.error(t("imp.unsupportedType"));
        setWorking(false);
        return;
      }

      if (rows.length === 0) {
        toast.error(t("imp.noValidRows"));
      } else {
        setParsed(rows);
        foundToast(rows.length);
      }
    } catch (err: any) {
      toast.error(t("imp.parseFail", { msg: err.message }));
    } finally {
      setWorking(false);
    }
  }

  function parsePasted() {
    const rows = parseManualText(pasted);
    if (rows.length === 0) return toast.error(t("imp.noValidLines"));
    setParsed(rows);
    foundToast(rows.length);
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
    toast.success(t("imp.importedN", { n: payload.length }));
    setWorking(false);
    nav({ to: "/words" });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">{t("imp.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("imp.subtitle")}</p>
      </div>

      <div className="paper-card bg-muted/30 p-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-foreground">{t("imp.requiredFormat")}</div>
            <p className="mt-1 text-muted-foreground">{t("imp.csvRule")}</p>
            <p className="mt-1 text-muted-foreground">{t("imp.textRule")} {t("imp.separators")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-2 size-4" /> {t("imp.downloadTemplate")}</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="paper-card p-6">
          <h2 className="font-serif text-xl font-semibold">{t("imp.fromFile")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("imp.fromFileHint")}</p>

          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:border-primary hover:bg-muted/50">
            <Upload className="size-8 text-muted-foreground" />
            <span className="font-medium">{t("imp.chooseFile")}</span>
            <span className="text-xs text-muted-foreground">{t("imp.fileTypes")}</span>
            <input
              type="file"
              accept=".txt,.csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><FileSpreadsheet className="size-3" /> {t("imp.csvExcelHeaders")}</div>
            <div className="flex items-center gap-1"><FileText className="size-3" /> {t("imp.txtDelimiters")}</div>
          </div>
        </div>

        <div className="paper-card p-6">
          <h2 className="font-serif text-xl font-semibold">{t("imp.pasteList")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("imp.pasteFormat")}</p>
          <Textarea
            rows={8}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"ephemeral | lasting a very short time | adjective | The ephemeral beauty of cherry blossoms.\nsanguine | optimistic, hopeful | adjective | She remained sanguine about the outcome."}
            className="mt-4 font-mono text-sm"
          />
          <Button onClick={parsePasted} className="mt-3" variant="outline">{t("imp.parseList")}</Button>
        </div>
      </div>

      {parsed.length > 0 && (
        <div className="paper-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold">{t("imp.preview")} ({parsed.length})</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setParsed([])}>{t("imp.discard")}</Button>
              <Button onClick={commit} disabled={working}>{working ? t("imp.importing") : t("imp.importN", { n: parsed.length })}</Button>
            </div>
          </div>
          <div className="max-h-96 overflow-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">{t("words.colWord")}</th>
                  <th className="px-3 py-2 text-left">{t("words.colDefinition")}</th>
                  <th className="px-3 py-2 text-left">{t("imp.colPos")}</th>
                  <th className="px-3 py-2 text-left">{t("imp.colExample")}</th>
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
            {parsed.length > 100 && <div className="p-2 text-center text-xs text-muted-foreground">{t("imp.andMore", { n: parsed.length - 100 })}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
