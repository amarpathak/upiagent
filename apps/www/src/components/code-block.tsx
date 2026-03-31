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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden group">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-raised">
        <span className="text-xs text-muted font-mono">{filename}</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted/40 font-mono uppercase">{lang}</span>
          <button
            onClick={handleCopy}
            className="text-[10px] text-muted/40 font-mono hover:text-foreground transition-colors"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-[13px] leading-6 font-mono text-foreground/70">{code}</code>
      </pre>
    </div>
  );
}
