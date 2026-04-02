"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import type { Todo } from "./todo-item";

interface ExpandResult {
  subtasks: string[];
  question: string;
}

interface ExpandPanelProps {
  todo: Todo;
  onClose: () => void;
  onSave: (todoId: string, subtasks: string[]) => void;
}

export function ExpandPanel({ todo, onClose, onSave }: ExpandPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExpandResult | null>(null);
  const [accepted, setAccepted] = useState<boolean[]>([]);

  async function runExpand() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/todos/${todo.id}/expand`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Expand failed");
      }
      const data: ExpandResult = await res.json();
      setResult(data);
      setAccepted(new Array(data.subtasks.length).fill(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runExpand();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo.id]);

  function handleSave() {
    if (!result) return;
    const chosen = result.subtasks.filter((_, i) => accepted[i]);
    onSave(todo.id, chosen);
    onClose();
  }

  return (
    <div className="flex flex-col h-full border-l border-border bg-card p-5 gap-5 w-72 shrink-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-1">Expanding</p>
          <p className="text-sm font-medium truncate">{todo.text}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground">Thinking…</p>
      )}

      {error && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={runExpand}>Retry</Button>
        </div>
      )}

      {result && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Subtasks</p>
            {result.subtasks.map((sub, i) => (
              <label key={i} className="flex items-start gap-2 text-sm cursor-pointer leading-snug">
                <Checkbox
                  checked={accepted[i]}
                  onCheckedChange={(checked) => {
                    const next = [...accepted];
                    next[i] = !!checked;
                    setAccepted(next);
                  }}
                  className="mt-0.5 shrink-0"
                />
                <span>{sub}</span>
              </label>
            ))}
          </div>

          <div className="border border-border rounded-md p-3 bg-muted/40">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono mb-1.5">Question</p>
            <p className="text-xs leading-relaxed">{result.question}</p>
          </div>

          <div className="flex gap-2 mt-auto">
            <Button onClick={handleSave} size="sm" className="flex-1">Save</Button>
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}
