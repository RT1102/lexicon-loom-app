import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, RotateCcw, Pencil, Search } from "lucide-react";
import { masteryLevel } from "@/lib/sm2";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/words")({
  head: () => ({ meta: [{ title: "Words — Lexica" }] }),
  component: WordsPage,
});

interface Word {
  id: string; word: string; definition: string | null; translation: string | null;
  part_of_speech: string | null; example: string | null;
  ease_factor: number; interval_days: number; repetitions: number;
  due_date: string; review_count: number; correct_count: number;
}

const POS = ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "phrase", "other"];

function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Word> | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("words").select("*").order("created_at", { ascending: false });
    setWords((data as Word[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return words.filter((w) =>
      !q || w.word.toLowerCase().includes(q) ||
      (w.definition || "").toLowerCase().includes(q) ||
      (w.translation || "").toLowerCase().includes(q),
    );
  }, [words, search]);

  async function save() {
    if (!editing?.word) return toast.error("Word is required");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = {
      user_id: u.user.id,
      word: editing.word!.trim(),
      definition: editing.definition || null,
      translation: editing.translation || null,
      part_of_speech: editing.part_of_speech || null,
      example: editing.example || null,
    };
    if (editing.id) {
      const { error } = await supabase.from("words").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("words").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("words").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Word deleted");
    load();
  }

  async function resetOne(id: string) {
    const { error } = await supabase.from("words").update({
      ease_factor: 2.5, interval_days: 0, repetitions: 0,
      due_date: new Date().toISOString(), last_reviewed_at: null,
      review_count: 0, correct_count: 0,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("review_logs").delete().eq("word_id", id);
    toast.success("Progress reset");
    load();
  }

  async function resetAll() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("words").update({
      ease_factor: 2.5, interval_days: 0, repetitions: 0,
      due_date: new Date().toISOString(), last_reviewed_at: null,
      review_count: 0, correct_count: 0,
    }).eq("user_id", u.user.id);
    if (error) return toast.error(error.message);
    await supabase.from("review_logs").delete().eq("user_id", u.user.id);
    toast.success("All progress reset");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Your words</h1>
          <p className="mt-1 text-muted-foreground">{words.length} {words.length === 1 ? "entry" : "entries"} in your journal.</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline"><RotateCcw className="mr-2 size-4" /> Reset all progress</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  All review history and SM-2 stats will be cleared. Your words and definitions remain — only the schedule resets.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetAll}>Yes, reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button asChild variant="outline"><Link to="/import">Import file</Link></Button>
          <WordDialog editing={editing} setEditing={setEditing} onSave={save}>
            <Button onClick={() => setEditing({})}><Plus className="mr-2 size-4" /> Add word</Button>
          </WordDialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search words, definitions…" className="pl-9" />
      </div>

      <div className="paper-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No words yet. Add one or import a list.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Word</th>
                  <th className="px-4 py-3">Definition</th>
                  <th className="px-4 py-3">Translation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Next review</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-serif text-base font-semibold">{w.word}</div>
                      {w.part_of_speech && <div className="text-xs italic text-muted-foreground">{w.part_of_speech}</div>}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">{w.definition}</td>
                    <td className="px-4 py-3 text-muted-foreground">{w.translation}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{masteryLevel(w.repetitions, w.ease_factor)}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(w.due_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <WordDialog editing={editing} setEditing={setEditing} onSave={save}>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(w)}><Pencil className="size-4" /></Button>
                        </WordDialog>
                        <Button size="sm" variant="ghost" onClick={() => resetOne(w.id)} title="Reset progress"><RotateCcw className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(w.id)} className="text-destructive hover:text-destructive"><Trash2 className="size-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function WordDialog({ children, editing, setEditing, onSave }: { children: React.ReactNode; editing: Partial<Word> | null; setEditing: (w: Partial<Word> | null) => void; onSave: () => void }) {
  const open = editing !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && setEditing(null)}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing?.id ? "Edit word" : "Add a word"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Word *</Label>
            <Input value={editing?.word || ""} onChange={(e) => setEditing({ ...(editing || {}), word: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Part of speech</Label>
              <Select value={editing?.part_of_speech || ""} onValueChange={(v) => setEditing({ ...(editing || {}), part_of_speech: v })}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{POS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Translation</Label>
              <Input value={editing?.translation || ""} onChange={(e) => setEditing({ ...(editing || {}), translation: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Definition</Label>
            <Textarea rows={2} value={editing?.definition || ""} onChange={(e) => setEditing({ ...(editing || {}), definition: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Example sentence</Label>
            <Textarea rows={2} value={editing?.example || ""} onChange={(e) => setEditing({ ...(editing || {}), example: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={onSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
