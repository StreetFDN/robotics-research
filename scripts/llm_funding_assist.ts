/**
 * LLM assist module for funding parsing
 * Only used for FAILED/PARTIAL parse results
 * 
 * Security: API key read from env var only, never logged
 */

import type { FundingRoundData, FundingRound, Confidence } from '../types/funding';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Rate limiting: max 25 requests per batch, 60 requests per minute
const MAX_BATCH_SIZE = 25;
const REQUESTS_PER_MINUTE = 60;
const REQUEST_DELAY_MS = (60 * 1000) / REQUESTS_PER_MINUTE; // ~1 second between requests

// Cache for LLM outputs (keyed by hash of companyId + sourceColumn + rawCell)
const llmCache = new Map<string, FundingRoundData[]>();

/**
 * Hash function for cache key
 */
function hashCacheKey(companyId: string, sourceColumn: string, rawCell: string): string {
  const { createHash } = require('crypto');
  const combined = `${companyId}|${sourceColumn}|${rawCell}`;
  return createHash('sha256').update(combined).digest('hex');
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call OpenAI API to parse funding data
 */
async function callOpenAI(rawCell: string, sourceColumn: string): Promise<FundingRoundData[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }

  const prompt = `You are a data extraction assistant. Extract funding round information from the following text.

Text: "${rawCell}"
Source Column: "${sourceColumn}"

Return a JSON object with this exact structure:
{
  "valuationUsd": <number or null>,
  "currency": "USD" | "EUR" | "GBP" | "unknown",
  "time": "<MM/YYYY>" or null,
  "notes": "<string>",
  "confidence": "high" | "med" | "low"
}

Rules:
- If valuation is unclear or ambiguous, set valuationUsd to null and confidence to "low"
- If time is unclear, set time to null
- Never invent values - if you cannot determine a value, use null
- For time, use MM/YYYY format (e.g., "03/2021" for March 2021)
- For currency, default to USD unless explicitly stated otherwise
- Include the original text in notes if extraction was difficult

Return ONLY valid JSON, no other text.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a data extraction assistant. Return only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // Low temperature for deterministic results
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse JSON response
    let parsed: {
      valuationUsd?: number | null;
      currency?: string;
      time?: string | null;
      notes?: string;
      confidence?: string;
    };

    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (parseError) {
      throw new Error(`Failed to parse OpenAI JSON response: ${content}`);
    }

    // Determine round from source column
    const roundMap: Record<string, FundingRound> = {
      'pre-seed': 'pre-seed',
      'seed': 'seed',
      'series a': 'series-a',
      'series b': 'series-b',
      'series c': 'series-c',
      'series d': 'series-d',
      'series e': 'series-e',
    };

    let round: FundingRound = 'unknown';
    const colLower = sourceColumn.toLowerCase();
    for (const [key, value] of Object.entries(roundMap)) {
      if (colLower.includes(key)) {
        round = value;
        break;
      }
    }

    // Build result
    const result: FundingRoundData = {
      round,
      valuationUsd: parsed.valuationUsd ?? undefined,
      time: parsed.time ?? undefined,
      confidence: (parsed.confidence as Confidence) || 'low',
      notes: parsed.notes || rawCell,
      sourceColumn,
      currency: parsed.currency || 'USD',
    };

    return [result];
  } catch (error) {
    console.error(`[LLM Assist] Error calling OpenAI for "${rawCell}":`, error);
    throw error;
  }
}

/**
 * Process a batch of unresolved funding cells with LLM assist
 */
export async function processBatchWithLLM(
  batch: Array<{ companyId: string; companyName: string; sourceColumn: string; rawCell: string }>
): Promise<Map<string, FundingRoundData[]>> {
  const results = new Map<string, FundingRoundData[]>();

  console.log(`[LLM Assist] Processing batch of ${batch.length} items...`);

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    const cacheKey = hashCacheKey(item.companyId, item.sourceColumn, item.rawCell);

    // Check cache first
    if (llmCache.has(cacheKey)) {
      console.log(`[LLM Assist] Cache hit for ${item.companyName} - ${item.sourceColumn}`);
      results.set(cacheKey, llmCache.get(cacheKey)!);
      continue;
    }

    // Rate limiting
    if (i > 0) {
      await sleep(REQUEST_DELAY_MS);
    }

    try {
      const parsed = await callOpenAI(item.rawCell, item.sourceColumn);
      llmCache.set(cacheKey, parsed);
      results.set(cacheKey, parsed);
      console.log(`[LLM Assist] Processed ${item.companyName} - ${item.sourceColumn}`);
    } catch (error) {
      console.error(`[LLM Assist] Failed for ${item.companyName} - ${item.sourceColumn}:`, error);
      // Return empty result on error
      results.set(cacheKey, []);
    }
  }

  return results;
}

/**
 * Load LLM cache from file
 */
export function loadLLMCache(cachePath: string): void {
  try {
    const fs = require('fs');
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      for (const [key, value] of Object.entries(cacheData)) {
        llmCache.set(key as string, value as FundingRoundData[]);
      }
      console.log(`[LLM Assist] Loaded ${llmCache.size} entries from cache`);
    }
  } catch (error) {
    console.warn(`[LLM Assist] Failed to load cache:`, error);
  }
}

/**
 * Save LLM cache to file
 */
export function saveLLMCache(cachePath: string): void {
  try {
    const fs = require('fs');
    const cacheData: Record<string, FundingRoundData[]> = {};
    for (const [key, value] of Array.from(llmCache.entries())) {
      cacheData[key] = value;
    }
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    console.log(`[LLM Assist] Saved ${llmCache.size} entries to cache`);
  } catch (error) {
    console.error(`[LLM Assist] Failed to save cache:`, error);
  }
}

