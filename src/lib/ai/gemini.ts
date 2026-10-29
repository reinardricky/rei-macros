import { ApiError, GoogleGenAI, ThinkingLevel, type Part } from '@google/genai/web';
import { z } from 'zod';

import { AnalysisError, MealAnalysisSchema, SYSTEM_PROMPT, toMealAnalysis, userText, type AnalyzeInput } from './shared';

// Tried in order. Each model has its own free-tier quota, and the free tier is
// often overloaded, so when the first is busy or out of quota we fall back.
export const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'] as const;
export const GEMINI_MODEL = GEMINI_MODELS[0];
const NAME = 'Gemini';
const TIMEOUT_MS = 60_000;

// Gemini accepts a subset of JSON Schema; drop the `$schema` marker Zod adds.
const { $schema: _ignored, ...RESPONSE_SCHEMA } = z.toJSONSchema(MealAnalysisSchema);

export function hasGeminiKey(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GEMINI_API_KEY);
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  // Must be read with dot notation so Expo inlines it at build time.
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new AnalysisError(
      'missing_key',
      'No Gemini API key found. Add EXPO_PUBLIC_GEMINI_API_KEY to the .env file, then restart Expo.',
    );
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export async function analyzeWithGemini(input: AnalyzeInput, signal?: AbortSignal) {
  const parts: Part[] = [];
  if (input.imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: input.imageBase64 } });
  parts.push({ text: userText(input) });

  let lastError: AnalysisError | null = null;
  for (const model of GEMINI_MODELS) {
    try {
      const text = await generate(model, parts, signal);
      let parsed;
      try {
        parsed = MealAnalysisSchema.parse(JSON.parse(text));
      } catch {
        throw new AnalysisError('api', 'Gemini returned an answer the app could not read. Please try again.');
      }
      return toMealAnalysis(parsed, NAME);
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = toAnalysisError(error);
      // Only a busy or exhausted model is worth retrying on the next one.
      if (lastError.kind !== 'rate_limit' && lastError.kind !== 'network') throw lastError;
    }
  }
  throw lastError ?? new AnalysisError('api', 'Something went wrong.');
}

async function generate(model: string, parts: Part[], signal?: AbortSignal): Promise<string> {
  // One signal that fires on the caller's cancel or on our own timeout.
  // (A flag, not abort(reason): React Native's AbortController doesn't carry reasons.)
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onCancel = () => controller.abort();
  signal?.addEventListener('abort', onCancel);
  try {
    const response = await getClient().models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        abortSignal: controller.signal,
      },
    });
    const text = response.text;
    if (!text) {
      const reason = response.promptFeedback?.blockReason ?? response.candidates?.[0]?.finishReason;
      throw new AnalysisError(
        'refused',
        reason
          ? `Gemini couldn't analyze this one (${reason}). Try a different photo or describe the meal instead.`
          : 'Gemini returned an empty answer. Please try again.',
      );
    }
    return text;
  } catch (error) {
    throw timedOut ? new TimeoutError() : error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCancel);
  }
}

class TimeoutError extends Error {
  constructor() {
    super('Gemini timed out');
    this.name = 'TimeoutError';
  }
}

function toAnalysisError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  if (error instanceof TimeoutError) {
    return new AnalysisError(
      'network',
      "Gemini didn't answer within a minute. Google's free tier is often busy; please try again in a bit.",
    );
  }
  if (error instanceof ApiError) {
    const { status, message } = error;
    if (status === 401 || status === 403 || (status === 400 && /api key/i.test(message))) {
      return new AnalysisError('auth', 'Your Gemini API key was rejected. Check EXPO_PUBLIC_GEMINI_API_KEY in .env.');
    }
    if (status === 429) {
      const retry = /retry in ([\dhms.]+)/i.exec(message)?.[1];
      return new AnalysisError(
        'rate_limit',
        `You've used today's free Gemini requests.${retry ? ` Google says to try again in ${retry}.` : ' The quota resets at midnight Pacific time.'}`,
      );
    }
    if (status === 503 || status === 500 || status === 504) {
      return new AnalysisError('network', 'Gemini is overloaded right now (a Google-side problem). Please try again in a minute.');
    }
    return new AnalysisError('api', `Gemini returned an error (${status}). Please try again.`);
  }
  if (error instanceof Error && /network|fetch|connection/i.test(error.message)) {
    return new AnalysisError('network', "Couldn't reach Gemini. Check your connection and try again.");
  }
  return new AnalysisError('api', error instanceof Error ? error.message : 'Something went wrong.');
}
