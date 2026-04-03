export { createVerificationSession } from "./session.js";
export { extractUtrFromText, extractUtrFromImage, normalizeUtr } from "./utr-parser.js";
export { InMemoryUtrStore, type UtrStore } from "./utr-store.js";
export type {
  VerificationSession,
  VerificationSessionConfig,
  SessionStatus,
  PendingUtr,
  UtrCandidate,
  UtrSource,
  UtrPatternSource,
} from "./types.js";
