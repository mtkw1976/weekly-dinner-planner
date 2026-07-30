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
  console.log('===========================================================');
  console.log('  PLAYWRIGHT REGRESSION TEST SUITE (BASELINE REFERENCE)  ');
  console.log('===========================================================');
  console.log('Server running at http://localhost:8080\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  const consoleLogs = [];
  const pageErrors = [];
  let testPassCount = 0;
  let testTotalCount = 0;

  function assertTest(testName, condition, detail = '') {
    testTotalCount++;
    if (condition) {
      testPassCount++;
      console.log(` ✅ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(` ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    }
  }

  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => pageErrors.push(err.message));

  try {
    await page.goto('http://localhost:8080/index.html');
    await page.waitForTimeout(1000);

    // SECTION 1: System Initialization & Version Verification
    console.log('--- 1. SYSTEM INITIALIZATION & VERSION ---');
    const versionText = await page.locator('.version-badge').innerText();
    assertTest('App Version Badge', versionText === 'v2.2.4', `Version = ${versionText}`);
    assertTest('Uncaught JS Page Errors', pageErrors.length === 0, `Error count = ${pageErrors.length}`);

    const plannerCardsCount = await page.locator('.dinner-card').count();
    assertTest('Planner Day Cards Count', plannerCardsCount === 7, `Count = ${plannerCardsCount}`);


    // SECTION 2: DAY MENU EDIT/ADD BUTTON FUNCTIONALITY TEST
    console.log('\n--- 2. DAY MENU EDIT/ADD BUTTON FUNCTIONALITY ---');
    // Test 2.1: Click Monday card "メニュー編集・追加" button
    await page.click('.dinner-card[data-day="mon"] .add-dish-btn');
    await page.waitForTimeout(300);

    const isModalActiveMon = await page.locator('#edit-day-modal.active').isVisible();
    assertTest('Day Card "メニュー編集・追加" Button (Monday Modal Open)', isModalActiveMon);

    // Close modal
    await page.click('#close-modal-btn');
    await page.waitForTimeout(200);

    // Test 2.2: Click Header "献立を追加" button
    await page.click('#add-dish-global-btn');
    await page.waitForTimeout(300);
    const isModalActiveGlobal = await page.locator('#edit-day-modal.active').isVisible();
    assertTest('Header "献立を追加" Button (Global Modal Open)', isModalActiveGlobal);

    // Close modal
    await page.click('#close-modal-btn');
    await page.waitForTimeout(200);


    // SECTION 3: Planner Tab Extra Memo Card
    console.log('\n--- 3. PLANNER TAB & EXTRA MEMO CARD ---');
    const memoHeaderInPlanner = await page.locator('#page-planner h3', { hasText: '日常品・その他買い物メモ（献立以外）' }).count();
    assertTest('Extra Memo Card on Planner Tab', memoHeaderInPlanner === 1);


    // SECTION 4: Week Selection & Navigation Suite
    console.log('\n--- 4. WEEK SELECTION & NAVIGATION SUITE ---');
    await page.click('#prev-week-btn');
    await page.waitForTimeout(300);

    await page.click('#next-week-btn');
    await page.waitForTimeout(300);

    await page.click('#today-week-btn');
    await page.waitForTimeout(300);
    const todayRange = await page.locator('#planner-date-range').innerText();
    assertTest('Current Week Jump (今週へ)', todayRange.includes('今週'));


    // SECTION 5: Tab Switching Page Visibility Isolation
    console.log('\n--- 5. TAB SWITCHING PAGE VISIBILITY ISOLATION ---');
    await page.click('[data-tab="shopping"]');
    await page.waitForTimeout(300);
    const plannerOnShopping = await page.locator('#page-planner').isVisible();
    const shoppingOnShopping = await page.locator('#page-shopping').isVisible();
    assertTest('Shopping Tab Visibility Isolation', !plannerOnShopping && shoppingOnShopping);

    await page.click('[data-tab="planner"]');
    await page.waitForTimeout(300);


    // SECTION 6: Baseline Reference Screenshot Generation
    console.log('\n--- 6. BASELINE REFERENCE SCREENSHOT GENERATION ---');
    await page.screenshot({ path: 'baseline-reference.png' });
    await page.screenshot({ path: 'test-screenshot.png' });
    console.log(' ✅ PASS: Saved baseline-reference.png');

    console.log('\n===========================================================');
    console.log(`  REGRESSION TEST SUMMARY: ${testPassCount} / ${testTotalCount} TESTS PASSED (${Math.round((testPassCount / testTotalCount) * 100)}%)  `);
    console.log('===========================================================\n');

  } catch (e) {
    console.error('Playwright Regression Suite Error:', e);
  } finally {
    await browser.close();
    server.close();
  }
});
