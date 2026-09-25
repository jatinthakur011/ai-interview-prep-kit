/** Provider-agnostic LLM interface. Swap Gemini for Groq/OpenRouter by writing one new adapter. */
export interface LLMRequest {
  system: string;
  user: string;
  temperature?: number;
}

export interface LLMClient {
  /** Returns the raw text of the model's reply (expected to be JSON). */
  generateJson(req: LLMRequest): Promise<string>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "LLMError";
  }
}
