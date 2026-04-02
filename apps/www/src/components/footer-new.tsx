export function FooterNew() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-surface-raised border-t border-border relative overflow-hidden">
      {/* Giant wordmark */}
      <div className="relative px-6 pt-10 pb-0 select-none pointer-events-none" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <span className="block font-mono font-bold text-[clamp(4rem,15vw,11rem)] leading-[0.85] tracking-[-0.06em] text-foreground/[0.04]">
            upi
            <br />
            agent
          </span>
        </div>
      </div>

      {/* Link columns */}
      <div className="relative px-6 pb-12 pt-10">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-end gap-x-14 gap-y-8">
          {/* Product */}
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[10px] text-muted uppercase tracking-[0.2em]">
              Product
            </span>
            <a href="/#how" className="text-[13px] text-muted-light hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="/#demo" className="text-[13px] text-muted-light hover:text-foreground transition-colors">
              Live demo
            </a>
            <a href="/docs" className="text-[13px] text-muted-light hover:text-foreground transition-colors">
              Docs
            </a>
            <a href="/#pricing" className="text-[13px] text-muted-light hover:text-foreground transition-colors">
              Pricing
            </a>
          </div>

          {/* Source */}
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[10px] text-muted uppercase tracking-[0.2em]">
              Source
            </span>
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="text-[13px] text-muted-light hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/upiagent"
              className="text-[13px] text-muted-light hover:text-foreground transition-colors"
            >
              npm
            </a>
            <a
              href="https://github.com/AmarPathak/upiagent/issues"
              className="text-[13px] text-muted-light hover:text-foreground transition-colors"
            >
              Issues
            </a>
          </div>

          {/* Connect */}
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[10px] text-muted uppercase tracking-[0.2em]">
              Connect
            </span>
            <a
              href="https://github.com/AmarPathak"
              className="text-[13px] text-muted-light hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/AmarPathak"
              className="text-[13px] text-muted-light hover:text-foreground transition-colors"
            >
              X / Twitter
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative px-6 py-5 border-t border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted">
            MIT &middot; {year}
          </span>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/AmarPathak/upiagent"
              className="text-muted hover:text-foreground transition-colors"
              aria-label="GitHub"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <a
              href="https://x.com/AmarPathak"
              className="text-muted hover:text-foreground transition-colors"
              aria-label="X / Twitter"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
