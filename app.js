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

function getWeekStartDate(baseDate = new Date(), startDayKey = 'mon') {
  const date = new Date(baseDate);
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
        id: 'ing_' + Date.now() + idx,
        name: name.trim(),
        storeId: 'other',
        checked: false
      }));
    }

    dishes = [{
      id: 'dish_' + Date.now(),
      title: oldDishTitle,
      rating: oldRating,
      memo: oldMemo,
      ingredients: oldIngredients
    }];
  }

  const sanitizedDishes = dishes.map((dish, dIdx) => {
    if (!dish || typeof dish !== 'object') {
      return { id: 'dish_' + Date.now() + dIdx, title: '', rating: 5, memo: '', ingredients: [] };
    }
    const safeDish = {
      id: dish.id || ('dish_' + Date.now() + dIdx),
      title: typeof dish.title === 'string' ? dish.title : '',
      rating: typeof dish.rating === 'number' ? dish.rating : 5,
      memo: typeof dish.memo === 'string' ? dish.memo : '',
      ingredients: []
    };

    if (Array.isArray(dish.ingredients)) {
      safeDish.ingredients = dish.ingredients.filter(ing => ing && typeof ing === 'object').map((ing, iIdx) => ({
        id: ing.id || ('ing_' + Date.now() + iIdx),
        name: typeof ing.name === 'string' ? ing.name : String(ing || ''),
        storeId: typeof ing.storeId === 'string' ? ing.storeId : 'other',
        checked: Boolean(ing.checked)
      }));
    } else if (typeof dish.ingredients === 'string' && dish.ingredients.trim() !== '') {
      safeDish.ingredients = dish.ingredients.split(',').map((name, iIdx) => ({
        id: 'ing_' + Date.now() + iIdx,
        name: name.trim(),
        storeId: 'other',
        checked: false
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
    this.currentPlan = sanitizeWeeklyPlan(JSON.parse(localStorage.getItem('current_plan')));
    this.history = Array.isArray(JSON.parse(localStorage.getItem('history_plans')))
      ? JSON.parse(localStorage.getItem('history_plans'))
      : [];
    this.extraShoppingItems = Array.isArray(JSON.parse(localStorage.getItem('extra_shopping_items')))
      ? JSON.parse(localStorage.getItem('extra_shopping_items'))
      : [];
    this.startDayOfWeek = localStorage.getItem('week_start_day') || 'mon';
    this.activeTab = 'planner'; // planner, shopping, history, settings
    this.shoppingFilterStore = 'all';
    this.editingDayKey = null;
    this.editingDayData = null;
    this.debugMode = localStorage.getItem('gdrive_debug_mode') === 'true';
    this.lastDebugData = null;
  }

  saveLocal(skipDriveSync = false) {
    localStorage.setItem('stores', JSON.stringify(this.stores));
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
      version: '2.0.8',
      exportedAt: new Date().toISOString(),
      startDayOfWeek: this.startDayOfWeek,
      stores: this.stores,
      currentPlan: this.currentPlan,
      history: this.history,
      extraShoppingItems: this.extraShoppingItems
    };
  }

  importAllData(data, skipDriveSync = false) {
    if (!data) return false;
    if (data.startDayOfWeek) this.startDayOfWeek = data.startDayOfWeek;
    if (data.stores && Array.isArray(data.stores) && data.stores.length > 0) {
      this.stores = data.stores;
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

// Initialize App & Event Listeners
async function initApp() {
  renderApp();
  setupNavigation();
  setupEventListeners();
  initIcons();

  if (driveSync.accessToken) {
    updateSyncStatusUI('syncing', 'Drive同期中...');
    try {
      const driveData = await driveSync.loadFromDrive();
      if (driveData && (driveData.currentPlan || driveData.stores || driveData.history)) {
        state.importAllData(driveData, true);
        renderApp();
        updateSyncStatusUI('synced', 'Drive同期済み');
        showToast('Google Driveから最新の献立・店舗タグデータを自動読み込みしました！');
      }
    } catch (err) {
      console.log('Auto Drive refresh sync info:', err.message);
      if (err.message && err.message.includes('認証期限')) {
        updateSyncStatusUI('expired', 'Drive要再認証');
      } else {
        updateSyncStatusUI('offline', 'ローカル保存');
      }
    }
  } else {
    updateSyncStatusUI('offline', 'ローカル保存');
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

  document.querySelectorAll('.page').forEach(p => {
    if (p.id === `page-${tabId}`) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
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

/* ==========================================================================
   1. Weekly Dinner Planner Page Render
   ========================================================================== */
function renderPlannerPage() {
  const container = document.getElementById('planner-cards-container');
  const dateRangeEl = document.getElementById('planner-date-range');
  if (!container || !dateRangeEl) return;

  renderExtraShoppingItems();

  if (!state.currentPlan || !state.currentPlan.days) {
    state.currentPlan = DEFAULT_WEEKLY_PLAN;
  }

  const startDate = state.currentPlan.startDate || new Date().toISOString();
  dateRangeEl.innerText = formatDateRange(startDate);

  let html = '';
  const days = getOrderedDaysOfWeek();
  days.forEach(dayInfo => {
    const dayRaw = state.currentPlan.days[dayInfo.key];
    const dayData = normalizeDayData(dayRaw);
    const isToday = checkIsToday(state.currentPlan.startDate, dayInfo.key);

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
            ${dayInfo.label} ${isToday ? '(本日)' : ''}
          </span>
          <button class="btn btn-secondary btn-sm edit-day-btn" data-day="${dayInfo.key}">
            <i data-lucide="edit-3" style="width:14px;height:14px;"></i> 編集
          </button>
        </div>

        ${dishesHtml}
      </div>
    `;
  });

  container.innerHTML = html;

  // Attach Event Handlers
  container.querySelectorAll('.edit-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dayKey = btn.getAttribute('data-day');
      openEditDayModal(dayKey);
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
        orderIndex: item.order !== undefined ? item.order : idx
      });
    });
  }

  // 2. Recipe Ingredients
  const days = getOrderedDaysOfWeek();
  days.forEach(dayInfo => {
    const dayRaw = state.currentPlan.days[dayInfo.key];
    const dayData = normalizeDayData(dayRaw);
    if (dayData && dayData.dishes) {
      dayData.dishes.forEach((dish, dIdx) => {
        if (dish.ingredients) {
          dish.ingredients.forEach((ing, iIdx) => {
            const storeId = ing.storeId || 'other';
            if (!itemsByStore[storeId]) itemsByStore[storeId] = [];
            itemsByStore[storeId].push({
              ...ing,
              isExtra: false,
              sourceTag: `${dayInfo.short}: ${dish.title || 'メニュー'}`,
              dayKey: dayInfo.key,
              dishId: dish.id,
              orderIndex: ing.order !== undefined ? ing.order : (dIdx * 10 + iIdx)
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
            <div class="shopping-item-row ${item.checked ? 'checked' : ''}" data-store-id="${store.id}" data-idx="${idx}">
              <div class="shopping-item-left">
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
                <div style="display:inline-flex;gap:2px;">
                  <button type="button" class="reorder-btn move-up-btn" data-store-id="${store.id}" data-idx="${idx}" title="上に移動" style="padding:2px 6px;font-size:0.72rem;background:#ffe4e6;border:1px solid #fecdd3;border-radius:4px;cursor:pointer;color:#ff4d6d;font-weight:700;">▲</button>
                  <button type="button" class="reorder-btn move-down-btn" data-store-id="${store.id}" data-idx="${idx}" title="下に移動" style="padding:2px 6px;font-size:0.72rem;background:#ffe4e6;border:1px solid #fecdd3;border-radius:4px;cursor:pointer;color:#ff4d6d;font-weight:700;">▼</button>
                </div>
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

  // Reorder Item Handlers (Move Up / Move Down)
  shoppingListContainer.querySelectorAll('.move-up-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const storeId = btn.getAttribute('data-store-id');
      const idx = parseInt(btn.getAttribute('data-idx'));
      if (idx > 0 && itemsByStore[storeId]) {
        swapShoppingItemsOrder(itemsByStore[storeId], idx, idx - 1);
      }
    });
  });

  shoppingListContainer.querySelectorAll('.move-down-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const storeId = btn.getAttribute('data-store-id');
      const idx = parseInt(btn.getAttribute('data-idx'));
      if (itemsByStore[storeId] && idx < itemsByStore[storeId].length - 1) {
        swapShoppingItemsOrder(itemsByStore[storeId], idx, idx + 1);
      }
    });
  });
}

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
            const dayData = hist.plan && hist.plan.days ? hist.plan.days[d.key] : null;
            const r = dayData && dayData.rating ? dayData.rating : 5;
            return `
              <div class="history-menu-item">
                <div class="history-day">${d.short}曜 <span style="color:#ffb703;">${'★'.repeat(r)}</span></div>
                <div class="history-dish">${escapeHtml(dayData ? dayData.dish || '-' : '-')}</div>
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
  const archiveCurrentBtn = document.getElementById('archive-current-plan-btn');
  if (archiveCurrentBtn) {
    archiveCurrentBtn.addEventListener('click', () => {
      const titlePrompt = prompt('保存する履歴のタイトルを入力してください:', `${formatDateRange(state.currentPlan.startDate)}の献立`);
      if (titlePrompt) {
        const newHist = {
          id: 'hist_' + Date.now(),
          savedAt: new Date().toISOString(),
          startDate: state.currentPlan.startDate,
          title: titlePrompt,
          plan: JSON.parse(JSON.stringify(state.currentPlan))
        };
        state.history.unshift(newHist);
        state.saveLocal();
        showToast('Google Drive・ローカル履歴にアーカイブ保存しました！');
        switchTab('history');
      }
    });
  }

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
          showToast('Google認証が完了しました！クラウドデータを同期します...');
          try {
            updateSyncStatusUI('syncing', 'Drive同期中...');
            
            // Try loading from Drive first to avoid overwriting Drive data with local defaults!
            let loaded = false;
            try {
              const driveData = await driveSync.loadFromDrive();
              if (driveData && (driveData.currentPlan || driveData.stores || driveData.history)) {
                state.importAllData(driveData, true);
                loaded = true;
              }
            } catch (loadErr) {
              console.log('No existing Drive data or empty, saving local state instead:', loadErr.message);
            }

            if (!loaded) {
              await driveSync.saveToDrive(state.exportAllData());
            }

            updateSyncStatusUI('synced', 'Drive同期済み');
            renderApp();
            showToast(loaded ? 'Google Driveからクラウドデータを読み込み同期しました！' : 'Google Driveに初期データを同期保存しました！');
          } catch (err) {
            updateSyncStatusUI('offline', 'ローカル保存');
            alert(err.message);
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
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.exportAllData(), null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `WeeklyDinner_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  const importJsonInput = document.getElementById('import-json-input');
  if (importJsonInput) {
    importJsonInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (state.importAllData(imported)) {
            showToast('バックアップファイルからデータを復元しました！');
            renderApp();
          }
        } catch (err) {
          alert('JSONファイルの読み込み失敗: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // Day Editing Modal Logic
  setupModalHandlers();
}

function openEditDayModal(dayKey) {
  state.editingDayKey = dayKey;
  const days = getOrderedDaysOfWeek();
  const dayInfo = days.find(d => d.key === dayKey) || DAYS_OF_WEEK_BASE.find(d => d.key === dayKey);
  const dayRaw = state.currentPlan.days[dayKey];

  state.editingDayData = JSON.parse(JSON.stringify(normalizeDayData(dayRaw)));

  document.getElementById('modal-day-title').innerText = `${dayInfo.label}の献立・食材編集`;
  
  renderModalDishesList();

  const modal = document.getElementById('edit-day-modal');
  modal.classList.add('active');
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
      ingredients: []
    }];
  }

  let html = '';
  state.editingDayData.dishes.forEach((dish, dIdx) => {
    html += `
      <div class="dish-edit-block" data-dish-idx="${dIdx}" style="background:#fff5f7;border:1px solid #fecdd3;border-radius:var(--radius-md);padding:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-weight:800;font-size:0.95rem;color:#372e2d;">
            メニュー品目 #${dIdx + 1}
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
        ingredients: []
      });
      renderModalDishesList();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!state.editingDayKey || !state.editingDayData) return;

      // Filter empty ingredients
      state.editingDayData.dishes.forEach(d => {
        if (d.ingredients) {
          d.ingredients = d.ingredients.filter(ing => ing.name.trim() !== '');
        }
      });

      // Filter out completely empty dishes unless it's the only one
      state.editingDayData.dishes = state.editingDayData.dishes.filter(d => 
        d.title.trim() !== '' || (d.ingredients && d.ingredients.length > 0) || d.memo.trim() !== ''
      );

      if (state.editingDayData.dishes.length === 0) {
        state.editingDayData.dishes = [{
          id: 'dish_' + Date.now(),
          title: '',
          rating: 5,
          memo: '',
          ingredients: []
        }];
      }

      state.currentPlan.days[state.editingDayKey] = state.editingDayData;
      state.saveLocal();
      modal.classList.remove('active');
      renderApp();
      showToast('献立と食材を保存しました！');
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
