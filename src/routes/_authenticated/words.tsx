import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, RotateCcw, Pencil, Search, Folder, FolderPlus, Inbox, GripVertical, X } from "lucide-react";
import { getStage } from "@/lib/sm2";
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
  folder_id: string | null;
}
interface FolderRow { id: string; name: string; color: string | null; }

const POS = ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "phrase", "other"];

function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | "all" | "unfiled">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Word> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");

  async function load() {
    setLoading(true);
    const [w, f] = await Promise.all([
      supabase.from("words").select("*").order("created_at", { ascending: false }),
      supabase.from("folders").select("*").order("created_at", { ascending: true }),
    ]);
    setWords((w.data as Word[]) || []);
    setFolders((f.data as FolderRow[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return words.filter((w) => {
      if (activeFolder === "unfiled" && w.folder_id) return false;
      if (activeFolder !== "all" && activeFolder !== "unfiled" && w.folder_id !== activeFolder) return false;
      if (!q) return true;
      return (
        w.word.toLowerCase().includes(q) ||
        (w.definition || "").toLowerCase().includes(q) ||
        (w.translation || "").toLowerCase().includes(q)
      );
    });
  }, [words, search, activeFolder]);

  const countFor = (key: string | "all" | "unfiled") =>
    key === "all" ? words.length :
    key === "unfiled" ? words.filter((w) => !w.folder_id).length :
    words.filter((w) => w.folder_id === key).length;

  function toggleSelect(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }
  function toggleSelectAll() {
    if (filtered.every((w) => selected.has(w.id)) && filtered.length > 0) {
      const next = new Set(selected);
      filtered.forEach((w) => next.delete(w.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((w) => next.add(w.id));
      setSelected(next);
    }
  }

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
      const { error } = await supabase.from("words").insert({
        ...payload,
        folder_id: activeFolder !== "all" && activeFolder !== "unfiled" ? activeFolder : null,
      });
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

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("folders").insert({ user_id: u.user.id, name });
    if (error) return toast.error(error.message);
    setNewFolderName("");
    toast.success("Folder created");
    load();
  }

  async function renameFolder(id: string) {
    const name = prompt("Rename folder")?.trim();
    if (!name) return;
    const { error } = await supabase.from("folders").update({ name }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function deleteFolder(id: string) {
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeFolder === id) setActiveFolder("all");
    toast.success("Folder deleted (words kept)");
    load();
  }

  async function moveWordsToFolder(wordIds: string[], folderId: string | null) {
    if (wordIds.length === 0) return;
    const { error } = await supabase.from("words").update({ folder_id: folderId }).in("id", wordIds);
    if (error) return toast.error(error.message);
    toast.success(`Moved ${wordIds.length} ${wordIds.length === 1 ? "word" : "words"}`);
    setSelected(new Set());
    load();
  }

  // ---- HTML5 drag handlers ----
  function onWordDragStart(e: React.DragEvent, id: string) {
    // Drag the selection if the dragged row is selected, otherwise just that row.
    const ids = selected.has(id) ? Array.from(selected) : [id];
    e.dataTransfer.setData("application/x-lexica-words", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  }
  function onFolderDragOver(e: React.DragEvent, target: string | "unfiled") {
    if (!e.dataTransfer.types.includes("application/x-lexica-words")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(target);
  }
  function onFolderDrop(e: React.DragEvent, target: string | "unfiled") {
    e.preventDefault();
    setDragOver(null);
    const raw = e.dataTransfer.getData("application/x-lexica-words");
    if (!raw) return;
    const ids = JSON.parse(raw) as string[];
    moveWordsToFolder(ids, target === "unfiled" ? null : target);
  }

  const selectedCount = selected.size;
  const allOnPageSelected = filtered.length > 0 && filtered.every((w) => selected.has(w.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Your words</h1>
          <p className="mt-1 text-muted-foreground">{words.length} {words.length === 1 ? "entry" : "entries"} in your journal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline"><RotateCcw className="mr-2 size-4" /> Reset all progress</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  All review history and learning stages will be cleared. Your words remain — only the schedule resets.
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

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Folder sidebar */}
        <aside className="paper-card p-3 h-fit">
          <div className="px-2 pt-1 pb-3 text-xs uppercase tracking-widest text-muted-foreground">Folders</div>
          <ul className="space-y-1">
            <FolderItem
              active={activeFolder === "all"}
              onClick={() => setActiveFolder("all")}
              icon={<Inbox className="size-4" />}
              label="All words"
              count={countFor("all")}
            />
            <FolderItem
              active={activeFolder === "unfiled"}
              dropActive={dragOver === "unfiled"}
              onClick={() => setActiveFolder("unfiled")}
              onDragOver={(e) => onFolderDragOver(e, "unfiled")}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onFolderDrop(e, "unfiled")}
              icon={<Folder className="size-4" />}
              label="Unfiled"
              count={countFor("unfiled")}
            />
            {folders.map((f) => (
              <FolderItem
                key={f.id}
                active={activeFolder === f.id}
                dropActive={dragOver === f.id}
                onClick={() => setActiveFolder(f.id)}
                onDragOver={(e) => onFolderDragOver(e, f.id)}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onFolderDrop(e, f.id)}
                icon={<Folder className="size-4 text-primary" />}
                label={f.name}
                count={countFor(f.id)}
                onRename={() => renameFolder(f.id)}
                onDelete={() => deleteFolder(f.id)}
              />
            ))}
          </ul>
          <div className="mt-3 flex gap-1 px-1">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createFolder()}
              placeholder="New folder…"
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={createFolder}>
              <FolderPlus className="size-4" />
            </Button>
          </div>
          <p className="mt-3 px-2 text-[11px] leading-snug text-muted-foreground">
            Tip: select words with the checkboxes, then drag any selected row onto a folder.
          </p>
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search words, definitions…" className="pl-9" />
            </div>
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/60 px-3 py-1.5 text-sm">
                <span>{selectedCount} selected</span>
                <Select onValueChange={(v) => moveWordsToFolder(Array.from(selected), v === "__none__" ? null : v)}>
                  <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Move to folder…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unfiled</SelectItem>
                    {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X className="size-4" /></Button>
              </div>
            )}
          </div>

          <div className="paper-card overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">No words here yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-3">
                        <Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectAll} />
                      </th>
                      <th className="w-6 px-1 py-3"></th>
                      <th className="px-4 py-3">Word</th>
                      <th className="px-4 py-3">Definition</th>
                      <th className="px-4 py-3">Translation</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3">Next review</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((w) => {
                      const stage = getStage(w.repetitions);
                      const isSel = selected.has(w.id);
                      return (
                        <tr
                          key={w.id}
                          draggable
                          onDragStart={(e) => onWordDragStart(e, w.id)}
                          className={
                            "border-b border-border/60 last:border-0 transition-colors " +
                            (isSel ? "bg-primary/5 " : "hover:bg-muted/30 ") +
                            "cursor-grab active:cursor-grabbing"
                          }
                        >
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={isSel} onCheckedChange={() => toggleSelect(w.id)} />
                          </td>
                          <td className="px-1 py-3 text-muted-foreground"><GripVertical className="size-4" /></td>
                          <td className="px-4 py-3">
                            <div className="font-serif text-base font-semibold">{w.word}</div>
                            {w.part_of_speech && <div className="text-xs italic text-muted-foreground">{w.part_of_speech}</div>}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-muted-foreground">{w.definition}</td>
                          <td className="px-4 py-3 text-muted-foreground">{w.translation}</td>
                          <td className="px-4 py-3">
                            <span
                              className={"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium " + stage.className}
                              title={stage.intervalLabel}
                            >
                              <span className="size-1.5 rounded-full" style={{ background: stage.swatch }} />
                              {stage.label}
                            </span>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FolderItem({
  active, dropActive, onClick, icon, label, count, onRename, onDelete, onDragOver, onDragLeave, onDrop,
}: {
  active: boolean; dropActive?: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; count: number;
  onRename?: () => void; onDelete?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <li
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={
        "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors " +
        (active ? "bg-primary/10 text-foreground " : "hover:bg-muted ") +
        (dropActive ? "ring-2 ring-primary ring-offset-1 ring-offset-background bg-primary/10 " : "")
      }
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
      {(onRename || onDelete) && (
        <span className="ml-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          {onRename && <button onClick={onRename} className="rounded p-0.5 hover:bg-background" title="Rename"><Pencil className="size-3" /></button>}
          {onDelete && <button onClick={onDelete} className="rounded p-0.5 text-destructive hover:bg-background" title="Delete folder"><Trash2 className="size-3" /></button>}
        </span>
      )}
    </li>
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
