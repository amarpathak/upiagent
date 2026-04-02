"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export interface Fact {
  id: string;
  key: string;
  value: string;
}

interface FactItemProps {
  fact: Fact;
  onDelete: (id: string) => void;
}

export function FactItem({ fact, onDelete }: FactItemProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <span className="text-xs font-mono text-muted-foreground w-24 shrink-0 truncate">{fact.key}</span>
      <span className="flex-1 text-sm truncate">{fact.value}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(fact.id)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
