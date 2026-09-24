/**
 * DKIM / DMARC check on Gmail's Authentication-Results header.
 *
 * SPF alone is not enough (it checks the envelope sender, not the visible
 * From domain), so DKIM or DMARC must pass for a "bank" email to be trusted.
 */
export function checkEmailAuth(authResults: string): { passed: boolean; details: string } {
  const lower = authResults.toLowerCase();

  const dkim = /dkim=(\w+)/.exec(lower)?.[1] ?? "none";
  const spf = /spf=(\w+)/.exec(lower)?.[1] ?? "none";
  const dmarc = /dmarc=(\w+)/.exec(lower)?.[1] ?? "none";

  if (dkim !== "pass" && dmarc !== "pass") {
    const failures = [];
    if (dkim === "fail") failures.push("DKIM");
    if (spf === "fail") failures.push("SPF");
    if (dmarc === "fail") failures.push("DMARC");
    return {
      passed: false,
      details: `Email authentication failed: ${failures.join(", ")} failed (dkim=${dkim}, spf=${spf}, dmarc=${dmarc}). Email may be spoofed.`,
    };
  }

  return { passed: true, details: `Email authentication passed (dkim=${dkim}, spf=${spf}, dmarc=${dmarc})` };
}
