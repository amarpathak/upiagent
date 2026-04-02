"use client";

import { TodoItem, type Todo } from "./todo-item";

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onExpand: (id: string) => void;
}

export function TodoList({ todos, onToggle, onDelete, onExpand }: TodoListProps) {
  const open = todos.filter((t) => t.status === "open");
  const done = todos.filter((t) => t.status === "done");

  if (todos.length === 0) {
    return <p className="text-xs text-muted-foreground py-6 text-center">Nothing here.</p>;
  }

  return (
    <div className="flex flex-col">
      {open.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} onExpand={onExpand} />
      ))}
      {done.length > 0 && open.length > 0 && (
        <div className="border-t border-border my-2" />
      )}
      {done.map((todo) => (
        <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} onExpand={onExpand} />
      ))}
    </div>
  );
}
