import type { UserProfile, RecommendationResult } from '../types/recommendation';

// ============================================================
// LLM ENHANCEMENT SERVICE
// ============================================================
// Optional LLM layer for semantic skill extraction, re-ranking,
// and personalized explanation generation.
//
// Uses a LOCAL Ollama instance by default (runs fully offline,
// no API key needed). Ollama exposes an OpenAI-compatible API at
// http://localhost:11434/v1, so the request shape is identical.
//
// To switch back to OpenAI, set:
//   VITE_LLM_BASE_URL=https://api.openai.com/v1
//   VITE_LLM_MODEL=gpt-4o-mini
//   VITE_LLM_API_KEY=sk-...
// ============================================================

interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// Resolve LLM config from env, defaulting to local Ollama
function resolveConfig(): LLMConfig {
  const baseUrl = (import.meta.env.VITE_LLM_BASE_URL as string) || 'http://localhost:11434/v1';
  const apiKey = (import.meta.env.VITE_LLM_API_KEY as string) || 'ollama';
  const model = (import.meta.env.VITE_LLM_MODEL as string) || 'llama3.2:3b';
  return { baseUrl, apiKey, model };
}

export class LLMEnhancementService {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private enabled: boolean;

  constructor(baseUrl?: string, apiKey?: string, model?: string) {
    const config = resolveConfig();
    this.baseUrl = baseUrl || config.baseUrl;
    this.apiKey = apiKey || config.apiKey;
    this.model = model || config.model;

    // Providers that need a real secret are gated on having one.
    // Ollama works with any non-empty placeholder, so this stays on by default.
    this.enabled = !!this.apiKey;
  }

  /** Quick check that the LLM backend is reachable */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/models`, {
        signal: AbortSignal.timeout(3000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Shared completion helper — works for both Ollama and OpenAI
  private async complete(messages: { role: string; content: string }[], temperature = 0.2): Promise<string | null> {
    if (!this.enabled) return null;

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          stream: false
        })
      });

      if (!response.ok) {
        console.error('LLM request failed:', response.status, await response.text());
        return null;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content ?? null;
    } catch (error) {
      console.error('LLM request failed:', error);
      return null;
    }
  }

  // ============================================================
  // SEMANTIC SKILL EXTRACTION
  // ============================================================
  // Goes beyond keyword matching to understand context from resume text
  async extractSkillsSemantically(resumeText: string): Promise<string[]> {
    const content = await this.complete([
      {
        role: 'user',
        content: `
          Extract the technical and soft skills from the following resume text.
          Return ONLY a JSON array of strings, no explanations.
          Normalize common aliases (e.g., "React.js" -> "React", "Javascript" -> "JavaScript").
          Resume Text:
          "${resumeText.slice(0, 2000)}"
        `
      }
    ], 0.1);

    if (!content) return [];
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as string[];
      } catch {
        return [];
      }
    }
    return [];
  }

  // ============================================================
  // EXPLANATION GENERATION
  // ============================================================
  // Generates a natural language, personalized paragraph for why an internship matches
  async generatePersonalizedExplanation(
    userProfile: UserProfile,
    internshipTitle: string,
    company: string,
    baseExplanation: string
  ): Promise<string> {
    if (!this.enabled) return baseExplanation;

    const prompt = `
      You are an expert career advisor.
      The student's profile: Skills: [${userProfile.skills.join(', ')}], University: ${userProfile.university || 'N/A'}, Course: ${userProfile.course || 'N/A'}.
      They are looking at an internship: "${internshipTitle}" at "${company}".
      The algorithm provided this base explanation: "${baseExplanation}".

      Rewrite this into a highly encouraging, personalized 1-2 sentence explanation for the student, highlighting why they are a great fit based on their specific skills. Keep it professional but warm.
    `;

    const content = await this.complete([{ role: 'user', content: prompt }], 0.7);
    return content?.trim() || baseExplanation;
  }

  // ============================================================
  // RE-RANKING
  // ============================================================
  // Uses LLM to re-rank the top deterministic results for better semantic fit
  async reRankTopResults(
    userProfile: UserProfile,
    results: RecommendationResult[]
  ): Promise<RecommendationResult[]> {
    if (!this.enabled || results.length === 0) return results;

    // Only re-rank the top 10 to save tokens and time
    const topResults = results.slice(0, 10);
    const rest = results.slice(10);

    const internshipsForPrompt = topResults.map((r, i) =>
      `[${i + 1}] Title: ${r.internship.title}, Company: ${r.internship.company}, Skills Required: ${r.internship.skills.join(', ')}, Initial Score: ${r.score.totalScore}`
    ).join('\n');

    const prompt = `
      I have a student profile with skills: [${userProfile.skills.join(', ')}] and preferences: ${userProfile.preferredWorkMode?.join(', ') || 'Any'}.
      Here are the top 10 internships they matched with, initially scored by a deterministic algorithm:
      ${internshipsForPrompt}

      Please act as a semantic re-ranker.
      Return ONLY a JSON array of the indices (1-based) representing the new optimal order (best to worst fit) based on semantic relevance of the student's skills to the internship's core requirements.
      If the current order is already perfect, return the same order.
    `;

    const content = await this.complete([{ role: 'user', content: prompt }], 0.2);
    if (!content) return results;

    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const newOrder = JSON.parse(match[0]) as number[];
        const reranked = newOrder
          .filter(idx => idx >= 1 && idx <= topResults.length)
          .map(idx => topResults[idx - 1]);

        // If LLM returned valid order, use it; otherwise fallback to original
        if (reranked.length === topResults.length) {
          return [...reranked, ...rest];
        }
      } catch {
        return results;
      }
    }

    return results;
  }
}

export const llmEnhancementService = new LLMEnhancementService();
