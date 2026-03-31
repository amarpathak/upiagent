export function SecurityLayer({
  num,
  name,
  desc,
}: {
  num: string;
  name: string;
  desc: string;
}) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-lg border border-border bg-surface hover:border-accent/20 transition-colors">
      <div className="w-8 h-8 rounded-md border border-border bg-surface-raised flex items-center justify-center font-mono text-xs text-muted group-hover:text-accent group-hover:border-accent/30 transition-colors shrink-0">
        {num}
      </div>
      <div>
        <div className="text-sm font-medium mb-0.5 text-foreground">{name}</div>
        <p className="text-xs text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
