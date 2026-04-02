/**
 * LLM Parsing Chain
 *
 * This module wires together:
 *   Prompt Template → LLM → Structured Output (Zod)
 *
 * LangChain calls this a "chain" — a pipeline where the output of each
 * step feeds into the next. Here's the flow:
 *
 *   1. Email data fills the prompt template placeholders
 *   2. The filled prompt goes to the LLM
 *   3. LangChain's structured output forces the LLM to respond in our Zod schema format
 *   4. The response is parsed and validated by Zod
 *   5. We get a type-safe ParsedPayment object back
 *
 * If any step fails (LLM hallucinates, Zod validation fails), we get a
 * clear error instead of silently bad data. This is critical for financial
 * verification.
 *
 * FDE concept: "Structured output" is the single most important LLM pattern
 * for enterprise applications. It bridges the gap between "AI generates text"
 * and "my app needs typed data." Every production LLM integration uses this.
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { paymentExtractionPrompt, sanitizeEmailForLlm } from "./prompts.js";
import { parsedPaymentSchema, type ParsedPayment } from "./schema.js";
import type { LlmConfig } from "./types.js";
import type { EmailMessage } from "../gmail/types.js";
import { ConfigError } from "../utils/errors.js";

/**
 * Creates the appropriate LLM instance based on the provider config.
 *
 * Why a factory function? Because OpenAI and Anthropic have different
 * constructor APIs. This function normalizes them behind LangChain's
 * BaseChatModel interface — the rest of our code doesn't care which
 * provider is being used.
 *
 * This is the "adapter pattern" — same interface, different implementations.
 */
function createLlmModel(config: LlmConfig): BaseChatModel {
  if (!config.model) {
    throw new ConfigError(
      'LLM model is required. Examples: "gemini-2.0-flash" (Gemini), "gpt-4o-mini" (OpenAI), "claude-sonnet-4-5-20250514" (Anthropic)'
    );
  }

  const temperature = config.temperature ?? 0;

  switch (config.provider) {
    case "openai":
      return new ChatOpenAI({
        apiKey: config.apiKey,
        model: config.model,
        temperature,
      });

    case "anthropic":
      return new ChatAnthropic({
        apiKey: config.apiKey,
        model: config.model,
        temperature,
      });

    case "gemini":
      return new ChatGoogleGenerativeAI({
        apiKey: config.apiKey,
        model: config.model,
        temperature,
      });

    case "openrouter":
      return new ChatOpenAI({
        apiKey: config.apiKey,
        model: config.model,
        temperature,
        configuration: { baseURL: "https://openrouter.ai/api/v1" },
      });

    default: {
      // TypeScript exhaustiveness check — if someone adds a new provider
      // to the LlmProvider type but forgets to handle it here, this line
      // will cause a compile error. Neat trick for union types.
      const _exhaustive: never = config.provider;
      throw new Error(`Unsupported LLM provider: ${_exhaustive}`);
    }
  }
}

/**
 * Creates the payment extraction chain.
 *
 * This is a LangChain "Runnable" — an object with an .invoke() method
 * that runs the full pipeline. The chain is reusable: create it once
 * with your config, then call it for each email.
 *
 * Under the hood, .withStructuredOutput() does something clever:
 * - For OpenAI: Uses "function calling" — a native API feature where the
 *   model is forced to output JSON matching a schema
 * - For Anthropic: Uses "tool use" — similar concept, different implementation
 *
 * Both approaches are more reliable than asking the LLM to "please respond
 * in JSON format" (which it might ignore or format incorrectly).
 */
export function createPaymentExtractionChain(
  config: LlmConfig,
  options?: { callbacks?: { handleLLMEnd: (output: any) => Promise<void> }[] },
) {
  const model = createLlmModel(config);

  // .withStructuredOutput() tells LangChain:
  // "Force the LLM to respond in this exact Zod schema format."
  //
  // The method name sounds simple, but it's doing a lot:
  // 1. Converts Zod schema → JSON Schema (what the LLM API understands)
  // 2. Passes the schema to the LLM's native structured output feature
  // 3. Parses the LLM's response back through Zod for validation
  // 4. Returns a typed object (not a string) — ParsedPayment
  const structuredModel = model.withStructuredOutput(parsedPaymentSchema, {
    // "name" identifies this schema in the LLM API call.
    // For OpenAI, this becomes the function name. For Anthropic, the tool name.
    name: "extract_payment",
  });

  // Chain the prompt template with the structured model.
  // .pipe() connects them: prompt output → model input → parsed output
  //
  // This is functional composition — same concept as Unix pipes:
  //   echo "data" | grep "pattern" | sort
  // becomes:
  //   prompt.pipe(structuredModel)
  return paymentExtractionPrompt.pipe(structuredModel);
}

/**
 * High-level function to parse an email into structured payment data.
 *
 * This is what the rest of upiagent calls. It handles:
 * - Creating the chain (could be cached for performance)
 * - Formatting the email data for the prompt
 * - Invoking the LLM
 * - Returning the validated result
 *
 * Returns null if the email couldn't be parsed (LLM error, validation failure).
 */
export async function parsePaymentEmail(
  email: EmailMessage,
  config: LlmConfig,
  options?: { callbacks?: { handleLLMEnd: (output: any) => Promise<void> }[] },
): Promise<ParsedPayment | null> {
  const chain = createPaymentExtractionChain(config);

  // Sanitize email content before sending to LLM to mitigate prompt injection.
  // The sanitizer removes known injection patterns, JSON-like content, and truncates.
  const { sanitizedSubject, sanitizedBody } = sanitizeEmailForLlm(email.subject, email.body);

  // Invoke the chain with the sanitized email data.
  // Callbacks are passed via invoke config (not model.bind) so they work
  // with all LangChain provider implementations.
  const result = await chain.invoke(
    {
      subject: sanitizedSubject,
      body: sanitizedBody,
      from: email.from,
    },
    options?.callbacks ? { callbacks: options.callbacks } : undefined,
  );

  // At this point, `result` is already validated by Zod.
  // If the LLM returned something that didn't match the schema,
  // .invoke() would have thrown an error (which the caller handles).
  return result as ParsedPayment;
}
