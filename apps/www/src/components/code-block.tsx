export function CodeBlock({
  code,
  lang,
  filename,
}: {
  code: string;
  lang: string;
  filename: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-raised">
        <span className="text-xs text-muted font-mono">{filename}</span>
        <span className="text-[10px] text-muted/60 font-mono uppercase">{lang}</span>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-[13px] leading-6 font-mono text-muted">{code}</code>
      </pre>
    </div>
  );
}
