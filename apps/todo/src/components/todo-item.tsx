"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Sparkles, Trash2 } from "lucide-react";

export interface Todo {
  id: string;
  text: string;
  status: string;
  subtasks: string;
  created_at: number;
  expanded_at: number | null;
}

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onExpand: (id: string) => void;
}

export function TodoItem({ todo, onToggle, onDelete, onExpand }: TodoItemProps) {
  const done = todo.status === "done";

  return (
    <div className={`flex items-center gap-3 py-2.5 group ${done ? "opacity-35" : ""}`}>
      <Checkbox
        checked={done}
        onCheckedChange={(checked) => onToggle(todo.id, !!checked)}
        className="shrink-0"
      />
      <span className={`flex-1 text-sm leading-snug ${done ? "line-through" : ""}`}>
        {todo.text}
      </span>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => onExpand(todo.id)}
          title="Expand with AI"
        >
          <Sparkles className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(todo.id)}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
