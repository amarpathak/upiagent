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
    <div className="group flex items-start gap-4 p-5 rounded-xl border border-border bg-surface hover:border-accent-blue/20 hover:bg-accent-blue/[0.02] transition-all duration-300">
      <div className="w-9 h-9 rounded-lg border border-border bg-surface-raised flex items-center justify-center font-mono text-[11px] text-muted/60 group-hover:text-accent-blue group-hover:border-accent-blue/20 transition-all duration-300 shrink-0">
        {num}
      </div>
      <div>
        <div className="text-[14px] font-medium mb-1 text-foreground/90">{name}</div>
        <p className="text-[13px] text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
