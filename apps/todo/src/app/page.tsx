"use client";

import { useState, useEffect } from "react";
import { TodoInput } from "@/components/todo-input";
import { TodoList } from "@/components/todo-list";
import { ExpandPanel } from "@/components/expand-panel";
import type { Todo } from "@/components/todo-item";

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [expandingId, setExpandingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/todos")
      .then((r) => r.json())
      .then(setTodos);
  }, []);

  async function handleAdd(text: string) {
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const todo: Todo = await res.json();
    setTodos((prev) => [todo, ...prev]);
  }

  async function handleToggle(id: string, done: boolean) {
    const status = done ? "done" : "open";
    const res = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const updated: Todo = await res.json();
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSaveSubtasks(todoId: string, subtasks: string[]) {
    const res = await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtasks: subtasks.map((text) => ({ text, done: false })) }),
    });
    const updated: Todo = await res.json();
    setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
  }

  const expandingTodo = todos.find((t) => t.id === expandingId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 max-w-lg mx-auto px-6 py-8 gap-5">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-medium">Todo</h1>
          <a href="/profile" className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150">
            Profile
          </a>
        </div>
        <TodoInput onAdd={handleAdd} />
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <TodoList
            todos={todos}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onExpand={setExpandingId}
          />
        </div>
      </div>

      {expandingTodo && (
        <ExpandPanel
          todo={expandingTodo}
          onClose={() => setExpandingId(null)}
          onSave={handleSaveSubtasks}
        />
      )}
    </div>
  );
}
