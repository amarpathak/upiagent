#!/usr/bin/env node

/**
 * Security Audit Dashboard Generator
 *
 * Usage:
 *   node generate-dashboard.mjs <findings.json> [--output dashboard.html]
 *
 * findings.json format:
 * {
 *   "project": "upiagent",
 *   "audit_date": "2026-04-01",
 *   "findings": [
 *     {
 *       "id": "CRITICAL-001",
 *       "severity": "critical",
 *       "category": "Payment Integrity",
 *       "title": "Dashboard verify route TOCTOU race condition",
 *       "location": "apps/dashboard/src/app/api/verify/route.ts:149-334",
 *       "description": "...",
 *       "impact": "...",
 *       "remediation": "...",
 *       "status": "open",
 *       "notes": ""
 *     }
 *   ]
 * }
 *
 * status values: "open" | "fixed" | "wontfix" | "in_progress" | "accepted_risk"
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const inputPath = args[0];
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : 'security-dashboard.html';

if (!inputPath) {
  console.error('Usage: node generate-dashboard.mjs <findings.json> [--output dashboard.html]');
  process.exit(1);
}

const data = JSON.parse(readFileSync(resolve(inputPath), 'utf-8'));
const { project = 'Project', audit_date = new Date().toISOString().split('T')[0], findings = [] } = data;

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const severityColors = {
  critical: { bg: '#dc2626', text: '#fff', bar: '#dc2626' },
  high: { bg: '#ea580c', text: '#fff', bar: '#ea580c' },
  medium: { bg: '#ca8a04', text: '#fff', bar: '#ca8a04' },
  low: { bg: '#2563eb', text: '#fff', bar: '#2563eb' },
  info: { bg: '#6b7280', text: '#fff', bar: '#6b7280' },
};
const statusIcons = {
  open: '\u{1f534}',
  in_progress: '\u{1f7e1}',
  fixed: '\u{1f7e2}',
  wontfix: '\u26aa',
  accepted_risk: '\u{1f7e0}',
};
const statusLabels = {
  open: 'Open',
  in_progress: 'In Progress',
  fixed: 'Fixed',
  wontfix: "Won't Fix",
  accepted_risk: 'Accepted Risk',
};

const sorted = [...findings].sort((a, b) =>
  (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)
);

// Stats
const total = findings.length;
const bySeverity = {};
const byStatus = {};
const byCategory = {};
for (const f of findings) {
  bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  byStatus[f.status] = (byStatus[f.status] || 0) + 1;
  byCategory[f.category] = (byCategory[f.category] || 0) + 1;
}
const fixed = byStatus.fixed || 0;
const progressPct = total > 0 ? Math.round((fixed / total) * 100) : 0;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function severityBadge(sev) {
  const c = severityColors[sev] || severityColors.info;
  return `<span class="badge" style="background:${c.bg};color:${c.text}">${sev.toUpperCase()}</span>`;
}

function statusBadge(status) {
  return `<span class="status-badge">${statusIcons[status] || '\u2753'} ${statusLabels[status] || status}</span>`;
}

function severityBar() {
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  return order
    .filter(s => bySeverity[s])
    .map(s => {
      const pct = ((bySeverity[s] / total) * 100).toFixed(1);
      const c = severityColors[s];
      return `<div class="bar-segment" style="width:${pct}%;background:${c.bar}" title="${s}: ${bySeverity[s]}">${bySeverity[s]}</div>`;
    })
    .join('');
}

function findingRows() {
  return sorted.map(f => `
    <tr class="finding-row" data-severity="${f.severity}" data-status="${f.status}" data-category="${escapeHtml(f.category)}">
      <td>${severityBadge(f.severity)}</td>
      <td><strong>${escapeHtml(f.id)}</strong></td>
      <td>
        <div class="finding-title">${escapeHtml(f.title)}</div>
        <div class="finding-meta">${escapeHtml(f.category)} &middot; <code>${escapeHtml(f.location)}</code></div>
      </td>
      <td>${statusBadge(f.status)}</td>
      <td>
        <details>
          <summary>Details</summary>
          <div class="finding-details">
            <p><strong>Description:</strong> ${escapeHtml(f.description)}</p>
            <p><strong>Impact:</strong> ${escapeHtml(f.impact)}</p>
            <p><strong>Remediation:</strong> ${escapeHtml(f.remediation)}</p>
            ${f.notes ? `<p><strong>Notes:</strong> ${escapeHtml(f.notes)}</p>` : ''}
          </div>
        </details>
      </td>
    </tr>
  `).join('');
}

function statCards() {
  const cards = [
    { label: 'Total Findings', value: total, color: '#a1a1aa' },
    { label: 'Critical', value: bySeverity.critical || 0, color: '#dc2626' },
    { label: 'High', value: bySeverity.high || 0, color: '#ea580c' },
    { label: 'Fixed', value: fixed, color: '#16a34a' },
    { label: 'Open', value: byStatus.open || 0, color: '#dc2626' },
  ];
  return cards.map(c => `
    <div class="stat-card">
      <div class="stat-value" style="color:${c.color}">${c.value}</div>
      <div class="stat-label">${c.label}</div>
    </div>
  `).join('');
}

function categoryBreakdown() {
  return Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `<div class="cat-row"><span>${escapeHtml(cat)}</span><span class="cat-count">${count}</span></div>`)
    .join('');
}

function filterButtons() {
  const severities = ['all', 'critical', 'high', 'medium', 'low', 'info'];
  const statuses = ['all', 'open', 'in_progress', 'fixed', 'wontfix', 'accepted_risk'];
  return `
    <div class="filter-group">
      <label>Severity:</label>
      ${severities.map(s => `<button class="filter-btn" data-filter="severity" data-value="${s}">${s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>`).join('')}
    </div>
    <div class="filter-group">
      <label>Status:</label>
      ${statuses.map(s => `<button class="filter-btn" data-filter="status" data-value="${s}">${s === 'all' ? 'All' : statusLabels[s] || s}</button>`).join('')}
    </div>
  `;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Security Audit — ${escapeHtml(project)}</title>
<style>
  :root { --bg: #09090b; --surface: #18181b; --border: #27272a; --text: #fafafa; --muted: #a1a1aa; --accent: #3b82f6; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
  h1 { font-size: 1.75rem; font-weight: 600; margin-bottom: 0.25rem; }
  .subtitle { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }

  /* Stats */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; text-align: center; }
  .stat-value { font-size: 2rem; font-weight: 700; font-family: 'Geist Mono', monospace; }
  .stat-label { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }

  /* Progress */
  .progress-section { margin-bottom: 2rem; }
  .progress-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.875rem; }
  .progress-bar { height: 8px; background: var(--surface); border-radius: 4px; overflow: hidden; border: 1px solid var(--border); }
  .progress-fill { height: 100%; background: #16a34a; border-radius: 4px; transition: width 0.3s; }

  /* Severity bar */
  .severity-bar { display: flex; height: 32px; border-radius: 6px; overflow: hidden; margin-bottom: 2rem; border: 1px solid var(--border); }
  .bar-segment { display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; color: #fff; min-width: 24px; }

  /* Category breakdown */
  .sidebar { display: grid; grid-template-columns: 1fr 280px; gap: 2rem; margin-bottom: 2rem; }
  .cat-section { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }
  .cat-section h3 { font-size: 0.875rem; color: var(--muted); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .cat-row { display: flex; justify-content: space-between; padding: 0.375rem 0; border-bottom: 1px solid var(--border); font-size: 0.875rem; }
  .cat-row:last-child { border-bottom: none; }
  .cat-count { font-family: 'Geist Mono', monospace; color: var(--muted); }

  /* Filters */
  .filters { margin-bottom: 1.5rem; }
  .filter-group { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .filter-group label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; min-width: 60px; }
  .filter-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
  .filter-btn:hover { border-color: var(--accent); }
  .filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }

  /* Table */
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 0.75rem; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
  td { padding: 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; font-size: 0.875rem; }
  tr:hover { background: rgba(255,255,255,0.02); }
  .badge { padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.03em; }
  .status-badge { font-size: 0.8rem; white-space: nowrap; }
  .finding-title { font-weight: 500; }
  .finding-meta { color: var(--muted); font-size: 0.75rem; margin-top: 0.25rem; }
  .finding-meta code { background: var(--bg); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.7rem; }
  .finding-details { padding: 0.75rem; background: var(--bg); border-radius: 6px; margin-top: 0.5rem; font-size: 0.8rem; }
  .finding-details p { margin-bottom: 0.5rem; }
  .finding-details p:last-child { margin-bottom: 0; }
  details summary { cursor: pointer; color: var(--accent); font-size: 0.8rem; }

  .hidden { display: none; }

  @media (max-width: 768px) {
    .sidebar { grid-template-columns: 1fr; }
    .stats { grid-template-columns: repeat(3, 1fr); }
  }
</style>
</head>
<body>
<div class="container">
  <h1>Security Audit &mdash; ${escapeHtml(project)}</h1>
  <div class="subtitle">Audited ${escapeHtml(audit_date)} &middot; ${total} findings &middot; ${progressPct}% resolved</div>

  <div class="stats">${statCards()}</div>

  <div class="progress-section">
    <div class="progress-header">
      <span>Resolution Progress</span>
      <span>${fixed}/${total} fixed (${progressPct}%)</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>
  </div>

  <div class="severity-bar">${severityBar()}</div>

  <div class="sidebar">
    <div>
      <div class="filters">${filterButtons()}</div>
      <table>
        <thead><tr><th>Severity</th><th>ID</th><th>Finding</th><th>Status</th><th></th></tr></thead>
        <tbody>${findingRows()}</tbody>
      </table>
    </div>
    <div class="cat-section">
      <h3>By Category</h3>
      ${categoryBreakdown()}
    </div>
  </div>
</div>

<script>
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.filter;
    document.querySelectorAll(\`.filter-btn[data-filter="\${group}"]\`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  });
});

// Set "All" as default active
document.querySelectorAll('.filter-btn[data-value="all"]').forEach(b => b.classList.add('active'));

function applyFilters() {
  const sevBtn = document.querySelector('.filter-btn[data-filter="severity"].active');
  const statBtn = document.querySelector('.filter-btn[data-filter="status"].active');
  const sev = sevBtn ? sevBtn.dataset.value : 'all';
  const stat = statBtn ? statBtn.dataset.value : 'all';

  document.querySelectorAll('.finding-row').forEach(row => {
    const matchSev = sev === 'all' || row.dataset.severity === sev;
    const matchStat = stat === 'all' || row.dataset.status === stat;
    row.classList.toggle('hidden', !(matchSev && matchStat));
  });
}
</script>
</body>
</html>`;

writeFileSync(resolve(outputPath), html, 'utf-8');
console.log(`Dashboard written to: ${resolve(outputPath)}`);
console.log(`${total} findings | ${fixed} fixed | ${total - fixed} remaining`);
