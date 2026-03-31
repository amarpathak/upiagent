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
    <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-surface hover:border-accent/20 transition-colors">
      <div className="font-mono text-xs text-accent shrink-0 pt-0.5">{num}</div>
      <div>
        <div className="text-sm font-semibold mb-0.5">{name}</div>
        <p className="text-xs text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
