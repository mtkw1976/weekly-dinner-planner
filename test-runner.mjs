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

    // SECTION 1: SYSTEM INITIALIZATION & VERSION VERIFICATION
    console.log('--- 1. SYSTEM INITIALIZATION & VERSION ---');
    const versionText = await page.locator('.version-badge').innerText();
    assertTest('App Version Badge', versionText === 'v2.2.4', `Version = ${versionText}`);
    assertTest('Uncaught JS Page Errors', pageErrors.length === 0, `Error count = ${pageErrors.length}`);

    const plannerCardsCount = await page.locator('.dinner-card').count();
    assertTest('Planner Day Cards Count', plannerCardsCount === 7, `Count = ${plannerCardsCount}`);

    const navButtonsCount = await page.locator('.nav-item').count();
    assertTest('Nav Buttons Count', navButtonsCount === 4, `Count = ${navButtonsCount}`);


    // SECTION 2: DAY MENU EDIT/ADD BUTTON FUNCTIONALITY
    console.log('\n--- 2. DAY MENU EDIT/ADD BUTTON FUNCTIONALITY ---');
    await page.click('.dinner-card[data-day="mon"] .add-dish-btn');
    await page.waitForTimeout(300);
    const isModalActiveMon = await page.locator('#edit-day-modal.active').isVisible();
    assertTest('Day Card "メニュー編集・追加" Button (Monday Modal Open)', isModalActiveMon);

    await page.click('#close-modal-btn');
    await page.waitForTimeout(200);

    await page.click('#add-dish-global-btn');
    await page.waitForTimeout(300);
    const isModalActiveGlobal = await page.locator('#edit-day-modal.active').isVisible();
    assertTest('Header "献立を追加" Button (Global Modal Open)', isModalActiveGlobal);

    await page.click('#close-modal-btn');
    await page.waitForTimeout(200);


    // SECTION 3: PLANNER TAB & EXTRA MEMO CARD
    console.log('\n--- 3. PLANNER TAB & EXTRA MEMO CARD ---');
    const memoHeaderInPlanner = await page.locator('#page-planner h3', { hasText: '日常品・その他買い物メモ（献立以外）' }).count();
    assertTest('Extra Memo Card on Planner Tab', memoHeaderInPlanner === 1);

    await page.fill('#extra-item-name-input', 'トイレットペーパー');
    await page.click('#add-extra-item-form button[type="submit"]');
    await page.waitForTimeout(300);

    const addedItemCount = await page.locator('#extra-items-list-container:has-text("トイレットペーパー")').count();
    assertTest('Extra Memo Item Add & Render', addedItemCount > 0);


    // SECTION 4: WEEK SELECTION & NAVIGATION SUITE
    console.log('\n--- 4. WEEK SELECTION & NAVIGATION SUITE ---');
    const initialRange = await page.locator('#planner-date-range').innerText();
    assertTest('Initial Week Range Display', initialRange.length > 0, `Range = ${initialRange.trim()}`);

    await page.click('#prev-week-btn');
    await page.waitForTimeout(300);
    const prevRange = await page.locator('#planner-date-range').innerText();
    assertTest('Previous Week Navigation (‹ 前の週)', prevRange !== initialRange, `Range = ${prevRange.trim()}`);

    await page.click('#next-week-btn');
    await page.waitForTimeout(300);
    const nextRange = await page.locator('#planner-date-range').innerText();
    assertTest('Next Week Navigation (次の週 ›)', nextRange !== prevRange, `Range = ${nextRange.trim()}`);

    await page.click('#today-week-btn');
    await page.waitForTimeout(300);
    const todayRange = await page.locator('#planner-date-range').innerText();
    assertTest('Current Week Jump (今週へ)', todayRange.includes('今週'), `Range = ${todayRange.trim()}`);

    await page.evaluate(() => window.state.selectWeekByDate('2026-08-10'));
    await page.waitForTimeout(300);
    const pickedRange = await page.locator('#planner-date-range').innerText();
    assertTest('Calendar Week Picker Jump (selectWeekByDate)', pickedRange.includes('8/10') || pickedRange.includes('8/16'), `Range = ${pickedRange.trim()}`);

    await page.click('#today-week-btn');
    await page.waitForTimeout(300);


    // SECTION 5: TAB SWITCHING PAGE VISIBILITY ISOLATION
    console.log('\n--- 5. TAB SWITCHING PAGE VISIBILITY ISOLATION ---');
    await page.click('[data-tab="shopping"]');
    await page.waitForTimeout(300);
    const plannerOnShopping = await page.locator('#page-planner').isVisible();
    const shoppingOnShopping = await page.locator('#page-shopping').isVisible();
    assertTest('Shopping Tab Visibility Isolation', !plannerOnShopping && shoppingOnShopping, 'Planner hidden, Shopping visible');

    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(300);
    const plannerOnSettings = await page.locator('#page-planner').isVisible();
    const settingsOnSettings = await page.locator('#page-settings').isVisible();
    assertTest('Settings Tab Visibility Isolation', !plannerOnSettings && settingsOnSettings, 'Planner hidden, Settings visible');

    await page.click('[data-tab="planner"]');
    await page.waitForTimeout(300);
    const plannerOnPlanner = await page.locator('#page-planner').isVisible();
    assertTest('Planner Tab Active Return', plannerOnPlanner, 'Planner visible');


    // SECTION 6: SHOPPING LIST DRAG HANDLES & REORDERING
    console.log('\n--- 6. SHOPPING LIST DRAG HANDLES & REORDERING ---');
    await page.click('[data-tab="shopping"]');
    await page.waitForTimeout(300);

    const dragHandlesCount = await page.locator('#shopping-list-container .drag-handle').count();
    assertTest('Drag Handle Icons Present', dragHandlesCount > 0, `Count = ${dragHandlesCount}`);

    await page.click('[data-tab="planner"]');
    await page.waitForTimeout(300);


    // SECTION 7: GOOGLE DRIVE SYNC STATUS BADGE UI
    console.log('\n--- 7. GOOGLE DRIVE SYNC STATUS BADGE UI ---');
    await page.evaluate(() => window.updateSyncStatusUI('syncing', 'Drive同期中...'));
    await page.waitForTimeout(150);
    const syncingText = await page.locator('#sync-status-text').innerText();
    assertTest('Sync Status UI (Syncing)', syncingText === 'Drive同期中...');

    await page.evaluate(() => window.updateSyncStatusUI('synced', 'Drive同期済み'));
    await page.waitForTimeout(150);
    const syncedText = await page.locator('#sync-status-text').innerText();
    assertTest('Sync Status UI (Synced)', syncedText === 'Drive同期済み');

    await page.evaluate(() => window.updateSyncStatusUI('offline', 'ローカル保存'));
    await page.waitForTimeout(150);


    // SECTION 8: EXHAUSTIVE ALL-CLICKABLE UI COMPONENTS CLICK TEST
    console.log('\n--- 8. EXHAUSTIVE ALL-CLICKABLE UI COMPONENTS CLICK TEST ---');
    let totalClickedCount = 0;

    async function closeAnyModal() {
      const modal = page.locator('#edit-day-modal.active');
      if (await modal.isVisible()) {
        await page.click('#close-modal-btn', { force: true });
        await page.waitForTimeout(150);
      }
    }

    async function clickAllMatching(description, selector, maxToClick = 50) {
      await closeAnyModal();
      const locators = page.locator(selector);
      const count = await locators.count();
      let clickedInGroup = 0;
      for (let i = 0; i < Math.min(count, maxToClick); i++) {
        try {
          await closeAnyModal();
          const el = locators.nth(i);
          if (await el.isVisible()) {
            await el.click({ timeout: 1000, force: true });
            await page.waitForTimeout(50);
            clickedInGroup++;
            totalClickedCount++;
            await closeAnyModal();
          }
        } catch (e) {}
      }
      console.log(` 🖱️ Clicked ${clickedInGroup}/${count} elements: ${description} [${selector}]`);
    }

    await page.click('[data-tab="planner"]');
    await page.waitForTimeout(200);

    await clickAllMatching('Planner Header & Toolbar Buttons', '#page-planner button:not(.btn-primary)');
    await clickAllMatching('Global Add Dish Button', '#add-dish-global-btn');
    await clickAllMatching('Week Navigation Buttons', '#prev-week-btn, #next-week-btn, #today-week-btn');
    await clickAllMatching('Extra Memo Buttons & Badges', '#clear-extra-items-btn, .delete-extra-item-btn');
    await clickAllMatching('Add Dish per Day Buttons', '.add-dish-btn');
    await clickAllMatching('Add Ingredient per Dish Buttons', '.add-ingredient-btn');
    await clickAllMatching('Copy & Paste Day Menu Buttons', '.copy-day-btn, .paste-day-btn');
    await clickAllMatching('Rating Star Buttons', '.star-rating span');
    await clickAllMatching('Ingredient Checkboxes', '#page-planner .ingredient-checkbox');
    await clickAllMatching('Ingredient Remove Buttons', '#page-planner .remove-ingredient-btn');

    await closeAnyModal();
    await page.click('[data-tab="shopping"]');
    await page.waitForTimeout(200);

    await clickAllMatching('Supermarket Store Filter Chips', '.store-filter-chip');
    await clickAllMatching('Clear Checked Items Button', '#clear-checked-items-btn');
    await clickAllMatching('Shopping Item Checkboxes', '#page-shopping input[type="checkbox"]');

    await page.click('[data-tab="history"]');
    await page.waitForTimeout(200);
    await clickAllMatching('History Action Buttons', '#page-history button');

    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(200);
    await clickAllMatching('Restore Default Stores Button', '#restore-default-stores-btn');
    await clickAllMatching('Delete Store Tag Buttons', '.delete-store-btn');
    await clickAllMatching('Google Drive Action Buttons', '#drive-login-btn, #drive-logout-btn, #manual-sync-btn');
    await clickAllMatching('Export & Import Data Buttons', '#export-json-btn, #import-json-btn');

    await clickAllMatching('Bottom Navigation Bar Tabs', '.nav-item');

    await page.click('[data-tab="planner"]');
    await page.waitForTimeout(300);

    assertTest('Exhaustive Interactive UI Component Clicks', totalClickedCount > 0, `Total interactive components clicked = ${totalClickedCount}`);
    assertTest('Zero Uncaught Errors After All Clicks', pageErrors.length === 0, `Uncaught errors = ${pageErrors.length}`);


    // SECTION 9: BASELINE REFERENCE SCREENSHOT GENERATION
    console.log('\n--- 9. BASELINE REFERENCE SCREENSHOT GENERATION ---');
    await page.screenshot({ path: 'baseline-reference.png' });
    await page.screenshot({ path: 'test-screenshot.png' });
    console.log(' ✅ PASS: Saved baseline-reference.png');

    console.log('\n===========================================================');
    console.log(`  REGRESSION TEST SUMMARY: ${testPassCount} / ${testTotalCount} TESTS PASSED (${Math.round((testPassCount / testTotalCount) * 100)}%)  `);
    console.log(`  TOTAL INTERACTIVE UI COMPONENTS CLICKED: ${totalClickedCount}  `);
    console.log('===========================================================\n');

  } catch (e) {
    console.error('Playwright Regression Suite Error:', e);
  } finally {
    await browser.close();
    server.close();
  }
});
