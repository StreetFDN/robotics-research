/**
 * Chat API Route
 *
 * Provides AI-powered chat about the robotics dashboard using OpenAI GPT-4.
 * Includes context about companies, funding, contracts, and narrative index.
 */

import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lazy-initialize OpenAI client (avoid build-time errors)
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Load company data for context
function loadCompanyContext(): string {
  try {
    const companiesPath = path.join(process.cwd(), 'data', 'private-companies.json');
    if (fs.existsSync(companiesPath)) {
      const data = JSON.parse(fs.readFileSync(companiesPath, 'utf-8'));
      const companies = data.companies || [];
      return companies.map((c: any) =>
        `- ${c.name}: ${c.focus || 'Robotics'}, HQ: ${c.hq?.city || 'Unknown'}, Power: ${c.power || 'N/A'}`
      ).join('\n');
    }
  } catch (e) {
    console.error('[Chat] Error loading companies:', e);
  }
  return 'Company data unavailable';
}

// Load funding data for context
function loadFundingContext(): string {
  try {
    const fundingPath = path.join(process.cwd(), 'data', 'robotics-funding-2025.json');
    if (fs.existsSync(fundingPath)) {
      const data = JSON.parse(fs.readFileSync(fundingPath, 'utf-8'));
      const rounds = (data.rounds || []).slice(0, 15); // Top 15 rounds
      const total = rounds.reduce((sum: number, r: any) => sum + r.amount, 0);
      return `Total tracked: $${(total / 1e9).toFixed(1)}B across ${data.rounds?.length || 0} rounds.\n\nRecent rounds:\n` +
        rounds.map((r: any) =>
          `- ${r.company}: $${(r.amount / 1e6).toFixed(0)}M (${r.round}, ${r.date})`
        ).join('\n');
    }
  } catch (e) {
    console.error('[Chat] Error loading funding:', e);
  }
  return 'Funding data unavailable';
}

// System prompt with dashboard context
function buildSystemPrompt(): string {
  const companyContext = loadCompanyContext();
  const fundingContext = loadFundingContext();

  return `You are an AI assistant for the Robotics Intelligence Dashboard - a real-time monitoring platform for the robotics and physical AI industry.

## Your Role
- Answer questions about companies, funding, market trends, and industry dynamics
- Provide insights based on the dashboard data
- Help users understand the Robotics Narrative Index and its components
- When users ask about specific companies, you can suggest highlighting them on the globe

## Dashboard Components
1. **Robotics Narrative Index (RNI)**: Composite score (0-100) measuring industry momentum
   - Index Alpha (30%): Robotics stocks vs MSCI World benchmark
   - Polymarket (15%): Prediction market sentiment
   - Gov Contracts (15%): USASpending.gov federal awards
   - GitHub (10%): Open source activity from key robotics orgs
   - News (10%): Sentiment analysis
   - Funding (10%): VC funding velocity vs baseline
   - Technical (10%): SDK releases

2. **Interactive Globe**: Shows robotics companies worldwide with power scores

3. **Funding Tracker**: Real-time funding rounds from NewsAPI + curated database

## Company Data
${companyContext}

## Funding Data (2024-2025)
${fundingContext}

## Response Guidelines
- Be concise but informative
- Use data from the dashboard when available
- For company questions, mention their location and focus area
- If asked to highlight a company, respond with: [HIGHLIGHT:CompanyName]
- If data isn't available, acknowledge limitations
- Use markdown formatting for clarity`;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, stream = false } = await request.json() as {
      messages: ChatMessage[];
      stream?: boolean;
    };

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Messages array required' },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt();

    // Prepare messages with system prompt
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10), // Keep last 10 messages for context
    ];

    const client = getOpenAIClient();

    if (stream) {
      // Streaming response
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });

      // Create a ReadableStream for SSE
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of response) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming response
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '';

      // Check for highlight commands
      const highlightMatch = content.match(/\[HIGHLIGHT:([^\]]+)\]/);
      const highlight = highlightMatch ? highlightMatch[1] : null;

      return NextResponse.json({
        ok: true,
        data: {
          content: content.replace(/\[HIGHLIGHT:[^\]]+\]/g, '').trim(),
          highlight,
          usage: response.usage,
        },
      });
    }
  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Chat request failed' },
      { status: 500 }
    );
  }
}
