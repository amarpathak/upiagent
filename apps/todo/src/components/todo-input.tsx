"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface TodoInputProps {
  onAdd: (text: string) => void;
}

export function TodoInput({ onAdd }: TodoInputProps) {
  const [value, setValue] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  }

  return (
    <Input
      placeholder="Add a todo…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className="w-full border-0 border-b rounded-none px-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/50"
      autoFocus
    />
  );
}
