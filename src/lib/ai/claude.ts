import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

import { AnalysisError, MealAnalysisSchema, SYSTEM_PROMPT, toMealAnalysis, userText, type AnalyzeInput } from './shared';

export const CLAUDE_MODEL = 'claude-opus-5-5';
const NAME = 'Claude';

// Reused across calls; rebuilt when the key in Settings changes.
let cached: { apiKey: string; client: Anthropic } | null = null;

function getClient(apiKey: string): Anthropic {
  if (!apiKey) {
    throw new AnalysisError('missing_key', 'No Anthropic API key yet. Add one in Goals & settings, then try again.');
  }
  if (cached?.apiKey !== apiKey) {
    cached = { apiKey, client: new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 }) };
  }
  return cached.client;
}

export async function analyzeWithClaude(apiKey: string, input: AnalyzeInput, signal?: AbortSignal) {
  const client = getClient(apiKey);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.imageBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: input.imageBase64 } });
  }
  content.push({ type: 'text', text: userText({ ...input, hasPhoto: Boolean(input.imageBase64) }) });

  let response;
  try {
    response = await client.beta.messages.parse(
      {
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: betaZodOutputFormat(MealAnalysisSchema) },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      },
      { signal },
    );
  } catch (error) {
    throw toAnalysisError(error);
  }

  if (response.stop_reason === 'refusal') {
    throw new AnalysisError('refused', "Claude couldn't analyze this one. Try a different photo or describe the meal instead.");
  }
  const parsed = response.parsed_output;
  if (response.stop_reason === 'max_tokens' || !parsed) {
    throw new AnalysisError('api', 'Claude returned an incomplete answer. Please try again.');
  }
  return toMealAnalysis(parsed, NAME);
}

function toAnalysisError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AnalysisError('auth', 'Your Anthropic API key was rejected. Check it in Goals & settings.');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AnalysisError('rate_limit', 'Too many requests right now. Wait a moment and try again.');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AnalysisError('network', "Couldn't reach Claude. Check your connection and try again.");
  }
  if (error instanceof Anthropic.APIError) {
    return new AnalysisError('api', `Claude returned an error (${error.status ?? 'unknown'}). Please try again.`);
  }
  return new AnalysisError('api', error instanceof Error ? error.message : 'Something went wrong.');
}
