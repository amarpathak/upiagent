"use client";

import { useState } from "react";

export function CodeBlock({
  code,
  lang,
  filename,
}: {
  code: string;
  lang: string;
  filename: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden group">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-raised/50">
        <span className="text-[11px] text-muted/60 font-mono">{filename}</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted/30 font-mono uppercase">{lang}</span>
          <button
            onClick={copy}
            className="text-[10px] text-muted/40 font-mono hover:text-foreground/70 transition-colors"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>
      <pre className="p-5 overflow-x-auto">
        <code className="text-[13px] leading-7 font-mono text-foreground/60">{code}</code>
      </pre>
    </div>
  );
}
