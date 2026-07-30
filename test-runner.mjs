import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
  try {
    let filePath = join(process.cwd(), req.url === '/' ? 'index.html' : req.url);
    const ext = extname(filePath);
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found: ' + err.message);
  }
});

server.listen(8080, async () => {
  console.log('Test server running at http://localhost:8080');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => pageErrors.push(err.message));

  try {
    await page.goto('http://localhost:8080/index.html');
    await page.waitForTimeout(1000);

    console.log('--- BROWSER CONSOLE LOGS ---');
    consoleLogs.forEach(l => console.log(l));

    console.log('--- PAGE UNCAUGHT ERRORS ---');
    pageErrors.forEach(e => console.log(e));

    const plannerCardsCount = await page.locator('.dinner-card').count();
    console.log(`Planner cards count: ${plannerCardsCount}`);

    const navButtonsCount = await page.locator('.nav-item').count();
    console.log(`Nav buttons count: ${navButtonsCount}`);

    // TEST 1: Extra Memo Card on #page-planner ("今週の献立")
    console.log('\n--- TESTING PLANNER TAB EXTRA MEMO CARD LOCATION ---');
    const memoHeaderInPlanner = await page.locator('#page-planner h3', { hasText: '日常品・その他買い物メモ（献立以外）' }).count();
    console.log(`Extra Memo Header Count on #page-planner: ${memoHeaderInPlanner}`);

    // TEST 2: Week Selection & Navigation Controls
    console.log('\n--- TESTING WEEK SELECTION & NAVIGATION CONTROLS ---');
    const initialRange = await page.locator('#planner-date-range').innerText();
    console.log(`Initial Week Date Range: ${initialRange}`);

    // Click "前の週"
    await page.click('#prev-week-btn');
    await page.waitForTimeout(300);
    const prevRange = await page.locator('#planner-date-range').innerText();
    console.log(`After clicking "前の週": ${prevRange}`);

    // Click "次の週"
    await page.click('#next-week-btn');
    await page.waitForTimeout(300);
    const nextRange = await page.locator('#planner-date-range').innerText();
    console.log(`After clicking "次の週": ${nextRange}`);

    // Click "今週へ"
    await page.click('#today-week-btn');
    await page.waitForTimeout(300);
    const todayRange = await page.locator('#planner-date-range').innerText();
    console.log(`After clicking "今週へ": ${todayRange}`);

    const hasTodayBadge = todayRange.includes('今週');
    console.log(`Current Week badge displayed: ${hasTodayBadge ? 'YES' : 'NO'}`);

    // TEST 3: Calendar Date Picker Jump
    console.log('\n--- TESTING CALENDAR DATE PICKER JUMP ---');
    await page.evaluate(() => {
      window.state.selectWeekByDate('2026-08-10');
    });
    await page.waitForTimeout(300);
    const pickedRange = await page.locator('#planner-date-range').innerText();
    console.log(`After picking 2026-08-10: ${pickedRange}`);

    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('Screenshot saved to test-screenshot.png');

  } catch (e) {
    console.error('Playwright Test Error:', e);
  } finally {
    await browser.close();
    server.close();
  }
});
