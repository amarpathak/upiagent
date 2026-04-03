/**
 * Step Logger — captures every decision in the verification pipeline.
 * Collected steps are returned with the verification result for
 * observability and debugging.
 */

export interface VerifyStep {
  step: string;
  ts: string;
  [key: string]: unknown;
}

export class StepLogger {
  private steps: VerifyStep[] = [];

  log(step: string, data: Record<string, unknown> = {}) {
    this.steps.push({ step, ts: new Date().toISOString(), ...data });
  }

  getSteps(): VerifyStep[] {
    return this.steps;
  }
}
