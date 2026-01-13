import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

// Force Node.js runtime (not Edge) for reliable fetch
export const runtime = 'nodejs';

const CLOB_API_BASE = 'https://clob.polymarket.com';
const YES_TOKEN_ID = '81398621498976727589490119481788053159677593582770707348620729114209951230437';

// Fallback fetch using native https module
async function httpsFetch(url: string): Promise<{ response: Response | null; error: any }> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; RoboticsIntel/1.0)',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        family: 4, // Force IPv4
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const response = new Response(data, {
            status: res.statusCode || 200,
            statusText: res.statusMessage || 'OK',
            headers: {
              'Content-Type': res.headers['content-type'] || 'application/json',
            },
          });
          resolve({ response, error: null });
        });
      });

      req.on('error', (error) => {
        resolve({ response: null, error });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ response: null, error: new Error('Request timeout') });
      });

      req.end();
    } catch (error) {
      resolve({ response: null, error });
    }
  });
}

export async function GET(request: NextRequest) {
  if (!YES_TOKEN_ID) {
    return NextResponse.json(
      {
        ok: false,
        error: 'YES_TOKEN_ID not configured',
        diagnostics: {
          nodeVersion: process.version,
          nodePlatform: process.platform,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }

  const healthUrl = `${CLOB_API_BASE}/price?token_id=${encodeURIComponent(YES_TOKEN_ID)}&side=buy`;

  try {
    // Try fetch first
    let result: { response: Response | null; error: any } = { response: null, error: null };
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(healthUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; RoboticsIntel/1.0)',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      
      clearTimeout(timeoutId);
      result = { response, error: null };
    } catch (fetchError: any) {
      // If fetch fails, try https fallback
      if (fetchError.name === 'TypeError' || fetchError.message?.includes('fetch failed')) {
        console.log('[Polymarket Health] Fetch failed, trying https fallback');
        result = await httpsFetch(healthUrl);
      } else {
        result = { response: null, error: fetchError };
      }
    }

    if (result.error || !result.response) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Upstream unreachable',
          upstreamUrl: healthUrl,
          errorName: result.error?.name,
          errorMessage: result.error?.message,
          diagnostics: {
            nodeVersion: process.version,
            nodePlatform: process.platform,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 502 }
      );
    }

    if (!result.response.ok) {
      const responseText = await result.response.text().catch(() => '');
      return NextResponse.json(
        {
          ok: false,
          error: 'Upstream returned error',
          upstreamUrl: healthUrl,
          status: result.response.status,
          statusText: result.response.statusText,
          bodyPreview: responseText.substring(0, 500),
          diagnostics: {
            nodeVersion: process.version,
            nodePlatform: process.platform,
            timestamp: new Date().toISOString(),
          },
        },
        { status: result.response.status || 502 }
      );
    }

    const data = await result.response.json();

    return NextResponse.json({
      ok: true,
      message: 'CLOB API is reachable',
      price: data.price,
      upstreamUrl: healthUrl,
      diagnostics: {
        nodeVersion: process.version,
        nodePlatform: process.platform,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Health check failed',
        upstreamUrl: healthUrl,
        errorName: error.name,
        errorMessage: error.message,
        stackPreview: error.stack?.substring(0, 500),
        diagnostics: {
          nodeVersion: process.version,
          nodePlatform: process.platform,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
