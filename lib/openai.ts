/**
 * OpenAI Client Wrapper
 * Provides functions for sentiment analysis and command parsing
 */

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const MODEL = 'gpt-4o-mini'; // Cost-efficient model

export interface ParsedCommand {
  originalQuery: string;
  action: 'filter' | 'select' | 'compare' | 'search';
  params: Record<string, unknown>;
  confidence: number;
}

/**
 * Get API key from environment
 */
function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

/**
 * Check if OpenAI API is available
 */
export function isOpenAIAvailable(): boolean {
  return !!getApiKey();
}

/**
 * Analyze sentiment of headlines
 * Returns a score from -1 (very negative) to 1 (very positive)
 */
export async function analyzeSentiment(headlines: string[]): Promise<{ sentiment: number; error?: string }> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('[OpenAI] No API key configured');
    return { sentiment: 0, error: 'OpenAI API key not configured' };
  }

  if (headlines.length === 0) {
    return { sentiment: 0 };
  }

  try {
    const headlineList = headlines.slice(0, 20).map((h, i) => `${i + 1}. ${h}`).join('\n');

    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a financial sentiment analyzer. Analyze the overall sentiment of news headlines about a company.
Return ONLY a JSON object with a single "sentiment" field containing a number from -1 (very negative/bearish) to 1 (very positive/bullish).
Examples:
- Headlines about layoffs, lawsuits, failures → negative (-0.3 to -1)
- Headlines about funding, partnerships, growth → positive (0.3 to 1)
- Neutral news → around 0
Be precise and consider the overall tone.`,
          },
          {
            role: 'user',
            content: `Analyze the sentiment of these headlines:\n\n${headlineList}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAI] Sentiment request failed:', response.status, errorText);

      if (response.status === 401) {
        return { sentiment: 0, error: 'Invalid OpenAI API key' };
      }
      if (response.status === 429) {
        return { sentiment: 0, error: 'OpenAI rate limit exceeded' };
      }
      return { sentiment: 0, error: `OpenAI error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const sentiment = Math.max(-1, Math.min(1, parseFloat(parsed.sentiment) || 0));
        return { sentiment };
      }
    } catch (parseError) {
      console.error('[OpenAI] Failed to parse sentiment response:', content);
    }

    return { sentiment: 0, error: 'Failed to parse sentiment' };
  } catch (error: any) {
    console.error('[OpenAI] Sentiment error:', error);
    return { sentiment: 0, error: error.message || 'Sentiment analysis failed' };
  }
}

/**
 * Parse a natural language command into structured action
 */
export async function parseCommand(query: string): Promise<{ command: ParsedCommand | null; error?: string }> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('[OpenAI] No API key configured');
    // Fall back to simple keyword matching
    return { command: fallbackParse(query) };
  }

  try {
    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a command parser for a robotics company intelligence platform.
Parse user commands and return a JSON object with: { action, params, confidence }

Available actions:
1. "filter" - Filter companies by criteria
   params: { field?: string, operator?: "gt"|"lt"|"eq"|"contains", value?: number|string, tags?: string[] }

2. "select" - Select/focus on a specific company
   params: { companyName: string }

3. "compare" - Compare two or more companies
   params: { companies: string[] }

4. "search" - General search query
   params: { query: string }

Examples:
- "show humanoid companies" → { action: "filter", params: { tags: ["humanoid"] }, confidence: 0.95 }
- "companies with funding over $100M" → { action: "filter", params: { field: "funding", operator: "gt", value: 100000000 }, confidence: 0.9 }
- "select Figure AI" → { action: "select", params: { companyName: "Figure AI" }, confidence: 0.98 }
- "compare Boston Dynamics and Figure" → { action: "compare", params: { companies: ["Boston Dynamics", "Figure AI"] }, confidence: 0.92 }
- "warehouse robots" → { action: "filter", params: { tags: ["warehouse"] }, confidence: 0.85 }
- "find bipedal" → { action: "filter", params: { tags: ["bipedal"] }, confidence: 0.88 }

Known company names: 1X Technologies, Figure AI, Boston Dynamics, Agility Robotics, Tesla Optimus, Apptronik, Sanctuary AI, Unitree
Known tags: humanoid, bipedal, warehouse, logistics, industrial, mobile, dexterous, autonomous, drone, agricultural, consumer, household

Return ONLY valid JSON. Set confidence based on how clear the intent is (0.5-1.0).`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAI] Parse request failed:', response.status, errorText);

      // Fall back to simple parsing
      return { command: fallbackParse(query) };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.action && parsed.params) {
          return {
            command: {
              originalQuery: query,
              action: parsed.action,
              params: parsed.params,
              confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
            },
          };
        }
      }
    } catch (parseError) {
      console.error('[OpenAI] Failed to parse command response:', content);
    }

    // Fall back if OpenAI response is invalid
    return { command: fallbackParse(query) };
  } catch (error: any) {
    console.error('[OpenAI] Parse error:', error);
    return { command: fallbackParse(query), error: error.message };
  }
}

/**
 * Simple fallback parser using keyword matching
 * Used when OpenAI is unavailable or fails
 */
function fallbackParse(query: string): ParsedCommand {
  const lowerQuery = query.toLowerCase();

  // Known tags to look for
  const knownTags = ['humanoid', 'bipedal', 'warehouse', 'logistics', 'industrial', 'mobile', 'dexterous', 'autonomous', 'drone', 'agricultural', 'consumer', 'household'];

  // Known company names
  const knownCompanies = [
    { name: '1X Technologies', aliases: ['1x', '1x tech'] },
    { name: 'Figure AI', aliases: ['figure'] },
    { name: 'Boston Dynamics', aliases: ['boston dynamics', 'bd'] },
    { name: 'Agility Robotics', aliases: ['agility', 'digit'] },
    { name: 'Tesla Optimus', aliases: ['tesla', 'optimus'] },
    { name: 'Apptronik', aliases: ['apptronik', 'apollo'] },
    { name: 'Sanctuary AI', aliases: ['sanctuary'] },
    { name: 'Unitree', aliases: ['unitree'] },
  ];

  // Check for select command
  if (lowerQuery.includes('select') || lowerQuery.includes('show me') || lowerQuery.includes('focus on')) {
    for (const company of knownCompanies) {
      for (const alias of company.aliases) {
        if (lowerQuery.includes(alias)) {
          return {
            originalQuery: query,
            action: 'select',
            params: { companyName: company.name },
            confidence: 0.75,
          };
        }
      }
    }
  }

  // Check for compare command
  if (lowerQuery.includes('compare') || lowerQuery.includes(' vs ') || lowerQuery.includes(' versus ')) {
    const matchedCompanies: string[] = [];
    for (const company of knownCompanies) {
      for (const alias of company.aliases) {
        if (lowerQuery.includes(alias)) {
          if (!matchedCompanies.includes(company.name)) {
            matchedCompanies.push(company.name);
          }
        }
      }
    }
    if (matchedCompanies.length >= 2) {
      return {
        originalQuery: query,
        action: 'compare',
        params: { companies: matchedCompanies },
        confidence: 0.7,
      };
    }
  }

  // Check for filter by tags
  const matchedTags = knownTags.filter(tag => lowerQuery.includes(tag));
  if (matchedTags.length > 0) {
    return {
      originalQuery: query,
      action: 'filter',
      params: { tags: matchedTags },
      confidence: 0.65,
    };
  }

  // Check for funding filter
  const fundingMatch = lowerQuery.match(/funding\s*(>|over|above|greater than)\s*\$?(\d+)\s*(m|million|b|billion)?/i);
  if (fundingMatch) {
    let value = parseInt(fundingMatch[2]);
    const unit = (fundingMatch[3] || '').toLowerCase();
    if (unit === 'm' || unit === 'million') value *= 1_000_000;
    if (unit === 'b' || unit === 'billion') value *= 1_000_000_000;

    return {
      originalQuery: query,
      action: 'filter',
      params: { field: 'funding', operator: 'gt', value },
      confidence: 0.7,
    };
  }

  // Default to search
  return {
    originalQuery: query,
    action: 'search',
    params: { query: query.trim() },
    confidence: 0.5,
  };
}
