/**
 * Weekly Dinner & Grocery Planner - Main Application Core Logic
 */

import { driveSync } from './googleDrive.js';

// Default Stores Configuration
const DEFAULT_STORES = [
  { id: 'aeon', name: 'イオン', color: '#9333ea', cssClass: 'tag-aeon' },
  { id: 'life', name: 'ライフ', color: '#16a34a', cssClass: 'tag-life' },
  { id: 'gyomu', name: '業務スーパー', color: '#d97706', cssClass: 'tag-gyomu' },
  { id: 'kaldi', name: 'カルディ', color: '#0284c7', cssClass: 'tag-kaldi' },
  { id: 'butcher', name: '近所の肉屋', color: '#e11d48', cssClass: 'tag-butcher' },
  { id: 'greengrocer', name: '八百屋', color: '#65a30d', cssClass: 'tag-greengrocer' },
  { id: 'other', name: 'その他', color: '#64748b', cssClass: 'tag-other' },
];

// Days of the week base definition
const DAYS_OF_WEEK_BASE = [
  { key: 'mon', label: '月曜日', short: '月' },
  { key: 'tue', label: '火曜日', short: '火' },
  { key: 'wed', label: '水曜日', short: '水' },
  { key: 'thu', label: '木曜日', short: '木' },
  { key: 'fri', label: '金曜日', short: '金' },
  { key: 'sat', label: '土曜日', short: '土' },
  { key: 'sun', label: '日曜日', short: '日' },
];

const DAY_KEY_TO_JS_DAY = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

function formatDateToISO(d) {
  if (!(d instanceof Date) || isNaN(d)) return new Date().toISOString().split('T')[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return new Date();
  const parts = isoStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0])) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

function getWeekStartDate(baseDate = new Date(), startDayKey = 'mon') {
  const date = (typeof baseDate === 'string') ? parseISODate(baseDate) : new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  const currentDayNum = date.getDay();
  const targetStartNum = DAY_KEY_TO_JS_DAY[startDayKey] !== undefined ? DAY_KEY_TO_JS_DAY[startDayKey] : 1;

  let diff = currentDayNum - targetStartNum;
  if (diff < 0) {
    diff += 7;
  }
  date.setDate(date.getDate() - diff);
  return date;
}

function getDayDateInWeek(weekStartDate, dayKey) {
  const startNum = weekStartDate.getDay();
  const targetNum = DAY_KEY_TO_JS_DAY[dayKey] !== undefined ? DAY_KEY_TO_JS_DAY[dayKey] : 1;
  let offset = targetNum - startNum;
  if (offset < 0) {
    offset += 7;
  }
  const d = new Date(weekStartDate);
  d.setDate(d.getDate() + offset);
  return d;
}

function getOrderedDaysOfWeek() {
  const startKey = (state && state.startDayOfWeek) ? state.startDayOfWeek : 'mon';
  const startIndex = DAYS_OF_WEEK_BASE.findIndex(d => d.key === startKey);
  if (startIndex === -1 || startIndex === 0) return DAYS_OF_WEEK_BASE;
  return [
    ...DAYS_OF_WEEK_BASE.slice(startIndex),
    ...DAYS_OF_WEEK_BASE.slice(0, startIndex)
  ];
}

function sanitizeWeeklyPlan(plan) {
  let validPlan = plan;
  if (!validPlan || typeof validPlan !== 'object') {
    validPlan = JSON.parse(JSON.stringify(DEFAULT_WEEKLY_PLAN));
  }
  if (!validPlan.startDate) {
    validPlan.startDate = getWeekStartDate(new Date(), (state && state.startDayOfWeek) ? state.startDayOfWeek : 'mon').toISOString().split('T')[0];
  }
  if (!validPlan.days || typeof validPlan.days !== 'object') {
    validPlan.days = JSON.parse(JSON.stringify(DEFAULT_WEEKLY_PLAN.days));
  }

  const requiredKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  requiredKeys.forEach(key => {
    if (!validPlan.days[key]) {
      validPlan.days[key] = {
        dishes: [{
          id: 'dish_' + Date.now() + Math.random().toString(36).substr(2, 4),
          title: '',
          rating: 5,
          memo: '',
          ingredients: []
        }]
      };
    }
  });
  return validPlan;
}

function normalizeDayData(dayData) {
  if (!dayData || typeof dayData !== 'object') {
    return { dishes: [{ id: 'dish_' + Date.now(), title: '', rating: 5, memo: '', ingredients: [] }] };
  }

  let dishes = [];
  if (dayData.dishes && Array.isArray(dayData.dishes) && dayData.dishes.length > 0) {
    dishes = dayData.dishes;
  } else {
    const oldDishTitle = typeof dayData.dish === 'string' ? dayData.dish : '';
    const oldRating = typeof dayData.rating === 'number' ? dayData.rating : 5;
    const oldMemo = typeof dayData.memo === 'string' ? dayData.memo : '';
    let oldIngredients = [];
    if (Array.isArray(dayData.ingredients)) {
      oldIngredients = dayData.ingredients;
    } else if (typeof dayData.ingredients === 'string' && dayData.ingredients.trim() !== '') {
      oldIngredients = dayData.ingredients.split(',').map((name, idx) => ({
        id: 'ing_legacy_' + idx,
        name: name.trim(),
        storeId: 'other',
        checked: false
      }));
    }

    dishes = [{
      id: 'dish_single_legacy',
      title: oldDishTitle,
      rating: oldRating,
      memo: oldMemo,
      ingredients: oldIngredients
    }];
  }

  const sanitizedDishes = dishes.map((dish, dIdx) => {
    if (!dish || typeof dish !== 'object') {
      return { id: 'dish_legacy_' + dIdx, title: '', rating: 5, memo: '', ingredients: [] };
    }
    const safeDish = {
      id: dish.id || ('dish_legacy_' + dIdx),
      title: typeof dish.title === 'string' ? dish.title : '',
      rating: typeof dish.rating === 'number' ? dish.rating : 5,
      memo: typeof dish.memo === 'string' ? dish.memo : '',
      ingredients: []
    };

    if (Array.isArray(dish.ingredients)) {
      safeDish.ingredients = dish.ingredients.filter(ing => ing && typeof ing === 'object').map((ing, iIdx) => ({
        id: ing.id || ('ing_' + (safeDish.id || 'dish') + '_' + iIdx),
        name: typeof ing.name === 'string' ? ing.name : String(ing || ''),
        storeId: typeof ing.storeId === 'string' ? ing.storeId : 'other',
        checked: Boolean(ing.checked),
        order: typeof ing.order === 'number' ? ing.order : undefined
      }));
    } else if (typeof dish.ingredients === 'string' && dish.ingredients.trim() !== '') {
      safeDish.ingredients = dish.ingredients.split(',').map((name, iIdx) => ({
        id: 'ing_' + (safeDish.id || 'dish') + '_' + iIdx,
        name: name.trim(),
        storeId: 'other',
        checked: false,
        order: undefined
      }));
    }

    return safeDish;
  });

  return { dishes: sanitizedDishes };
}

function getSortedStoresByUsage() {
  if (!state || !state.stores) return [];
  const counts = {};
  state.stores.forEach(s => counts[s.id] = 0);

  if (state.currentPlan && state.currentPlan.days) {
    Object.values(state.currentPlan.days).forEach(dayRaw => {
      const day = normalizeDayData(dayRaw);
      if (day && day.dishes) {
        day.dishes.forEach(dish => {
          if (dish.ingredients) {
            dish.ingredients.forEach(ing => {
              if (ing.storeId) {
                counts[ing.storeId] = (counts[ing.storeId] || 0) + 1;
              }
            });
          }
        });
      }
    });
  }

  if (state.extraShoppingItems && Array.isArray(state.extraShoppingItems)) {
    state.extraShoppingItems.forEach(item => {
      if (item.storeId) {
        counts[item.storeId] = (counts[item.storeId] || 0) + 1;
      }
    });
  }

  return [...state.stores].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
}

// Default Initial Sample Data
const DEFAULT_WEEKLY_PLAN = {
  id: 'current',
  startDate: getWeekStartDate(new Date()).toISOString().split('T')[0],
  days: {
    mon: {
      dish: '特製ハンバーグ & ガルニ',
      memo: '奥さん特製和風おろしソース！子供も大好きなメニュー',
      rating: 5,
      ingredients: [
        { id: 'i1', name: '合い挽き肉 400g', storeId: 'butcher', checked: false },
        { id: 'i2', name: '玉ねぎ 2個', storeId: 'greengrocer', checked: false },
        { id: 'i3', name: '大根 1/2本', storeId: 'greengrocer', checked: false },
        { id: 'i4', name: 'パン粉', storeId: 'life', checked: false },
      ]
    },
    tue: {
      dish: '鮭の塩焼き & 具だくさん豚汁',
      memo: 'ヘルシー和食の日。ごぼうと豚肉たっぷりで栄養満点',
      rating: 4,
      ingredients: [
        { id: 'i5', name: '生サーモン切身 4切れ', storeId: 'aeon', checked: false },
        { id: 'i6', name: '豚コマ肉 200g', storeId: 'butcher', checked: false },
        { id: 'i7', name: 'ごぼう 1本', storeId: 'greengrocer', checked: false },
        { id: 'i8', name: 'こんにゃく', storeId: 'gyomu', checked: false },
      ]
    },
    wed: {
      dish: '本格キーマカレー & ナン',
      memo: 'スパイスを効かせて食欲UP！カルディのスパイス使用',
      rating: 5,
      ingredients: [
        { id: 'i9', name: '豚ひき肉 300g', storeId: 'butcher', checked: false },
        { id: 'i10', name: 'カレールー & スパイス', storeId: 'kaldi', checked: false },
        { id: 'i11', name: '冷凍ナン', storeId: 'gyomu', checked: false },
      ]
    },
    thu: {
      dish: '鶏肉と彩り野菜の黒酢あん炒め',
      memo: '酸味がきいてさっぱり美味しいディナー',
      rating: 4,
      ingredients: [
        { id: 'i12', name: '鶏もも肉 2枚', storeId: 'aeon', checked: false },
        { id: 'i13', name: 'パプリカ (赤・黄)', storeId: 'greengrocer', checked: false },
        { id: 'i14', name: 'ナス 3本', storeId: 'greengrocer', checked: false },
        { id: 'i15', name: '黒酢', storeId: 'life', checked: false },
      ]
    },
    fri: {
      dish: '海鮮チヂミ & 旨辛キムチ鍋',
      memo: '金曜夜は韓国風料理でパッと賑やかに！ビールと最高',
      rating: 5,
      ingredients: [
        { id: 'i16', name: 'シーフードミックス', storeId: 'gyomu', checked: false },
        { id: 'i17', name: '白菜キムチ', storeId: 'aeon', checked: false },
        { id: 'i18', name: 'ニラ 1束', storeId: 'greengrocer', checked: false },
        { id: 'i19', name: '豆腐 2パック', storeId: 'life', checked: false },
      ]
    },
    sat: {
      dish: '自家製手打ち風パスタ & シーザーサラダ',
      memo: '休日だからちょっと凝ったオリーブオイル系パスタ',
      rating: 5,
      ingredients: [
        { id: 'i20', name: '生パスタ麺', storeId: 'kaldi', checked: false },
        { id: 'i21', name: '生ハム', storeId: 'kaldi', checked: false },
        { id: 'i22', name: '粉チーズ & ドレッシング', storeId: 'aeon', checked: false },
        { id: 'i23', name: 'ロメインレタス', storeId: 'greengrocer', checked: false },
      ]
    },
    sun: {
      dish: '黒毛和牛の贅沢すき焼き',
      memo: '1週間の締めくくり！家族みんなで鍋を囲む時間',
      rating: 5,
      ingredients: [
        { id: 'i24', name: 'すき焼き用牛肉 600g', storeId: 'butcher', checked: false },
        { id: 'i25', name: '長ネギ 2本', storeId: 'greengrocer', checked: false },
        { id: 'i26', name: '焼き豆腐', storeId: 'life', checked: false },
        { id: 'i27', name: 'しらたき', storeId: 'gyomu', checked: false },
        { id: 'i28', name: '卵 1パック', storeId: 'aeon', checked: false },
      ]
    }
  }
};

// App State Management
class AppState {
  constructor() {
    this.stores = (Array.isArray(JSON.parse(localStorage.getItem('stores'))) && JSON.parse(localStorage.getItem('stores')).length > 0)
      ? JSON.parse(localStorage.getItem('stores'))
      : DEFAULT_STORES;
    this.startDayOfWeek = localStorage.getItem('week_start_day') || 'mon';

    // Selected week start date (YYYY-MM-DD)
    const todayWeekStart = getWeekStartDate(new Date(), this.startDayOfWeek).toISOString().split('T')[0];
    this.selectedWeekStartDate = localStorage.getItem('selected_week_start_date') || todayWeekStart;

    this.plansByWeek = {};
    try {
      const savedPlans = JSON.parse(localStorage.getItem('plans_by_week'));
      if (savedPlans && typeof savedPlans === 'object') {
        this.plansByWeek = savedPlans;
      }
    } catch (e) {}

    // Migration fallback for single current_plan
    const savedCurrent = JSON.parse(localStorage.getItem('current_plan'));
    if (savedCurrent) {
      const sanitized = sanitizeWeeklyPlan(savedCurrent);
      const planStart = sanitized.startDate || todayWeekStart;
      if (!this.plansByWeek[planStart]) {
        this.plansByWeek[planStart] = sanitized;
      }
    }

    this.ensureWeekPlan(this.selectedWeekStartDate);

    this.history = Array.isArray(JSON.parse(localStorage.getItem('history_plans')))
      ? JSON.parse(localStorage.getItem('history_plans'))
      : [];
    this.extraShoppingItems = Array.isArray(JSON.parse(localStorage.getItem('extra_shopping_items')))
      ? JSON.parse(localStorage.getItem('extra_shopping_items'))
      : [];
    this.backupHistory = Array.isArray(JSON.parse(localStorage.getItem('backup_files_history')))
      ? JSON.parse(localStorage.getItem('backup_files_history'))
      : [];
    this.activeTab = 'planner'; // planner, shopping, history, settings
    this.shoppingFilterStore = 'all';
    this.editingDayKey = null;
    this.editingSourceDayKey = null;
    this.editingDayData = null;
    this.debugMode = localStorage.getItem('gdrive_debug_mode') === 'true';
    this.lastDebugData = null;
  }

  saveBackupHistory(filename, data) {
    if (!filename || !data) return;
    if (!Array.isArray(this.backupHistory)) this.backupHistory = [];
    if (this.backupHistory.length > 0 && this.backupHistory[0].filename === filename) return;
    this.backupHistory.unshift({
      filename: filename,
      timestamp: Date.now(),
      data: data
    });
    if (this.backupHistory.length > 30) this.backupHistory.pop();
    try {
      localStorage.setItem('backup_files_history', JSON.stringify(this.backupHistory));
    } catch (e) {}
  }

  get currentPlan() {
    return this.ensureWeekPlan(this.selectedWeekStartDate);
  }

  set currentPlan(val) {
    if (val && this.selectedWeekStartDate) {
      this.plansByWeek[this.selectedWeekStartDate] = sanitizeWeeklyPlan(val);
    }
  }

  ensureWeekPlan(weekStartDateStr) {
    if (!this.plansByWeek[weekStartDateStr]) {
      const newPlan = JSON.parse(JSON.stringify(DEFAULT_WEEKLY_PLAN));
      newPlan.id = 'plan_' + weekStartDateStr;
      newPlan.startDate = weekStartDateStr;
      const todayWeekStart = getWeekStartDate(new Date(), this.startDayOfWeek).toISOString().split('T')[0];
      if (weekStartDateStr !== todayWeekStart) {
        Object.keys(newPlan.days).forEach(k => {
          newPlan.days[k] = {
            dishes: [{
              id: 'dish_' + weekStartDateStr + '_' + k,
              title: '',
              rating: 5,
              memo: '',
              ingredients: []
            }]
          };
        });
      }
      this.plansByWeek[weekStartDateStr] = sanitizeWeeklyPlan(newPlan);
    } else {
      this.plansByWeek[weekStartDateStr] = sanitizeWeeklyPlan(this.plansByWeek[weekStartDateStr]);
    }
    return this.plansByWeek[weekStartDateStr];
  }

  changeSelectedWeek(deltaDays) {
    const current = parseISODate(this.selectedWeekStartDate);
    current.setDate(current.getDate() + deltaDays);
    const newStart = getWeekStartDate(current, this.startDayOfWeek);
    this.selectedWeekStartDate = formatDateToISO(newStart);
    this.ensureWeekPlan(this.selectedWeekStartDate);
    this.saveLocal();
    renderApp();
  }

  selectWeekByDate(targetDateStr) {
    if (!targetDateStr) return;
    const targetDate = parseISODate(targetDateStr);
    const newStart = getWeekStartDate(targetDate, this.startDayOfWeek);
    this.selectedWeekStartDate = formatDateToISO(newStart);
    this.ensureWeekPlan(this.selectedWeekStartDate);
    this.saveLocal();
    renderApp();
  }

  jumpToCurrentWeek() {
    const todayWeekStart = getWeekStartDate(new Date(), this.startDayOfWeek);
    this.selectedWeekStartDate = formatDateToISO(todayWeekStart);
    this.ensureWeekPlan(this.selectedWeekStartDate);
    this.saveLocal();
    renderApp();
  }

  saveLocal(skipDriveSync = false) {
    localStorage.setItem('stores', JSON.stringify(this.stores));
    localStorage.setItem('selected_week_start_date', this.selectedWeekStartDate);
    localStorage.setItem('plans_by_week', JSON.stringify(this.plansByWeek));
    localStorage.setItem('current_plan', JSON.stringify(this.currentPlan));
    localStorage.setItem('history_plans', JSON.stringify(this.history));
    localStorage.setItem('extra_shopping_items', JSON.stringify(this.extraShoppingItems));
    localStorage.setItem('week_start_day', this.startDayOfWeek);
    if (driveSync.accessToken && !skipDriveSync) {
      updateSyncStatusUI('syncing', 'Drive同期中...');
      driveSync.saveToDrive(this.exportAllData())
        .then(() => {
          updateSyncStatusUI('synced', 'Drive同期済み');
        })
        .catch(err => {
          console.error('Auto Drive sync info:', err.message);
          if (err.message && err.message.includes('認証期限')) {
            updateSyncStatusUI('expired', 'Drive要再認証');
            showToast('Google Driveの認証期限が切れました。「クラウド設定」から再ログインしてください。');
          } else {
            updateSyncStatusUI('offline', 'ローカル保存');
          }
        });
    }
  }

  exportAllData() {
    return {
      version: '2.4.2',
      exportedAt: new Date().toISOString(),
      startDayOfWeek: this.startDayOfWeek,
      selectedWeekStartDate: this.selectedWeekStartDate,
      stores: this.stores,
      plansByWeek: this.plansByWeek,
      currentPlan: this.currentPlan,
      history: this.history,
      extraShoppingItems: this.extraShoppingItems
    };
  }

  importAllData(data, skipDriveSync = false) {
    if (!data) return false;
    if (data.startDayOfWeek) this.startDayOfWeek = data.startDayOfWeek;
    if (data.selectedWeekStartDate) this.selectedWeekStartDate = data.selectedWeekStartDate;
    if (data.stores && Array.isArray(data.stores) && data.stores.length > 0) {
      this.stores = data.stores;
    }
    if (data.plansByWeek && typeof data.plansByWeek === 'object') {
      this.plansByWeek = data.plansByWeek;
    }
    if (data.currentPlan && data.currentPlan.days) {
      this.currentPlan = data.currentPlan;
    }
    if (data.history && Array.isArray(data.history)) {
      this.history = data.history;
    }
    if (data.extraShoppingItems && Array.isArray(data.extraShoppingItems)) {
      this.extraShoppingItems = data.extraShoppingItems;
    }
    this.saveLocal(skipDriveSync);
    return true;
  }
}

const state = new AppState();
window.state = state;

export function formatBackupDisplayName(filename) {
  if (!filename || typeof filename !== 'string') return 'バックアップデータ';
  const regex = /^WeeklyDinner_Backup_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.json$/i;
  const match = filename.trim().match(regex);
  if (match) {
    const [_, year, month, day, hour, min, sec] = match;
    return `${year}年${parseInt(month, 10)}月${parseInt(day, 10)}日 ${hour}時${min}分${sec}秒のデータ`;
  }
  return filename;
}
window.formatBackupDisplayName = formatBackupDisplayName;

// Initialize App & Event Listeners
async function initApp() {
  renderApp();
  setupNavigation();
  setupEventListeners();
  initIcons();

  const warningBanner = document.getElementById('drive-unsynced-warning');
  const warningGoBtn = document.getElementById('warning-go-settings-btn');
  if (warningGoBtn) {
    warningGoBtn.addEventListener('click', () => switchTab('settings'));
  }

  if (driveSync.accessToken) {
    updateSyncStatusUI('synced', 'Drive同期済み');
    if (warningBanner) warningBanner.style.display = 'none';
  } else {
    updateSyncStatusUI('offline', 'ローカル保存');
    if (warningBanner) warningBanner.style.display = 'flex';
    showToast('⚠️ Google Driveと同期されていません。「クラウド設定」からログインしてください。');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function updateSyncStatusUI(status, msg) {
  const badge = document.getElementById('sync-status');
  const text = document.getElementById('sync-status-text');
  if (!badge || !text) return;

  badge.className = 'sync-status-badge';
  if (status === 'synced') {
    text.innerText = msg || 'Drive同期済み';
    badge.style.background = 'rgba(16, 185, 129, 0.15)';
    badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    badge.style.color = '#059669';
  } else if (status === 'expired') {
    text.innerText = msg || 'Drive要再認証';
    badge.style.background = '#fef3c7';
    badge.style.borderColor = '#f59e0b';
    badge.style.color = '#d97706';
  } else if (status === 'syncing') {
    text.innerText = msg || '同期中...';
    badge.style.background = '#e0e7ff';
    badge.style.borderColor = '#818cf8';
    badge.style.color = '#4f46e5';
  } else {
    text.innerText = msg || 'ローカル保存';
    badge.classList.add('offline');
    badge.style.background = '#f1f5f9';
    badge.style.borderColor = '#cbd5e1';
    badge.style.color = 'var(--text-muted)';
  }
}
window.updateSyncStatusUI = updateSyncStatusUI;

// Navigation Logic
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.nav-item').forEach(b => {
    if (b.getAttribute('data-tab') === tabId) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  document.querySelectorAll('.page, .page-content').forEach(p => {
    if (p.id === `page-${tabId}`) {
      p.classList.add('active');
      p.style.setProperty('display', 'block', 'important');
    } else {
      p.classList.remove('active');
      p.style.setProperty('display', 'none', 'important');
    }
  });

  renderApp();
}

// Main Render Handler
function renderApp() {
  try { renderPlannerPage(); } catch (e) { console.error('Planner render error:', e); }
  try { renderShoppingPage(); } catch (e) { console.error('Shopping render error:', e); }
  try { renderHistoryPage(); } catch (e) { console.error('History render error:', e); }
  try { renderSettingsPage(); } catch (e) { console.error('Settings render error:', e); }
  initIcons();
}
window.renderApp = renderApp;

/* ==========================================================================
   1. Weekly Dinner Planner Page Render
   ========================================================================== */
function renderPlannerPage() {
  const container = document.getElementById('planner-cards-container');
  const dateRangeEl = document.getElementById('planner-date-range');
  const datePickerEl = document.getElementById('week-date-picker');
  if (!container || !dateRangeEl) return;

  renderExtraShoppingItems();

  const weekStartDate = parseISODate(state.selectedWeekStartDate);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  const todayWeekStart = formatDateToISO(getWeekStartDate(new Date(), state.startDayOfWeek));
  const isCurrentWeek = (state.selectedWeekStartDate === todayWeekStart);

  const days = getOrderedDaysOfWeek();
  const startDayShort = days[0] ? days[0].short : '月';
  const endDayShort = days[6] ? days[6].short : '日';

  const dateRangeText = `${weekStartDate.getFullYear()}/${weekStartDate.getMonth() + 1}/${weekStartDate.getDate()}(${startDayShort}) 〜 ${weekEndDate.getMonth() + 1}/${weekEndDate.getDate()}(${endDayShort})`;
  
  dateRangeEl.innerHTML = `${dateRangeText} ${isCurrentWeek ? '<span style="background:var(--accent-rose-gradient);color:white;font-size:0.72rem;padding:2px 8px;border-radius:12px;margin-left:6px;font-weight:800;">今週</span>' : ''}`;

  if (datePickerEl) {
    datePickerEl.value = state.selectedWeekStartDate;
  }

  let html = '';
  days.forEach(dayInfo => {
    const dayRaw = state.currentPlan.days[dayInfo.key];
    const dayData = normalizeDayData(dayRaw);
    const dayDate = getDayDateInWeek(weekStartDate, dayInfo.key);
    const dateFormatted = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;

    const isToday = checkIsToday(state.selectedWeekStartDate, dayInfo.key);

    let dishesHtml = '';
    if (dayData.dishes && dayData.dishes.length > 0) {
      dayData.dishes.forEach((dish, dIdx) => {
        dishesHtml += `
          <div class="planner-dish-item" style="${dIdx > 0 ? 'margin-top:14px;padding-top:14px;border-top:1px dashed #fecdd3;' : ''}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <div class="menu-title" style="font-size:1.05rem;font-weight:800;color:#372e2d;">
                ${escapeHtml(dish.title || '（未登録）')}
              </div>
              ${renderStarRatingHtml(dish.rating || 5, dayInfo.key, dish.id)}
            </div>
            ${dish.memo ? `<div class="menu-memo" style="margin-top:4px;">${escapeHtml(dish.memo)}</div>` : ''}

            <div class="ingredients-list" style="margin-top:8px;">
              ${Array.isArray(dish.ingredients) && dish.ingredients.length > 0 ? 
                dish.ingredients.map(ing => {
                  const storeId = (ing && ing.storeId) ? ing.storeId : 'other';
                  const store = (state.stores || []).find(s => s.id === storeId) || { name: '未定', cssClass: 'tag-other', color: '#64748b' };
                  return `
                    <div class="ingredient-chip">
                      <span>${escapeHtml((ing && ing.name) ? ing.name : '')}</span>
                      <span class="store-tag ${store.cssClass || 'tag-other'}" style="${store.color ? `background-color: ${store.color};` : ''}">${escapeHtml(store.name || '')}</span>
                    </div>
                  `;
                }).join('')
                : '<span style="font-size:0.78rem;color:var(--text-subtle);">食材未登録</span>'
              }
            </div>
          </div>
        `;
      });
    }

    html += `
      <div class="dinner-card" data-day="${dayInfo.key}">
        <div class="dinner-card-header">
          <span class="day-badge ${isToday ? 'today' : ''}">
            <i data-lucide="calendar" style="width:14px;height:14px;"></i>
            ${dayInfo.label} (${dateFormatted}) ${isToday ? '(本日)' : ''}
          </span>
          <div style="display:flex;gap:6px;align-items:center;">
            <button type="button" class="btn btn-secondary btn-sm copy-day-btn" data-day="${dayInfo.key}" title="他の曜日にメニューをコピー" style="font-size:0.75rem;padding:4px 8px;color:var(--accent-indigo);border-color:rgba(99,102,241,0.3);">
              <i data-lucide="copy" style="width:12px;height:12px;"></i> コピー
            </button>
            <button type="button" class="btn btn-secondary btn-sm add-dish-btn" data-day="${dayInfo.key}" style="font-size:0.78rem;padding:4px 8px;">
              <i data-lucide="plus" style="width:12px;height:12px;"></i> メニュー編集・追加
            </button>
          </div>
        </div>

        ${dishesHtml}
      </div>
    `;
  });

  container.innerHTML = html;

  // Attach Event Handlers
  container.querySelectorAll('.add-dish-btn, .edit-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dayKey = btn.getAttribute('data-day');
      openEditDayModal(dayKey);
    });
  });

  container.querySelectorAll('.copy-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dayKey = btn.getAttribute('data-day');
      openCopyDayModal(dayKey);
    });
  });

  container.querySelectorAll('.star-rating-display .star').forEach(star => {
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      const dayKey = star.getAttribute('data-day');
      const dishId = star.getAttribute('data-dish-id');
      const starValue = parseInt(star.getAttribute('data-star'));

      if (dayKey && state.currentPlan.days[dayKey]) {
        const dayData = normalizeDayData(state.currentPlan.days[dayKey]);
        const targetDish = dayData.dishes.find(d => d.id === dishId) || dayData.dishes[0];
        if (targetDish) {
          targetDish.rating = starValue;
          state.currentPlan.days[dayKey] = dayData;
          state.saveLocal();
          renderPlannerPage();
          showToast(`${starValue}つ星に評価しました！⭐`);
        }
      }
    });
  });
}

function renderStarRatingHtml(rating = 5, dayKey = '', dishId = '') {
  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    const isFilled = i <= rating;
    starsHtml += `<span class="star ${isFilled ? 'filled' : ''}" data-day="${dayKey}" data-dish-id="${dishId}" data-star="${i}" title="${i}つ星">★</span>`;
  }
  return `<div class="star-rating-display">${starsHtml}</div>`;
}

function checkIsToday(startDateStr, dayKey) {
  const start = getWeekStartDate(new Date(startDateStr), state.startDayOfWeek || 'mon');
  const targetDate = getDayDateInWeek(start, dayKey);
  
  const today = new Date();
  return today.getFullYear() === targetDate.getFullYear() &&
         today.getMonth() === targetDate.getMonth() &&
         today.getDate() === targetDate.getDate();
}

function formatDateRange(startDateStr) {
  const start = getWeekStartDate(new Date(startDateStr), state.startDayOfWeek || 'mon');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const days = getOrderedDaysOfWeek();
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  const startFormatted = `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()}`;
  const endFormatted = `${end.getMonth() + 1}/${end.getDate()}`;
  return `${startFormatted} (${firstDay.short}) 〜 ${endFormatted} (${lastDay.short})`;
}

/* ==========================================================================
   2. Supermarket-wise Shopping List Page Render
   ========================================================================== */
function renderShoppingPage() {
  const filterBar = document.getElementById('store-filter-bar');
  const shoppingListContainer = document.getElementById('shopping-list-container');
  if (!filterBar || !shoppingListContainer) return;

  renderExtraShoppingItems();

  const sortedStores = getSortedStoresByUsage();
  let filterHtml = `
    <button class="filter-chip ${state.shoppingFilterStore === 'all' ? 'active' : ''}" data-store="all">
      すべてのスーパー
    </button>
  `;
  sortedStores.forEach(store => {
    filterHtml += `
      <button class="filter-chip ${state.shoppingFilterStore === store.id ? 'active' : ''}" data-store="${store.id}">
        ${escapeHtml(store.name)}
      </button>
    `;
  });
  filterBar.innerHTML = filterHtml;

  filterBar.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.shoppingFilterStore = btn.getAttribute('data-store');
      renderShoppingPage();
    });
  });

  // Group all items (recipe ingredients + non-menu extra items) by store
  const itemsByStore = {};
  sortedStores.forEach(s => { itemsByStore[s.id] = []; });

  // 1. Non-menu Extra Shopping Items
  if (state.extraShoppingItems && Array.isArray(state.extraShoppingItems)) {
    state.extraShoppingItems.forEach((item, idx) => {
      const storeId = item.storeId || 'other';
      if (!itemsByStore[storeId]) itemsByStore[storeId] = [];
      itemsByStore[storeId].push({
        ...item,
        isExtra: true,
        sourceTag: '日常品メモ',
        dayKey: 'extra',
        orderIndex: typeof item.order === 'number' ? item.order : ((idx + 1) * 10)
      });
    });
  }

  // 2. Recipe Ingredients
  const days = getOrderedDaysOfWeek();
  days.forEach((dayInfo, dayIdx) => {
    const dayRaw = state.currentPlan.days[dayInfo.key];
    const dayData = normalizeDayData(dayRaw);
    if (dayData && dayData.dishes) {
      dayData.dishes.forEach((dish, dIdx) => {
        if (dish.ingredients && Array.isArray(dish.ingredients)) {
          dish.ingredients.forEach((ing, iIdx) => {
            const storeId = ing.storeId || 'other';
            if (!itemsByStore[storeId]) itemsByStore[storeId] = [];
            itemsByStore[storeId].push({
              ...ing,
              isExtra: false,
              sourceTag: `${dayInfo.short}: ${dish.title || 'メニュー'}`,
              dayKey: dayInfo.key,
              dishId: dish.id,
              orderIndex: typeof ing.order === 'number' ? ing.order : (1000 + dayIdx * 100 + dIdx * 10 + iIdx * 10)
            });
          });
        }
      });
    }
  });

  // Sort items inside each store group: Unchecked items first (top), checked items last (bottom)
  Object.keys(itemsByStore).forEach(sId => {
    itemsByStore[sId].sort((a, b) => {
      if (a.checked !== b.checked) {
        return (a.checked ? 1 : 0) - (b.checked ? 1 : 0);
      }
      return a.orderIndex - b.orderIndex;
    });
  });
  window.itemsByStore = itemsByStore;

  let listHtml = '';
  let totalItemsCount = 0;
  let checkedItemsCount = 0;

  sortedStores.forEach(store => {
    if (state.shoppingFilterStore !== 'all' && state.shoppingFilterStore !== store.id) {
      return;
    }

    const items = itemsByStore[store.id] || [];
    if (items.length === 0 && state.shoppingFilterStore !== 'all') {
      listHtml += `
        <div class="shopping-section" style="padding:24px;text-align:center;color:var(--text-muted);">
          ${escapeHtml(store.name)}の購入予定食材はありません 🎉
        </div>
      `;
      return;
    }
    if (items.length === 0) return;

    totalItemsCount += items.length;
    const storeCheckedCount = items.filter(i => i.checked).length;
    checkedItemsCount += storeCheckedCount;

    listHtml += `
      <div class="shopping-section" data-store-id="${store.id}">
        <div class="shopping-section-header">
          <div class="store-header-title">
            <span class="store-tag ${store.cssClass || 'tag-other'}" style="${store.color ? `background-color: ${store.color};` : ''}">${escapeHtml(store.name)}</span>
            <span>(${storeCheckedCount}/${items.length})</span>
          </div>
        </div>
        <div class="shopping-items-body">
          ${items.map((item, idx) => `
            <div class="shopping-item-row ${item.checked ? 'checked' : ''}" draggable="true" data-store-id="${store.id}" data-idx="${idx}">
              <div class="shopping-item-left">
                <div class="drag-handle" title="ドラッグして順序を移動" style="cursor:grab;padding:2px 4px;color:#a39594;display:flex;align-items:center;">
                  <i data-lucide="grip-vertical" style="width:16px;height:16px;"></i>
                </div>
                <div class="custom-checkbox ${item.checked ? 'checked' : ''}" 
                     data-is-extra="${item.isExtra}" data-day="${item.dayKey}" data-dish-id="${item.dishId || ''}" data-ing-id="${item.id}">
                  ${item.checked ? '<i data-lucide="check" style="width:14px;height:14px;"></i>' : ''}
                </div>
                <div>
                  <div class="shopping-item-name">${escapeHtml(item.name)}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <div class="shopping-item-menu" style="font-size:0.75rem;">${escapeHtml(item.sourceTag)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  if (!listHtml) {
    listHtml = `
      <div style="text-align:center;padding:40px 16px;color:var(--text-muted);">
        <i data-lucide="shopping-bag" style="width:48px;height:48px;margin-bottom:12px;opacity:0.5;"></i>
        <p>買い物リストは空です。献立食材や日常品メモを追加してください。</p>
      </div>
    `;
  }

  shoppingListContainer.innerHTML = listHtml;
  if (window.lucide) window.lucide.createIcons();

  // Toggle Item Checked Handlers
  shoppingListContainer.querySelectorAll('.custom-checkbox').forEach(box => {
    box.addEventListener('click', () => {
      const isExtra = box.getAttribute('data-is-extra') === 'true';
      const dayKey = box.getAttribute('data-day');
      const dishId = box.getAttribute('data-dish-id');
      const ingId = box.getAttribute('data-ing-id');

      if (isExtra) {
        const item = state.extraShoppingItems.find(i => i.id === ingId);
        if (item) {
          item.checked = !item.checked;
          state.saveLocal();
          renderShoppingPage();
        }
      } else {
        const dayData = normalizeDayData(state.currentPlan.days[dayKey]);
        const dish = dayData.dishes.find(d => d.id === dishId);
        if (dish && dish.ingredients) {
          const ing = dish.ingredients.find(i => i.id === ingId);
          if (ing) {
            ing.checked = !ing.checked;
            state.currentPlan.days[dayKey] = dayData;
            state.saveLocal();
            renderShoppingPage();
          }
        }
      }
    });
  });

  // Setup HTML5 Drag and Drop & Mobile Touch Drag Handlers
  setupShoppingListDragAndDrop(shoppingListContainer, itemsByStore);
}

function setupShoppingListDragAndDrop(container, itemsByStore) {
  let draggedRow = null;
  let draggedStoreId = null;
  let draggedIdx = null;

  // HTML5 Drag and Drop (Mouse)
  container.querySelectorAll('.shopping-item-row').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      const storeId = row.getAttribute('data-store-id');
      const idx = parseInt(row.getAttribute('data-idx'));
      draggedRow = row;
      draggedStoreId = storeId;
      draggedIdx = idx;
      row.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ storeId, idx }));
      }
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const targetStoreId = row.getAttribute('data-store-id');
      if (targetStoreId === draggedStoreId && row !== draggedRow) {
        row.classList.add('drag-over');
      }
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const targetStoreId = row.getAttribute('data-store-id');
      const targetIdx = parseInt(row.getAttribute('data-idx'));

      let fromIdx = draggedIdx;
      let fromStoreId = draggedStoreId;

      if (e.dataTransfer) {
        try {
          const payload = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
          if (payload.idx !== undefined) fromIdx = parseInt(payload.idx);
          if (payload.storeId) fromStoreId = payload.storeId;
        } catch (err) {}
      }

      if (fromStoreId === targetStoreId && fromIdx !== null && !isNaN(fromIdx) && !isNaN(targetIdx) && fromIdx !== targetIdx) {
        reorderStoreItems(itemsByStore[fromStoreId], fromIdx, targetIdx);
      }
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      container.querySelectorAll('.shopping-item-row').forEach(r => r.classList.remove('drag-over'));
    });
  });

  // Touch Drag & Drop (Mobile Smartphones)
  let touchDraggedRow = null;
  let touchDraggedStoreId = null;
  let touchDraggedIdx = null;

  container.querySelectorAll('.shopping-item-row').forEach(row => {
    const handle = row.querySelector('.drag-handle');
    if (!handle) return;

    handle.addEventListener('touchstart', (e) => {
      touchDraggedRow = row;
      touchDraggedStoreId = row.getAttribute('data-store-id');
      touchDraggedIdx = parseInt(row.getAttribute('data-idx'));
      row.classList.add('dragging');
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (!touchDraggedRow) return;
      const touch = e.touches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!targetEl) return;
      const targetRow = targetEl.closest('.shopping-item-row');

      container.querySelectorAll('.shopping-item-row').forEach(r => r.classList.remove('drag-over'));
      if (targetRow && targetRow.getAttribute('data-store-id') === touchDraggedStoreId && targetRow !== touchDraggedRow) {
        targetRow.classList.add('drag-over');
      }
    }, { passive: true });

    handle.addEventListener('touchend', (e) => {
      if (!touchDraggedRow) return;
      const touch = e.changedTouches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      touchDraggedRow.classList.remove('dragging');
      container.querySelectorAll('.shopping-item-row').forEach(r => r.classList.remove('drag-over'));

      if (targetEl) {
        const targetRow = targetEl.closest('.shopping-item-row');
        if (targetRow && targetRow.getAttribute('data-store-id') === touchDraggedStoreId) {
          const targetIdx = parseInt(targetRow.getAttribute('data-idx'));
          if (touchDraggedIdx !== null && touchDraggedIdx !== targetIdx) {
            reorderStoreItems(itemsByStore[touchDraggedStoreId], touchDraggedIdx, targetIdx);
          }
        }
      }
      touchDraggedRow = null;
      touchDraggedStoreId = null;
      touchDraggedIdx = null;
    });
  });
}

function reorderStoreItems(itemsList, fromIdx, toIdx) {
  if (!itemsList || fromIdx < 0 || toIdx < 0 || fromIdx >= itemsList.length || toIdx >= itemsList.length) return;

  const [movedItem] = itemsList.splice(fromIdx, 1);
  itemsList.splice(toIdx, 0, movedItem);

  // Update orderIndex for all items in this store and lock in state using 10-step scale
  itemsList.forEach((item, newOrder) => {
    const assignedOrder = (newOrder + 1) * 10;
    item.orderIndex = assignedOrder;
    if (item.isExtra) {
      const target = state.extraShoppingItems.find(i => i.id === item.id || i.name === item.name);
      if (target) target.order = assignedOrder;
    } else {
      if (state.currentPlan && state.currentPlan.days && state.currentPlan.days[item.dayKey]) {
        const dayData = normalizeDayData(state.currentPlan.days[item.dayKey]);
        if (dayData && dayData.dishes) {
          const dish = dayData.dishes.find(d => d.id === item.dishId);
          if (dish && dish.ingredients) {
            const ing = dish.ingredients.find(i => i.id === item.id || i.name === item.name);
            if (ing) {
              ing.order = assignedOrder;
              state.currentPlan.days[item.dayKey] = dayData;
            }
          }
        }
      }
    }
  });

  state.saveLocal();
  renderShoppingPage();
}
window.reorderStoreItems = reorderStoreItems;

function swapShoppingItemsOrder(itemsList, idxA, idxB) {
  const itemA = itemsList[idxA];
  const itemB = itemsList[idxB];
  if (!itemA || !itemB) return;

  const tempOrder = itemA.orderIndex;
  itemA.orderIndex = itemB.orderIndex;
  itemB.orderIndex = tempOrder;

  // Persist order values into state
  [itemA, itemB].forEach(item => {
    if (item.isExtra) {
      const target = state.extraShoppingItems.find(i => i.id === item.id);
      if (target) target.order = item.orderIndex;
    } else {
      const dayData = normalizeDayData(state.currentPlan.days[item.dayKey]);
      const dish = dayData.dishes.find(d => d.id === item.dishId);
      if (dish && dish.ingredients) {
        const ing = dish.ingredients.find(i => i.id === item.id);
        if (ing) ing.order = item.orderIndex;
      }
    }
  });

  state.saveLocal();
  renderShoppingPage();
}

function renderExtraShoppingItems() {
  const storeSelect = document.getElementById('extra-item-store-select');
  const container = document.getElementById('extra-items-list-container');
  if (storeSelect) {
    const sortedStores = getSortedStoresByUsage();
    storeSelect.innerHTML = sortedStores.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  }

  if (container) {
    if (!state.extraShoppingItems || state.extraShoppingItems.length === 0) {
      container.innerHTML = `<span style="font-size:0.8rem;color:var(--text-subtle);">日常品メモは登録されていません</span>`;
      return;
    }

    container.innerHTML = state.extraShoppingItems.map((item, idx) => {
      const store = state.stores.find(s => s.id === item.storeId) || { name: 'その他', cssClass: 'tag-other', color: '#64748b' };
      return `
        <div class="ingredient-chip ${item.checked ? 'checked' : ''}" style="padding:6px 12px;display:inline-flex;align-items:center;gap:6px;${item.checked ? 'opacity:0.6;text-decoration:line-through;' : ''}">
          <span>${escapeHtml(item.name)}</span>
          <span class="store-tag ${store.cssClass || 'tag-other'}" style="${store.color ? `background-color: ${store.color};` : ''}">${escapeHtml(store.name)}</span>
          <button type="button" class="delete-extra-btn" data-idx="${idx}" style="background:none;border:none;color:#f43f5e;cursor:pointer;padding:2px;" title="削除">
            <i data-lucide="x" style="width:12px;height:12px;"></i>
          </button>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    container.querySelectorAll('.delete-extra-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        state.extraShoppingItems.splice(idx, 1);
        state.saveLocal();
        renderShoppingPage();
        showToast('買い物メモを削除しました');
      });
    });
  }
}

/* ==========================================================================
   3. History Archive Page Render
   ========================================================================== */
function renderHistoryPage() {
  const container = document.getElementById('history-list-container');
  if (!container) return;

  if (!state.history || state.history.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 16px;color:var(--text-muted);">
        <i data-lucide="archive" style="width:48px;height:48px;margin-bottom:12px;opacity:0.5;"></i>
        <p>保存された献立の履歴はありません。「今週の献立を履歴に保存」を押すと記録されます。</p>
      </div>
    `;
    return;
  }

  let html = '';
  state.history.forEach(hist => {
    const dateStr = formatDateRange(hist.startDate || hist.plan.startDate);
    
    html += `
      <div class="history-card">
        <div class="history-header">
          <div>
            <div class="history-date">${escapeHtml(hist.title || '過去のディナー献立')}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);">${dateStr}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-indigo btn-sm restore-hist-btn" data-hist-id="${hist.id}">
              <i data-lucide="copy" style="width:14px;height:14px;"></i> 今週に複製
            </button>
            <button class="btn btn-secondary btn-sm delete-hist-btn" data-hist-id="${hist.id}" style="color:#f43f5e;border-color:rgba(244,63,94,0.3);">
              <i data-lucide="trash-2" style="width:14px;height:14px;"></i> 削除
            </button>
          </div>
        </div>

        <div class="history-menu-grid">
          ${getOrderedDaysOfWeek().map(d => {
            const dayRaw = hist.plan && hist.plan.days ? hist.plan.days[d.key] : null;
            const dayData = normalizeDayData(dayRaw);
            const validDishes = dayData.dishes.filter(dish => dish && typeof dish.title === 'string' && dish.title.trim() !== '');
            const dishTitleStr = validDishes.map(dish => dish.title.trim()).join(' / ');
            const mainRating = validDishes.length > 0 && typeof validDishes[0].rating === 'number' ? validDishes[0].rating : 5;
            return `
              <div class="history-menu-item">
                <div class="history-day">${d.short}曜 <span style="color:#ffb703;">${'★'.repeat(mainRating)}</span></div>
                <div class="history-dish" style="font-weight:700;">${escapeHtml(dishTitleStr || '-')}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.restore-hist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const histId = btn.getAttribute('data-hist-id');
      const targetHist = state.history.find(h => h.id === histId);
      if (targetHist && confirm('この過去の献立を現在の「今週の献立」に上書きコピーしますか？')) {
        state.currentPlan.days = JSON.parse(JSON.stringify(targetHist.plan.days));
        state.saveLocal();
        showToast('過去の献立を今週にコピーしました！');
        switchTab('planner');
      }
    });
  });

  container.querySelectorAll('.delete-hist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const histId = btn.getAttribute('data-hist-id');
      const targetHist = state.history.find(h => h.id === histId);
      if (targetHist && confirm(`履歴「${targetHist.title || '過去の献立'}」を削除してもよろしいですか？`)) {
        state.history = state.history.filter(h => h.id !== histId);
        state.saveLocal();
        showToast('履歴を削除しました');
        renderHistoryPage();
      }
    });
  });
}

/* ==========================================================================
   4. Google Drive Sync & Settings Page Render
   ========================================================================== */
function renderSettingsPage() {
  const clientIdInput = document.getElementById('gdrive-client-id-input');
  if (clientIdInput) {
    clientIdInput.value = driveSync.getClientId();
  }
  
  const startDaySelect = document.getElementById('start-day-select');
  if (startDaySelect) {
    startDaySelect.value = state.startDayOfWeek || 'mon';
  }

  renderStoreTagsManageList();

  const debugToggle = document.getElementById('debug-mode-toggle');
  const debugPanel = document.getElementById('debug-panel');
  if (debugToggle && debugPanel) {
    debugToggle.checked = Boolean(state.debugMode);
    debugPanel.style.display = state.debugMode ? 'block' : 'none';
    if (state.debugMode) {
      fetchAndDisplayDebugJson();
    }
  }
}

async function fetchAndDisplayDebugJson() {
  const container = document.getElementById('debug-json-container');
  const info = document.getElementById('debug-status-info');
  if (!container) return;

  if (!driveSync.accessToken) {
    if (info) info.innerText = 'ステータス: 未ログイン (認証を行ってください)';
    container.innerText = 'Google Driveに未ログインのためデータを表示できません。「Googleアカウントでログイン認証」を行ってください。';
    return;
  }

  try {
    if (info) info.innerText = 'ステータス: 取得中...';
    container.innerText = 'Google Driveから `WeeklyDinnerPlanner_Data.json` を取得しています...';
    
    const rawData = await driveSync.loadFromDrive();
    state.lastDebugData = rawData;
    
    if (info) info.innerText = `ステータス: 取得成功 (${new Date().toLocaleTimeString()} 取得)`;
    container.innerText = JSON.stringify(rawData, null, 2);
  } catch (err) {
    if (info) info.innerText = 'ステータス: 取得失敗';
    container.innerText = `Google Driveからのデータ取得でエラーが発生しました:\n${err.message}`;
  }
}

function renderStoreTagsManageList() {
  const container = document.getElementById('store-tags-manage-list');
  if (!container) return;

  const sortedStores = getSortedStoresByUsage();
  container.innerHTML = sortedStores.map(store => `
    <div class="ingredient-chip" style="padding:6px 12px;display:inline-flex;align-items:center;gap:6px;">
      <span class="store-tag ${store.cssClass || 'tag-other'}" style="${store.color ? `background-color: ${store.color};` : ''}">${escapeHtml(store.name)}</span>
      <button class="delete-store-btn" data-store-id="${store.id}" style="background:none;border:none;color:#f43f5e;cursor:pointer;display:inline-flex;align-items:center;padding:2px;" title="店舗タグ「${escapeHtml(store.name)}」を削除">
        <i data-lucide="x" style="width:14px;height:14px;"></i>
      </button>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();

  container.querySelectorAll('.delete-store-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const storeId = btn.getAttribute('data-store-id');
      const storeObj = state.stores.find(s => s.id === storeId);
      if (!storeObj) return;

      if (state.stores.length <= 1) {
        alert('最低1つの店舗タグを残す必要があります。');
        return;
      }

      if (confirm(`店舗タグ「${storeObj.name}」を削除しますか？`)) {
        state.stores = state.stores.filter(s => s.id !== storeId);
        state.saveLocal();
        showToast(`店舗タグ「${storeObj.name}」を削除しました`);
        renderApp();
      }
    });
  });
}

/* ==========================================================================
   Modal & Event Handlers
   ========================================================================== */
function setupEventListeners() {
  // Week navigation button handlers
  const prevWeekBtn = document.getElementById('prev-week-btn');
  if (prevWeekBtn) {
    prevWeekBtn.addEventListener('click', (e) => {
      e.preventDefault();
      state.changeSelectedWeek(-7);
    });
  }

  const nextWeekBtn = document.getElementById('next-week-btn');
  if (nextWeekBtn) {
    nextWeekBtn.addEventListener('click', (e) => {
      e.preventDefault();
      state.changeSelectedWeek(7);
    });
  }

  const todayWeekBtn = document.getElementById('today-week-btn');
  if (todayWeekBtn) {
    todayWeekBtn.addEventListener('click', (e) => {
      e.preventDefault();
      state.jumpToCurrentWeek();
    });
  }

  const dateNavEl = document.querySelector('.date-navigator');
  const weekDatePicker = document.getElementById('week-date-picker');

  if (dateNavEl && weekDatePicker) {
    dateNavEl.addEventListener('click', (e) => {
      if (e.target !== weekDatePicker) {
        if (typeof weekDatePicker.showPicker === 'function') {
          try { weekDatePicker.showPicker(); } catch (err) { weekDatePicker.click(); }
        } else {
          weekDatePicker.click();
        }
      }
    });

    weekDatePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        state.selectWeekByDate(e.target.value);
      }
    });

    weekDatePicker.addEventListener('input', (e) => {
      if (e.target.value) {
        state.selectWeekByDate(e.target.value);
      }
    });
  }

  // Start day of week setting handler
  const startDaySelect = document.getElementById('start-day-select');
  if (startDaySelect) {
    startDaySelect.addEventListener('change', (e) => {
      state.startDayOfWeek = e.target.value;
      localStorage.setItem('week_start_day', state.startDayOfWeek);
      state.saveLocal();
      renderApp();
      const selectedDayObj = DAYS_OF_WEEK_BASE.find(d => d.key === state.startDayOfWeek);
      showToast(`献立の開始曜日を「${selectedDayObj ? selectedDayObj.label : ''}」に変更しました！`);
    });
  }

  // Global Add Dish Header Button
  const addDishGlobalBtn = document.getElementById('add-dish-global-btn');
  if (addDishGlobalBtn) {
    addDishGlobalBtn.addEventListener('click', () => {
      openEditDayModal('mon');
    });
  }

  // Bulk clear weekly plan handler
  const clearAllPlanBtn = document.getElementById('clear-all-plan-btn');
  if (clearAllPlanBtn) {
    clearAllPlanBtn.addEventListener('click', () => {
      if (confirm('今週の全曜日の献立と食材をすべて一括クリア（リセット）してもよろしいですか？')) {
        const daysKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        daysKeys.forEach(k => {
          state.currentPlan.days[k] = {
            dishes: [{
              id: 'dish_' + Date.now() + Math.random().toString(36).substr(2, 4),
              title: '',
              memo: '',
              rating: 5,
              ingredients: []
            }]
          };
        });
        state.saveLocal();
        renderApp();
        showToast('今週の献立と食材を一括クリアしました');
      }
    });
  }

  // Save current plan to history
  const handleSaveToHistory = () => {
    if (!state.currentPlan) return;
    const defaultTitle = `${formatDateRange(state.selectedWeekStartDate)}の献立`;
    const titlePrompt = prompt('保存する履歴のタイトルを入力してください:', defaultTitle);
    if (titlePrompt) {
      const newHist = {
        id: 'hist_' + Date.now() + Math.random().toString(36).substr(2, 4),
        savedAt: new Date().toISOString(),
        startDate: state.selectedWeekStartDate,
        title: titlePrompt,
        plan: JSON.parse(JSON.stringify(state.currentPlan))
      };
      if (!Array.isArray(state.history)) state.history = [];
      state.history.unshift(newHist);
      state.saveLocal();
      showToast('Google Drive・ローカル履歴にアーカイブ保存しました！');
      switchTab('history');
    }
  };

  const archiveCurrentBtn = document.getElementById('archive-current-plan-btn');
  if (archiveCurrentBtn) archiveCurrentBtn.addEventListener('click', handleSaveToHistory);

  const archiveCurrentHistBtn = document.getElementById('archive-current-plan-hist-btn');
  if (archiveCurrentHistBtn) archiveCurrentHistBtn.addEventListener('click', handleSaveToHistory);

  // Clear checked shopping list items
  const clearCheckedBtn = document.getElementById('clear-checked-items-btn');
  if (clearCheckedBtn) {
    clearCheckedBtn.addEventListener('click', () => {
      const daysKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      daysKeys.forEach(k => {
        const dayData = normalizeDayData(state.currentPlan.days[k]);
        if (dayData && dayData.dishes) {
          dayData.dishes.forEach(dish => {
            if (Array.isArray(dish.ingredients)) {
              dish.ingredients = dish.ingredients.filter(i => !i.checked);
            }
          });
          state.currentPlan.days[k] = dayData;
        }
      });
      state.saveLocal();
      renderShoppingPage();
      showToast('チェック済みの食材を整理しました！');
    });
  }

  // Non-menu Extra Shopping Item Form Handler
  const addExtraItemForm = document.getElementById('add-extra-item-form');
  if (addExtraItemForm) {
    addExtraItemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('extra-item-name-input');
      const storeSelect = document.getElementById('extra-item-store-select');
      const name = nameInput ? nameInput.value.trim() : '';
      const storeId = storeSelect ? storeSelect.value || 'other' : 'other';

      if (!name) return;

      if (!Array.isArray(state.extraShoppingItems)) {
        state.extraShoppingItems = [];
      }

      state.extraShoppingItems.push({
        id: 'extra_' + Date.now(),
        name: name,
        storeId: storeId,
        checked: false,
        order: state.extraShoppingItems.length
      });

      state.saveLocal();
      if (nameInput) nameInput.value = '';
      renderShoppingPage();
      showToast(`日常品メモ「${name}」を追加しました！`);
    });
  }

  // Clear all non-menu extra shopping items
  const clearExtraItemsBtn = document.getElementById('clear-extra-items-btn');
  if (clearExtraItemsBtn) {
    clearExtraItemsBtn.addEventListener('click', () => {
      if (confirm('日常品・その他の買い物メモを一括全削除しますか？')) {
        state.extraShoppingItems = [];
        state.saveLocal();
        renderShoppingPage();
        showToast('日常品メモを一括削除しました');
      }
    });
  }

  // Add new store tag form handler
  const addStoreTagForm = document.getElementById('add-store-tag-form');
  if (addStoreTagForm) {
    addStoreTagForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('new-store-name-input');
      const colorInput = document.getElementById('new-store-color-input');
      const name = nameInput.value.trim();
      const color = colorInput.value || '#ec4899';
      if (!name) return;

      const newId = 'store_' + Date.now();
      state.stores.push({
        id: newId,
        name: name,
        color: color,
        cssClass: 'tag-custom'
      });

      state.saveLocal();
      nameInput.value = '';
      showToast(`店舗タグ「${name}」を追加しました！`);
      renderApp();
    });
  }

  // Restore default store tags handler
  const restoreDefaultStoresBtn = document.getElementById('restore-default-stores-btn');
  if (restoreDefaultStoresBtn) {
    restoreDefaultStoresBtn.addEventListener('click', () => {
      if (confirm('初期状態の店舗タグセット（イオン、ライフ、業務スーパー等）を追加復元しますか？')) {
        DEFAULT_STORES.forEach(ds => {
          if (!state.stores.some(s => s.id === ds.id)) {
            state.stores.push({ ...ds });
          }
        });
        state.saveLocal();
        showToast('初期店舗タグを復元しました！');
        renderApp();
      }
    });
  }

  // Google Drive Save & Load
  const gdriveConnectBtn = document.getElementById('gdrive-connect-btn');
  if (gdriveConnectBtn) {
    gdriveConnectBtn.addEventListener('click', () => {
      const clientId = document.getElementById('gdrive-client-id-input').value;
      if (!clientId) {
        alert('Google Cloud Client IDを入力してください');
        return;
      }
      driveSync.setClientId(clientId);
      driveSync.initGoogleAuth(
        async () => {
          showToast('Google認証が完了しました！現在入力済みのデータをクラウドへ保存します...');
          try {
            updateSyncStatusUI('syncing', 'Drive保存中...');
            
            // Strictly save current local entered state to Google Drive to protect user data from deletion
            await driveSync.saveToDrive(state.exportAllData());

            updateSyncStatusUI('synced', 'Drive同期済み');
            const warningBanner = document.getElementById('drive-unsynced-warning');
            if (warningBanner) warningBanner.style.display = 'none';
            renderApp();
            showToast('現在入力済みの献立データをGoogle Driveへ正常に同期・保存しました！');
          } catch (err) {
            updateSyncStatusUI('offline', 'ローカル保存');
            alert('Google Driveへの保存に失敗しました: ' + err.message);
          }
        },
        (err) => alert('Google認証エラー: ' + err)
      );
    });
  }

  // Manual Save to Google Drive
  const gdriveSaveManualBtn = document.getElementById('gdrive-save-manual-btn');
  if (gdriveSaveManualBtn) {
    gdriveSaveManualBtn.addEventListener('click', async () => {
      if (!driveSync.accessToken) {
        alert('Google Driveに接続されていません。「Googleアカウントでログイン認証」を先に行ってください。');
        return;
      }
      try {
        updateSyncStatusUI('syncing', 'Drive保存中...');
        await driveSync.saveToDrive(state.exportAllData());
        updateSyncStatusUI('synced', 'Drive同期済み');
        showToast('Google Driveへ献立・店舗タグ全データを正常に保存しました！');
      } catch (err) {
        if (err.message && err.message.includes('認証期限')) {
          updateSyncStatusUI('expired', 'Drive要再認証');
        }
        alert('Google Drive保存失敗: ' + err.message);
      }
    });
  }

  // Manual Load from Google Drive
  const gdriveLoadManualBtn = document.getElementById('gdrive-load-manual-btn');
  if (gdriveLoadManualBtn) {
    gdriveLoadManualBtn.addEventListener('click', async () => {
      if (!driveSync.accessToken) {
        alert('Google Driveに接続されていません。「Googleアカウントでログイン認証」を先に行ってください。');
        return;
      }
      if (confirm('Google Driveから最新データを取得して現在のデータを上書き復元しますか？')) {
        try {
          updateSyncStatusUI('syncing', 'Drive取得中...');
          const data = await driveSync.loadFromDrive();
          if (state.importAllData(data, true)) {
            updateSyncStatusUI('synced', 'Drive同期済み');
            showToast('Google Driveから最新の献立・店舗タグを同期復元しました！');
            renderApp();
          }
        } catch (err) {
          if (err.message && err.message.includes('認証期限')) {
            updateSyncStatusUI('expired', 'Drive要再認証');
          }
          alert('Google Driveからの復元失敗: ' + err.message);
        }
      }
    });
  }

  // Debug Mode Handlers
  const debugToggle = document.getElementById('debug-mode-toggle');
  if (debugToggle) {
    debugToggle.addEventListener('change', (e) => {
      state.debugMode = e.target.checked;
      localStorage.setItem('gdrive_debug_mode', state.debugMode ? 'true' : 'false');
      const panel = document.getElementById('debug-panel');
      if (panel) panel.style.display = state.debugMode ? 'block' : 'none';
      if (state.debugMode) {
        fetchAndDisplayDebugJson();
      }
    });
  }

  const debugFetchBtn = document.getElementById('debug-fetch-btn');
  if (debugFetchBtn) {
    debugFetchBtn.addEventListener('click', () => {
      fetchAndDisplayDebugJson();
    });
  }

  const debugApplyBtn = document.getElementById('debug-apply-btn');
  if (debugApplyBtn) {
    debugApplyBtn.addEventListener('click', () => {
      if (!state.lastDebugData) {
        alert('取得済みのJSONデータがありません');
        return;
      }
      if (confirm('Google Driveから取得したJSONデータをアプリに強制適用しますか？')) {
        state.importAllData(state.lastDebugData, true);
        showToast('JSONデータをアプリに適用しました！');
        renderApp();
      }
    });
  }

  const debugCopyBtn = document.getElementById('debug-copy-btn');
  if (debugCopyBtn) {
    debugCopyBtn.addEventListener('click', () => {
      const container = document.getElementById('debug-json-container');
      if (container && container.innerText) {
        navigator.clipboard.writeText(container.innerText);
        showToast('JSONをクリップボードにコピーしました');
      }
    });
  }

  // Manual File Export / Import Backup
  const exportJsonBtn = document.getElementById('export-json-btn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `WeeklyDinner_Backup_${timestamp}.json`;

      const dataAll = state.exportAllData();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataAll, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      state.saveBackupHistory(filename, dataAll);

      const displayEl = document.getElementById('export-filename-display');
      const textEl = document.getElementById('export-filename-text');
      if (displayEl && textEl) {
        textEl.innerText = `書き出し完了: ${filename}`;
        displayEl.style.display = 'block';
      }

      showToast(`バックアップファイルを書き出しました: ${filename}`);
    });
  }

  const importJsonInput = document.getElementById('import-json-input');
  if (importJsonInput) {
    importJsonInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files || files.length === 0) return;

      const loadedItems = [];
      for (const file of files) {
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          const item = {
            filename: file.name,
            displayName: formatBackupDisplayName(file.name),
            data: json
          };
          loadedItems.push(item);
          state.saveBackupHistory(file.name, json);
        } catch (err) {
          console.warn('Backup file parse error:', file.name, err);
        }
      }

      if (loadedItems.length > 0) {
        openRestoreSelectorModal(loadedItems);
      } else {
        alert('有効なJSONバックアップファイルを読み込めませんでした。');
      }
      e.target.value = '';
    });
  }

  // Day Editing Modal Logic
  setupModalHandlers();
}

function openEditDayModal(dayKey) {
  state.editingSourceDayKey = dayKey;
  state.editingDayKey = dayKey;
  const days = getOrderedDaysOfWeek();
  const dayInfo = days.find(d => d.key === dayKey) || DAYS_OF_WEEK_BASE.find(d => d.key === dayKey) || { label: dayKey };
  const dayRaw = state.currentPlan.days[dayKey];

  state.editingDayData = JSON.parse(JSON.stringify(normalizeDayData(dayRaw)));
  if (state.editingDayData && state.editingDayData.dishes) {
    state.editingDayData.dishes.forEach(d => {
      if (!d.dayKey) d.dayKey = dayKey;
    });
  }

  const titleEl = document.getElementById('modal-day-title');
  if (titleEl) titleEl.innerText = `${dayInfo.label}の献立・食材編集`;

  const daySelect = document.getElementById('modal-day-key-select');
  if (daySelect) {
    daySelect.value = dayKey;
  }
  
  renderModalDishesList();

  const modal = document.getElementById('edit-day-modal');
  if (modal) modal.classList.add('active');
}

let selectedRestoreData = null;

function openRestoreSelectorModal(customItems = null) {
  const modal = document.getElementById('restore-selector-modal');
  const container = document.getElementById('restore-backups-list');
  const confirmBtn = document.getElementById('confirm-restore-btn');
  if (!modal || !container || !confirmBtn) return;

  let items = customItems;
  if (!items || items.length === 0) {
    const history = state.backupHistory || [];
    items = history.map(h => ({
      filename: h.filename,
      displayName: formatBackupDisplayName(h.filename),
      data: h.data
    }));
  }

  if (items.length === 0) {
    container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);">選択できるバックアップデータがありません。</div>';
    confirmBtn.disabled = true;
    modal.classList.add('active');
    return;
  }

  selectedRestoreData = null;
  confirmBtn.disabled = true;

  let html = '';
  items.forEach((item, idx) => {
    html += `
      <label class="restore-item-row" data-idx="${idx}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:var(--radius-md);cursor:pointer;">
        <input type="radio" name="restore-option" value="${idx}" style="width:18px;height:18px;cursor:pointer;">
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.92rem;color:#1e293b;">
            ${escapeHtml(item.displayName)}
          </div>
          ${item.displayName !== item.filename ? `<div style="font-size:0.75rem;color:var(--text-subtle);margin-top:2px;">(ファイル名: ${escapeHtml(item.filename)})</div>` : ''}
        </div>
      </label>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();

  container.querySelectorAll('input[name="restore-option"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value);
      if (items[idx]) {
        selectedRestoreData = items[idx];
        confirmBtn.disabled = false;
      }
    });
  });

  modal.classList.add('active');
}

let currentCopySourceDayKey = null;

function openCopyDayModal(sourceDayKey) {
  currentCopySourceDayKey = sourceDayKey;
  const sourceDayInfo = DAYS_OF_WEEK_BASE.find(d => d.key === sourceDayKey) || { label: sourceDayKey };
  const modal = document.getElementById('copy-day-modal');
  const titleEl = document.getElementById('copy-modal-title');
  if (titleEl) titleEl.innerText = `「${sourceDayInfo.label}」のメニュー＆食材コピー`;

  const select = document.getElementById('target-copy-day-select');
  if (select) {
    const daysKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const sIdx = daysKeys.indexOf(sourceDayKey);
    const nextKey = daysKeys[(sIdx + 1) % 7];
    select.value = nextKey;
  }

  if (modal) modal.classList.add('active');
}

function copyDayMenu(sourceDayKey, targetDayKey) {
  if (!sourceDayKey || !targetDayKey) return;
  const sourceRaw = state.currentPlan.days[sourceDayKey];
  if (!sourceRaw) return;

  const normalized = normalizeDayData(sourceRaw);
  const deepCopy = JSON.parse(JSON.stringify(normalized));

  deepCopy.dishes.forEach((d, dIdx) => {
    d.id = 'dish_copy_' + Date.now() + '_' + dIdx + '_' + Math.random().toString(36).substr(2, 4);
    if (d.ingredients && Array.isArray(d.ingredients)) {
      d.ingredients.forEach((ing, iIdx) => {
        ing.id = 'ing_copy_' + Date.now() + '_' + iIdx + '_' + Math.random().toString(36).substr(2, 4);
      });
    }
  });

  state.currentPlan.days[targetDayKey] = deepCopy;
  state.saveLocal();

  const sourceDayInfo = DAYS_OF_WEEK_BASE.find(d => d.key === sourceDayKey) || { label: sourceDayKey };
  const targetDayInfo = DAYS_OF_WEEK_BASE.find(d => d.key === targetDayKey) || { label: targetDayKey };

  renderApp();
  showToast(`「${sourceDayInfo.label}」のメニューと食材を「${targetDayInfo.label}」にコピーしました！`);
}

function renderModalDishesList() {
  const container = document.getElementById('modal-dishes-container');
  if (!container || !state.editingDayData) return;

  const sortedStores = getSortedStoresByUsage();
  const defaultStoreId = sortedStores[0] ? sortedStores[0].id : 'other';

  if (!state.editingDayData.dishes || state.editingDayData.dishes.length === 0) {
    state.editingDayData.dishes = [{
      id: 'dish_' + Date.now(),
      title: '',
      rating: 5,
      memo: '',
      ingredients: [],
      dayKey: state.editingDayKey || state.editingSourceDayKey || 'mon'
    }];
  }

  let html = '';
  state.editingDayData.dishes.forEach((dish, dIdx) => {
    const curDayKey = dish.dayKey || state.editingDayKey || state.editingSourceDayKey || 'mon';
    html += `
      <div class="dish-edit-block" data-dish-idx="${dIdx}" style="background:#fff5f7;border:1px solid #fecdd3;border-radius:var(--radius-md);padding:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <div style="font-weight:800;font-size:0.95rem;color:#372e2d;display:flex;align-items:center;gap:8px;">
            <span>メニュー品目 #${dIdx + 1}</span>
            <div style="display:inline-flex;align-items:center;gap:4px;background:#ffffff;padding:2px 8px;border-radius:12px;border:1px solid #fbcfe8;">
              <span style="font-size:0.75rem;font-weight:700;color:var(--accent-rose);">配置先:</span>
              <select class="form-select dish-day-select" data-dish-idx="${dIdx}" style="font-size:0.75rem;padding:2px 4px;font-weight:800;border:none;background:transparent;color:var(--text-main);cursor:pointer;">
                <option value="mon" ${curDayKey === 'mon' ? 'selected' : ''}>月曜日</option>
                <option value="tue" ${curDayKey === 'tue' ? 'selected' : ''}>火曜日</option>
                <option value="wed" ${curDayKey === 'wed' ? 'selected' : ''}>水曜日</option>
                <option value="thu" ${curDayKey === 'thu' ? 'selected' : ''}>木曜日</option>
                <option value="fri" ${curDayKey === 'fri' ? 'selected' : ''}>金曜日</option>
                <option value="sat" ${curDayKey === 'sat' ? 'selected' : ''}>土曜日</option>
                <option value="sun" ${curDayKey === 'sun' ? 'selected' : ''}>日曜日</option>
              </select>
            </div>
          </div>
          ${state.editingDayData.dishes.length > 1 ? `
            <button type="button" class="btn btn-secondary btn-sm remove-dish-btn" data-dish-idx="${dIdx}" style="color:#f43f5e;font-size:0.75rem;padding:3px 8px;border-color:rgba(244,63,94,0.3);">
              <i data-lucide="trash-2" style="width:12px;height:12px;"></i> 品目を削除
            </button>
          ` : ''}
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label" style="font-size:0.8rem;">料理名・品目名 (例: 特製ハンバーグ, 具だくさん豚汁)</label>
          <input type="text" class="form-input dish-title-input" value="${escapeHtml(dish.title)}" placeholder="例: 特製ハンバーグ" data-dish-idx="${dIdx}">
        </div>

        <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
          <div>
            <label class="form-label" style="font-size:0.8rem;margin-bottom:4px;">おすすめ度（星評価）</label>
            <div class="star-rating-input dish-star-rating" data-dish-idx="${dIdx}">
              ${[1, 2, 3, 4, 5].map(star => `
                <span class="star ${star <= (dish.rating || 5) ? 'filled' : ''}" data-dish-idx="${dIdx}" data-rating="${star}">★</span>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label" style="font-size:0.8rem;">メモ・レシピ案</label>
          <input type="text" class="form-input dish-memo-input" value="${escapeHtml(dish.memo || '')}" placeholder="例: 和風おろしソースで召し上がる" data-dish-idx="${dIdx}">
        </div>

        <!-- Ingredients list for this dish -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;margin-bottom:6px;">
          <span style="font-size:0.82rem;font-weight:700;color:var(--text-muted);">必要食材と購入スーパー</span>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn btn-secondary btn-sm clear-dish-ings-btn" data-dish-idx="${dIdx}" style="color:#f43f5e;font-size:0.72rem;padding:2px 6px;">
              一括全削除
            </button>
            <button type="button" class="btn btn-secondary btn-sm add-dish-ing-btn" data-dish-idx="${dIdx}" style="color:var(--accent-rose);font-size:0.75rem;padding:3px 8px;">
              <i data-lucide="plus" style="width:12px;height:12px;"></i> 食材を追加
            </button>
          </div>
        </div>

        <div class="dish-ingredients-container" data-dish-idx="${dIdx}">
          ${(dish.ingredients || []).map((ing, iIdx) => `
            <div class="form-group" style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
              <input type="text" class="form-input ing-name-input" value="${escapeHtml(ing.name)}" placeholder="食材名 (例: 豚コマ 200g)" data-dish-idx="${dIdx}" data-ing-idx="${iIdx}" style="padding:6px 10px;font-size:0.85rem;">
              <select class="form-select ing-store-select" data-dish-idx="${dIdx}" data-ing-idx="${iIdx}" style="width:120px;padding:6px 10px;font-size:0.85rem;">
                ${sortedStores.map(s => `
                  <option value="${s.id}" ${ing.storeId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
                `).join('')}
              </select>
              <button type="button" class="btn btn-secondary btn-sm remove-ing-btn" data-dish-idx="${dIdx}" data-ing-idx="${iIdx}" style="color:#f43f5e;padding:4px 8px;">
                削除
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();

  // Attach event handlers for multi-dish modal elements
  container.querySelectorAll('.dish-day-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const dIdx = parseInt(select.getAttribute('data-dish-idx'));
      if (state.editingDayData.dishes[dIdx]) {
        state.editingDayData.dishes[dIdx].dayKey = e.target.value;
      }
    });
  });

  container.querySelectorAll('.dish-title-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const dIdx = parseInt(input.getAttribute('data-dish-idx'));
      if (state.editingDayData.dishes[dIdx]) {
        state.editingDayData.dishes[dIdx].title = e.target.value;
      }
    });
  });

  container.querySelectorAll('.dish-memo-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const dIdx = parseInt(input.getAttribute('data-dish-idx'));
      if (state.editingDayData.dishes[dIdx]) {
        state.editingDayData.dishes[dIdx].memo = e.target.value;
      }
    });
  });

  container.querySelectorAll('.dish-star-rating .star').forEach(star => {
    star.addEventListener('click', () => {
      const dIdx = parseInt(star.getAttribute('data-dish-idx'));
      const rating = parseInt(star.getAttribute('data-rating'));
      if (state.editingDayData.dishes[dIdx]) {
        state.editingDayData.dishes[dIdx].rating = rating;
        renderModalDishesList();
      }
    });
  });

  container.querySelectorAll('.ing-name-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const dIdx = parseInt(input.getAttribute('data-dish-idx'));
      const iIdx = parseInt(input.getAttribute('data-ing-idx'));
      if (state.editingDayData.dishes[dIdx] && state.editingDayData.dishes[dIdx].ingredients[iIdx]) {
        state.editingDayData.dishes[dIdx].ingredients[iIdx].name = e.target.value;
      }
    });
  });

  container.querySelectorAll('.ing-store-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const dIdx = parseInt(select.getAttribute('data-dish-idx'));
      const iIdx = parseInt(select.getAttribute('data-ing-idx'));
      if (state.editingDayData.dishes[dIdx] && state.editingDayData.dishes[dIdx].ingredients[iIdx]) {
        state.editingDayData.dishes[dIdx].ingredients[iIdx].storeId = e.target.value;
      }
    });
  });

  container.querySelectorAll('.remove-ing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dIdx = parseInt(btn.getAttribute('data-dish-idx'));
      const iIdx = parseInt(btn.getAttribute('data-ing-idx'));
      if (state.editingDayData.dishes[dIdx] && state.editingDayData.dishes[dIdx].ingredients) {
        state.editingDayData.dishes[dIdx].ingredients.splice(iIdx, 1);
        renderModalDishesList();
      }
    });
  });

  container.querySelectorAll('.clear-dish-ings-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dIdx = parseInt(btn.getAttribute('data-dish-idx'));
      if (state.editingDayData.dishes[dIdx]) {
        state.editingDayData.dishes[dIdx].ingredients = [];
        renderModalDishesList();
      }
    });
  });

  container.querySelectorAll('.add-dish-ing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dIdx = parseInt(btn.getAttribute('data-dish-idx'));
      if (state.editingDayData.dishes[dIdx]) {
        if (!state.editingDayData.dishes[dIdx].ingredients) {
          state.editingDayData.dishes[dIdx].ingredients = [];
        }
        state.editingDayData.dishes[dIdx].ingredients.push({
          id: 'ing_' + Date.now() + Math.random().toString(36).substr(2, 4),
          name: '',
          storeId: defaultStoreId,
          checked: false
        });
        renderModalDishesList();
      }
    });
  });

  container.querySelectorAll('.remove-dish-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dIdx = parseInt(btn.getAttribute('data-dish-idx'));
      if (state.editingDayData.dishes.length > 1) {
        state.editingDayData.dishes.splice(dIdx, 1);
        renderModalDishesList();
      }
    });
  });
}

function setupModalHandlers() {
  const modal = document.getElementById('edit-day-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const saveBtn = document.getElementById('save-modal-btn');
  const addDishBlockBtn = document.getElementById('add-dish-block-btn');
  const dayKeySelect = document.getElementById('modal-day-key-select');
  const copyModalBtn = document.getElementById('copy-day-menu-modal-btn');

  if (dayKeySelect) {
    dayKeySelect.addEventListener('change', (e) => {
      const newDayKey = e.target.value;
      state.editingDayKey = newDayKey;
      if (state.editingDayData && state.editingDayData.dishes) {
        state.editingDayData.dishes.forEach(d => {
          d.dayKey = newDayKey;
        });
      }
      const dayInfo = DAYS_OF_WEEK_BASE.find(d => d.key === newDayKey) || { label: newDayKey };
      const titleEl = document.getElementById('modal-day-title');
      if (titleEl) titleEl.innerText = `${dayInfo.label}の献立・食材編集`;
      renderModalDishesList();
    });
  }

  if (copyModalBtn) {
    copyModalBtn.addEventListener('click', () => {
      if (state.editingDayKey) {
        openCopyDayModal(state.editingDayKey);
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (addDishBlockBtn) {
    addDishBlockBtn.addEventListener('click', () => {
      if (!state.editingDayData) return;
      state.editingDayData.dishes.push({
        id: 'dish_' + Date.now(),
        title: '',
        rating: 5,
        memo: '',
        ingredients: [],
        dayKey: state.editingDayKey || state.editingSourceDayKey || 'mon'
      });
      renderModalDishesList();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!state.editingSourceDayKey || !state.editingDayData) return;

      const sourceDayKey = state.editingSourceDayKey;

      // Filter empty ingredients
      state.editingDayData.dishes.forEach(d => {
        if (d.ingredients) {
          d.ingredients = d.ingredients.filter(ing => ing.name.trim() !== '');
        }
      });

      // Filter out completely empty dishes unless it's the only one
      const validDishes = state.editingDayData.dishes.filter(d => 
        d.title.trim() !== '' || (d.ingredients && d.ingredients.length > 0) || d.memo.trim() !== ''
      );

      // Group dishes by target day (dish.dayKey || state.editingDayKey || sourceDayKey)
      const dishesByTargetDay = {};
      const targetDayNames = [];

      if (validDishes.length === 0) {
        state.currentPlan.days[sourceDayKey] = {
          dishes: [{ id: 'dish_' + Date.now(), title: '', rating: 5, memo: '', ingredients: [] }]
        };
      } else {
        validDishes.forEach(dish => {
          const targetKey = dish.dayKey || state.editingDayKey || sourceDayKey;
          if (!dishesByTargetDay[targetKey]) dishesByTargetDay[targetKey] = [];
          dishesByTargetDay[targetKey].push(dish);
        });

        // 1. Reset source day if no dishes remain assigned to sourceDayKey
        if (!dishesByTargetDay[sourceDayKey]) {
          state.currentPlan.days[sourceDayKey] = {
            dishes: [{ id: 'dish_' + Date.now(), title: '', rating: 5, memo: '', ingredients: [] }]
          };
        } else {
          state.currentPlan.days[sourceDayKey] = { dishes: dishesByTargetDay[sourceDayKey] };
        }

        // 2. Append moved dishes to each target day
        Object.keys(dishesByTargetDay).forEach(targetKey => {
          if (targetKey === sourceDayKey) return; // Already handled above

          const targetDayInfo = DAYS_OF_WEEK_BASE.find(d => d.key === targetKey) || { label: targetKey };
          targetDayNames.push(targetDayInfo.label);

          const existingTargetData = normalizeDayData(state.currentPlan.days[targetKey]);
          const existingTargetDishes = existingTargetData.dishes.filter(d => 
            d.title.trim() !== '' || (d.ingredients && d.ingredients.length > 0) || d.memo.trim() !== ''
          );

          const newMovedDishes = dishesByTargetDay[targetKey];

          // Combine existing target dishes + newly moved dishes!
          existingTargetData.dishes = [...existingTargetDishes, ...newMovedDishes];
          state.currentPlan.days[targetKey] = existingTargetData;
        });
      }

      state.saveLocal();
      modal.classList.remove('active');
      renderApp();

      if (targetDayNames.length > 0) {
        showToast(`献立を「${targetDayNames.join(', ')}」へ移動しました！`);
      } else {
        showToast('献立と食材を保存しました！');
      }
    });
  }

  // Restore Modal Handlers
  const restoreModal = document.getElementById('restore-selector-modal');
  const closeRestoreModalBtn = document.getElementById('close-restore-modal-btn');
  const cancelRestoreBtn = document.getElementById('cancel-restore-btn');
  const confirmRestoreBtn = document.getElementById('confirm-restore-btn');

  const closeRestoreModal = () => {
    if (restoreModal) restoreModal.classList.remove('active');
  };
  if (closeRestoreModalBtn) closeRestoreModalBtn.addEventListener('click', closeRestoreModal);
  if (cancelRestoreBtn) cancelRestoreBtn.addEventListener('click', closeRestoreModal);

  if (confirmRestoreBtn) {
    confirmRestoreBtn.addEventListener('click', () => {
      if (!selectedRestoreData) return;
      if (confirm(`選択したバックアップデータ「${selectedRestoreData.displayName}」でアプリのデータを復元しますか？（現在のデータが入れ替わります）`)) {
        state.importAllData(selectedRestoreData.data);
        closeRestoreModal();
        renderApp();
        showToast(`バックアップ「${selectedRestoreData.displayName}」から正常に復元しました！`);
      }
    });
  }

  // Copy Day Modal Handlers
  const copyModal = document.getElementById('copy-day-modal');
  const closeCopyModalBtn = document.getElementById('close-copy-modal-btn');
  const cancelCopyBtn = document.getElementById('cancel-copy-btn');
  const confirmCopyBtn = document.getElementById('confirm-copy-btn');

  const closeCopyModal = () => {
    if (copyModal) copyModal.classList.remove('active');
  };
  if (closeCopyModalBtn) closeCopyModalBtn.addEventListener('click', closeCopyModal);
  if (cancelCopyBtn) cancelCopyBtn.addEventListener('click', closeCopyModal);

  if (confirmCopyBtn) {
    confirmCopyBtn.addEventListener('click', () => {
      const targetSelect = document.getElementById('target-copy-day-select');
      if (!targetSelect || !currentCopySourceDayKey) return;
      const targetDayKey = targetSelect.value;
      copyDayMenu(currentCopySourceDayKey, targetDayKey);
      closeCopyModal();
    });
  }

  // Non-menu Extra Shopping Form Handlers
  const addExtraForm = document.getElementById('add-extra-item-form');
  if (addExtraForm) {
    addExtraForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('extra-item-name-input');
      const select = document.getElementById('extra-item-store-select');
      const val = input.value.trim();
      if (!val) return;

      if (!state.extraShoppingItems) state.extraShoppingItems = [];
      state.extraShoppingItems.push({
        id: 'extra_' + Date.now() + Math.random().toString(36).substr(2, 4),
        name: val,
        storeId: select ? select.value : 'other',
        checked: false
      });

      state.saveLocal();
      input.value = '';
      showToast(`買い物メモ「${val}」を追加しました！`);
      renderShoppingPage();
    });
  }

  const clearExtraItemsBtn = document.getElementById('clear-extra-items-btn');
  if (clearExtraItemsBtn) {
    clearExtraItemsBtn.addEventListener('click', () => {
      if (!state.extraShoppingItems || state.extraShoppingItems.length === 0) {
        showToast('削除するメモがありません');
        return;
      }
      if (confirm('日常品・その他買い物メモをすべて全削除しますか？')) {
        state.extraShoppingItems = [];
        state.saveLocal();
        renderShoppingPage();
        showToast('買い物メモを一括削除しました');
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
