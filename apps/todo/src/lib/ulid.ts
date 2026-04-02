import { ulid as generate } from "ulid";

export function ulid(): string {
  return generate();
}
