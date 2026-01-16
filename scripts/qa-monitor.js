/**
 * W9 QA Visual Monitor Script
 * Takes screenshots, checks for console errors, monitors visual issues
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(__dirname, '../qa-screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'desktop-lg', width: 1440, height: 900 },
  { name: 'desktop-md', width: 1280, height: 800 },
  { name: 'desktop-sm', width: 1024, height: 768 },
];

async function runQACheck() {
  console.log('='.repeat(60));
  console.log(`W9 QA Monitor - ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-gl=swiftshader',
      '--enable-gpu-rasterization'
    ]
  });

  const issues = [];
  const consoleErrors = [];
  const consoleWarnings = [];

  try {
    const page = await browser.newPage();

    // Collect console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push(text);
      } else if (type === 'warning' && !text.includes('DevTools')) {
        consoleWarnings.push(text);
      }
    });

    // Collect page errors
    page.on('pageerror', error => {
      consoleErrors.push(`PAGE ERROR: ${error.message}`);
    });

    // Collect failed requests
    page.on('requestfailed', request => {
      issues.push({
        type: 'NETWORK',
        severity: 'HIGH',
        message: `Failed request: ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`
      });
    });

    for (const viewport of VIEWPORTS) {
      console.log(`\nTesting viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);

      await page.setViewport({ width: viewport.width, height: viewport.height });

      // Navigate to page
      const response = await page.goto(BASE_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      if (!response.ok()) {
        issues.push({
          type: 'HTTP',
          severity: 'CRITICAL',
          message: `Page returned ${response.status()} at ${viewport.name}`
        });
      }

      // Wait for globe and components to load
      await new Promise(r => setTimeout(r, 3000));

      // Take screenshot
      const screenshotPath = path.join(SCREENSHOT_DIR, `${viewport.name}-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  Screenshot: ${screenshotPath}`);

      // Check for visual issues via DOM inspection
      const domIssues = await page.evaluate(() => {
        const issues = [];

        // Check for overflow issues
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          // Check for horizontal overflow
          if (el.scrollWidth > el.clientWidth && style.overflowX === 'visible') {
            if (rect.width > 50) { // Ignore tiny elements
              issues.push({
                type: 'OVERFLOW',
                severity: 'MEDIUM',
                message: `Horizontal overflow: ${el.tagName}.${el.className.split(' ')[0] || 'no-class'}`
              });
            }
          }
        });

        // Check for elements extending beyond viewport
        const viewportWidth = window.innerWidth;
        document.querySelectorAll('body *').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > viewportWidth + 10 && rect.width > 20) {
            issues.push({
              type: 'VIEWPORT_OVERFLOW',
              severity: 'HIGH',
              message: `Element extends beyond viewport: ${el.tagName}.${el.className.split(' ')[0] || 'no-class'} (right: ${Math.round(rect.right)}px)`
            });
          }
        });

        // Check for WebGL context
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach((canvas, i) => {
          const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
          if (!gl) {
            issues.push({
              type: 'WEBGL',
              severity: 'CRITICAL',
              message: `Canvas ${i} has no WebGL context - Globe may not render`
            });
          }
        });

        // Check for empty containers that should have content
        const panels = document.querySelectorAll('[class*="panel"], [class*="Panel"]');
        panels.forEach(panel => {
          if (panel.children.length === 0 || panel.innerText.trim() === '') {
            issues.push({
              type: 'EMPTY_PANEL',
              severity: 'MEDIUM',
              message: `Empty panel detected: ${panel.className.split(' ')[0]}`
            });
          }
        });

        // Check for z-index conflicts (overlapping clickable elements)
        const clickables = document.querySelectorAll('button, a, [role="button"]');
        const clickableRects = [];
        clickables.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            clickableRects.push({ el, rect });
          }
        });

        // Check if globe canvas exists
        if (canvases.length === 0) {
          issues.push({
            type: 'MISSING_ELEMENT',
            severity: 'CRITICAL',
            message: 'No canvas elements found - Globe not rendering'
          });
        }

        // Check navbar height
        const navbar = document.querySelector('nav, [class*="Navbar"], header');
        if (navbar) {
          const navRect = navbar.getBoundingClientRect();
          if (navRect.height < 40 || navRect.height > 80) {
            issues.push({
              type: 'LAYOUT',
              severity: 'LOW',
              message: `Navbar height unusual: ${navRect.height}px (expected 56px)`
            });
          }
        }

        return issues;
      });

      issues.push(...domIssues.map(i => ({ ...i, viewport: viewport.name })));

      // Check for loading states stuck
      const hasStuckLoading = await page.evaluate(() => {
        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="Loading"], [class*="spinner"], [class*="Spinner"]');
        return loadingElements.length > 0;
      });

      if (hasStuckLoading) {
        issues.push({
          type: 'LOADING',
          severity: 'MEDIUM',
          message: `Possible stuck loading state at ${viewport.name}`,
          viewport: viewport.name
        });
      }
    }

  } catch (error) {
    issues.push({
      type: 'SCRIPT_ERROR',
      severity: 'CRITICAL',
      message: `Monitor script error: ${error.message}`
    });
  } finally {
    await browser.close();
  }

  // Report Results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));

  if (consoleErrors.length > 0) {
    console.log(`\n[CONSOLE ERRORS] (${consoleErrors.length}):`);
    consoleErrors.slice(0, 10).forEach(e => console.log(`  - ${e.substring(0, 200)}`));
  }

  if (consoleWarnings.length > 0) {
    console.log(`\n[CONSOLE WARNINGS] (${consoleWarnings.length}):`);
    consoleWarnings.slice(0, 5).forEach(w => console.log(`  - ${w.substring(0, 200)}`));
  }

  // Deduplicate issues
  const uniqueIssues = [];
  const seen = new Set();
  issues.forEach(issue => {
    const key = `${issue.type}-${issue.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueIssues.push(issue);
    }
  });

  if (uniqueIssues.length > 0) {
    console.log(`\n[VISUAL ISSUES] (${uniqueIssues.length}):`);
    uniqueIssues.forEach(i => console.log(`  [${i.severity}] ${i.type}: ${i.message}`));
  } else {
    console.log('\n[OK] No visual issues detected');
  }

  return {
    consoleErrors,
    consoleWarnings,
    issues: uniqueIssues,
    timestamp: new Date().toISOString()
  };
}

// Run if called directly
if (require.main === module) {
  runQACheck()
    .then(results => {
      console.log('\nQA Check completed.');
      process.exit(results.issues.filter(i => i.severity === 'CRITICAL').length > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('QA Monitor failed:', err);
      process.exit(1);
    });
}

module.exports = { runQACheck };
