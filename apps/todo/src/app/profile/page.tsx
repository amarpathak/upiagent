"use client";

import { useState, useEffect } from "react";
import { FactItem, type Fact } from "@/components/fact-item";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/facts")
      .then((r) => r.json())
      .then(setFacts);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!key.trim() || !value.trim()) {
      setError("Both fields required");
      return;
    }
    const res = await fetch("/api/facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      setError("Failed to add");
      return;
    }
    const fact: Fact = await res.json();
    setFacts((prev) => [...prev, fact]);
    setKey("");
    setValue("");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/facts/${id}`, { method: "DELETE" });
    setFacts((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-sm font-medium">Profile</h1>
          <p className="text-xs text-muted-foreground mt-0.5">What AI knows about you</p>
        </div>
        <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150">
          ← Back
        </a>
      </div>

      <div className="flex flex-col mb-8">
        {facts.length === 0 && (
          <p className="text-xs text-muted-foreground py-4">No facts yet.</p>
        )}
        {facts.map((fact) => (
          <FactItem key={fact.id} fact={fact} onDelete={handleDelete} />
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Add a fact</p>
        <div className="flex gap-2">
          <Input
            placeholder="key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-28 text-sm"
          />
          <Input
            placeholder="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 text-sm"
          />
          <Button type="submit" size="sm">Add</Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    </div>
  );
}
