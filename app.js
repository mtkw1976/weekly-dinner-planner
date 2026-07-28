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

// Days of the week definition
const DAYS_OF_WEEK = [
  { key: 'mon', label: '月曜日', short: '月' },
  { key: 'tue', label: '火曜日', short: '火' },
  { key: 'wed', label: '水曜日', short: '水' },
  { key: 'thu', label: '木曜日', short: '木' },
  { key: 'fri', label: '金曜日', short: '金' },
  { key: 'sat', label: '土曜日', short: '土' },
  { key: 'sun', label: '日曜日', short: '日' },
];

// Default Initial Sample Data
const DEFAULT_WEEKLY_PLAN = {
  id: 'current',
  startDate: getMonday(new Date()).toISOString().split('T')[0],
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

// Helper: Get Monday of current week
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

// Helper: Format Date String
function formatDateRange(startDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startFormatted = `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()}`;
  const endFormatted = `${end.getMonth() + 1}/${end.getDate()}`;
  return `${startFormatted} (月) 〜 ${endFormatted} (日)`;
}

// App State Management
class AppState {
  constructor() {
    this.stores = JSON.parse(localStorage.getItem('stores')) || DEFAULT_STORES;
    this.currentPlan = JSON.parse(localStorage.getItem('current_plan')) || DEFAULT_WEEKLY_PLAN;
    this.history = JSON.parse(localStorage.getItem('history_plans')) || [
      {
        id: 'hist_sample_1',
        savedAt: '2026-07-19T18:00:00.000Z',
        startDate: '2026-07-13',
        title: '7月第3週のスタミナ献立',
        plan: JSON.parse(JSON.stringify(DEFAULT_WEEKLY_PLAN))
      }
    ];
    this.activeTab = 'planner'; // planner, shopping, history, settings
    this.shoppingFilterStore = 'all';
    this.editingDayKey = null;
    this.editingModalRating = 5;
    this.debugMode = localStorage.getItem('gdrive_debug_mode') === 'true';
    this.lastDebugData = null;
  }

  saveLocal(skipDriveSync = false) {
    localStorage.setItem('stores', JSON.stringify(this.stores));
    localStorage.setItem('current_plan', JSON.stringify(this.currentPlan));
    localStorage.setItem('history_plans', JSON.stringify(this.history));
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
      version: '1.3.0',
      exportedAt: new Date().toISOString(),
      stores: this.stores,
      currentPlan: this.currentPlan,
      history: this.history
    };
  }

  importAllData(data, skipDriveSync = false) {
    if (!data) return false;
    if (data.stores && Array.isArray(data.stores) && data.stores.length > 0) {
      this.stores = data.stores;
    }
    if (data.currentPlan && data.currentPlan.days) {
      this.currentPlan = data.currentPlan;
    }
    if (data.history && Array.isArray(data.history)) {
      this.history = data.history;
    }
    this.saveLocal(skipDriveSync);
    return true;
  }
}

const state = new AppState();

// Initialize App & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  renderApp();
  setupNavigation();
  setupEventListeners();
  initIcons();
  if (driveSync.accessToken) {
    updateSyncStatusUI('synced', 'Drive連携中');
  } else {
    updateSyncStatusUI('offline', 'ローカル保存');
  }
});

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
  renderPlannerPage();
  renderShoppingPage();
  renderHistoryPage();
  renderSettingsPage();
  initIcons();
}

/* ==========================================================================
   1. Weekly Dinner Planner Page Render
   ========================================================================== */
function renderPlannerPage() {
  const container = document.getElementById('planner-cards-container');
  const dateRangeEl = document.getElementById('planner-date-range');
  if (!container || !dateRangeEl) return;

  dateRangeEl.innerText = formatDateRange(state.currentPlan.startDate);

  let html = '';
  DAYS_OF_WEEK.forEach(dayInfo => {
    const dayData = state.currentPlan.days[dayInfo.key] || { dish: '', memo: '', ingredients: [] };
    const isToday = checkIsToday(state.currentPlan.startDate, dayInfo.key);

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
        
        <div class="menu-title">${escapeHtml(dayData.dish || '（未登録）')}</div>
        ${renderStarRatingHtml(dayData.rating || 5, dayInfo.key)}
        ${dayData.memo ? `<div class="menu-memo">${escapeHtml(dayData.memo)}</div>` : ''}

        <div class="ingredients-list">
          ${dayData.ingredients && dayData.ingredients.length > 0 ? 
            dayData.ingredients.map(ing => {
              const store = state.stores.find(s => s.id === ing.storeId) || { name: '未定', cssClass: 'tag-other', color: '#64748b' };
              return `
                <div class="ingredient-chip">
                  <span>${escapeHtml(ing.name)}</span>
                  <span class="store-tag ${store.cssClass || 'tag-other'}" style="${store.color ? `background-color: ${store.color};` : ''}">${escapeHtml(store.name)}</span>
                </div>
              `;
            }).join('')
            : '<span style="font-size:0.8rem;color:var(--text-subtle);">必要食材がまだ登録されていません</span>'
          }
        </div>
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
      const starValue = parseInt(star.getAttribute('data-star'));
      if (dayKey && state.currentPlan.days[dayKey]) {
        state.currentPlan.days[dayKey].rating = starValue;
        state.saveLocal();
        renderPlannerPage();
        showToast(`${starValue}つ星に評価しました！⭐`);
      }
    });
  });
}

function renderStarRatingHtml(rating = 5, dayKey = '') {
  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    const isFilled = i <= rating;
    starsHtml += `<span class="star ${isFilled ? 'filled' : ''}" data-day="${dayKey}" data-star="${i}" title="${i}つ星">★</span>`;
  }
  return `<div class="star-rating-display">${starsHtml}</div>`;
}

function checkIsToday(startDateStr, dayKey) {
  const dayIndex = DAYS_OF_WEEK.findIndex(d => d.key === dayKey);
  const start = new Date(startDateStr);
  const targetDate = new Date(start);
  targetDate.setDate(targetDate.getDate() + dayIndex);
  
  const today = new Date();
  return today.getFullYear() === targetDate.getFullYear() &&
         today.getMonth() === targetDate.getMonth() &&
         today.getDate() === targetDate.getDate();
}

/* ==========================================================================
   2. Supermarket-wise Shopping List Page Render
   ========================================================================== */
function renderShoppingPage() {
  const filterBar = document.getElementById('store-filter-bar');
  const shoppingListContainer = document.getElementById('shopping-list-container');
  if (!filterBar || !shoppingListContainer) return;

  // Render Filter Chips
  let filterHtml = `
    <button class="filter-chip ${state.shoppingFilterStore === 'all' ? 'active' : ''}" data-store="all">
      すべてのスーパー
    </button>
  `;
  state.stores.forEach(store => {
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

  // Group ingredients by store
  const itemsByStore = {};
  state.stores.forEach(s => { itemsByStore[s.id] = []; });

  DAYS_OF_WEEK.forEach(dayInfo => {
    const dayData = state.currentPlan.days[dayInfo.key];
    if (dayData && dayData.ingredients) {
      dayData.ingredients.forEach(ing => {
        const storeId = ing.storeId || 'other';
        if (!itemsByStore[storeId]) itemsByStore[storeId] = [];
        itemsByStore[storeId].push({
          ...ing,
          dayLabel: dayInfo.short,
          dish: dayData.dish,
          dayKey: dayInfo.key
        });
      });
    }
  });

  let listHtml = '';
  let totalItemsCount = 0;
  let checkedItemsCount = 0;

  state.stores.forEach(store => {
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
      <div class="shopping-section">
        <div class="shopping-section-header">
          <div class="store-header-title">
            <span class="store-tag ${store.cssClass || 'tag-other'}" style="${store.color ? `background-color: ${store.color};` : ''}">${escapeHtml(store.name)}</span>
            <span>(${storeCheckedCount}/${items.length})</span>
          </div>
        </div>
        <div class="shopping-items-body">
          ${items.map(item => `
            <div class="shopping-item-row ${item.checked ? 'checked' : ''}">
              <div class="shopping-item-left">
                <div class="custom-checkbox ${item.checked ? 'checked' : ''}" 
                     data-day="${item.dayKey}" data-ing-id="${item.id}">
                  ${item.checked ? '<i data-lucide="check" style="width:14px;height:14px;"></i>' : ''}
                </div>
                <div>
                  <div class="shopping-item-name">${escapeHtml(item.name)}</div>
                </div>
              </div>
              <div class="shopping-item-menu">${item.dayLabel}: ${escapeHtml(item.dish || '献立')}</div>
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
        <p>買い物リストは空です。今週の献立に食材を追加してください。</p>
      </div>
    `;
  }

  shoppingListContainer.innerHTML = listHtml;

  // Toggle Item Checked
  shoppingListContainer.querySelectorAll('.custom-checkbox').forEach(box => {
    box.addEventListener('click', () => {
      const dayKey = box.getAttribute('data-day');
      const ingId = box.getAttribute('data-ing-id');
      const dayData = state.currentPlan.days[dayKey];
      if (dayData && dayData.ingredients) {
        const targetIng = dayData.ingredients.find(i => i.id === ingId);
        if (targetIng) {
          targetIng.checked = !targetIng.checked;
          state.saveLocal();
          renderShoppingPage();
        }
      }
    });
  });
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
          ${DAYS_OF_WEEK.map(d => {
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

  container.innerHTML = state.stores.map(store => `
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
      DAYS_OF_WEEK.forEach(d => {
        const dayData = state.currentPlan.days[d.key];
        if (dayData && dayData.ingredients) {
          dayData.ingredients = dayData.ingredients.filter(i => !i.checked);
        }
      });
      state.saveLocal();
      renderShoppingPage();
      showToast('チェック済みの食材を整理しました！');
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
  const dayInfo = DAYS_OF_WEEK.find(d => d.key === dayKey);
  const dayData = state.currentPlan.days[dayKey] || { dish: '', memo: '', rating: 5, ingredients: [] };

  document.getElementById('modal-day-title').innerText = `${dayInfo.label}の献立・食材編集`;
  document.getElementById('edit-dish-input').value = dayData.dish || '';
  document.getElementById('edit-memo-input').value = dayData.memo || '';

  state.editingModalRating = dayData.rating || 5;
  updateModalStarRatingUI(state.editingModalRating);

  renderModalIngredientsList(dayData.ingredients || []);

  const modal = document.getElementById('edit-day-modal');
  modal.classList.add('active');
}

function updateModalStarRatingUI(rating) {
  const stars = document.querySelectorAll('#modal-star-rating .star');
  stars.forEach(s => {
    const r = parseInt(s.getAttribute('data-rating'));
    if (r <= rating) {
      s.classList.add('filled');
    } else {
      s.classList.remove('filled');
    }
  });
}

function renderModalIngredientsList(ingredients) {
  const container = document.getElementById('modal-ingredients-container');
  if (!container) return;

  let html = '';
  ingredients.forEach((ing, idx) => {
    html += `
      <div class="form-group" style="display:flex;gap:8px;align-items:center;">
        <input type="text" class="form-input ing-name-input" value="${escapeHtml(ing.name)}" placeholder="食材名 (例: 豚コマ肉 200g)" data-idx="${idx}">
        <select class="form-select ing-store-select" data-idx="${idx}" style="width:140px;">
          ${state.stores.map(s => `
            <option value="${s.id}" ${ing.storeId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
          `).join('')}
        </select>
        <button class="btn btn-secondary btn-sm remove-ing-btn" data-idx="${idx}" style="color:#f43f5e;">
          削除
        </button>
      </div>
    `;
  });

  container.innerHTML = html;

  // Event to remove ingredient row
  container.querySelectorAll('.remove-ing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      syncModalDOMToState();
      const idx = parseInt(btn.getAttribute('data-idx'));
      const dayData = state.currentPlan.days[state.editingDayKey];
      if (dayData && dayData.ingredients) {
        dayData.ingredients.splice(idx, 1);
        renderModalIngredientsList(dayData.ingredients);
      }
    });
  });
}

function syncModalDOMToState() {
  if (!state.editingDayKey || !state.currentPlan || !state.currentPlan.days) return;
  const dayData = state.currentPlan.days[state.editingDayKey];
  if (!dayData) return;

  const nameInputs = document.querySelectorAll('.ing-name-input');
  const storeSelects = document.querySelectorAll('.ing-store-select');

  const syncedIngredients = [];
  nameInputs.forEach((input, idx) => {
    const val = input.value;
    const storeVal = storeSelects[idx] ? storeSelects[idx].value : (state.stores[0] ? state.stores[0].id : 'other');
    syncedIngredients.push({
      id: dayData.ingredients && dayData.ingredients[idx] ? dayData.ingredients[idx].id : 'ing_' + Date.now() + idx,
      name: val,
      storeId: storeVal,
      checked: dayData.ingredients && dayData.ingredients[idx] ? dayData.ingredients[idx].checked : false
    });
  });

  dayData.ingredients = syncedIngredients;
}

function setupModalHandlers() {
  const modal = document.getElementById('edit-day-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const saveBtn = document.getElementById('save-modal-btn');
  const addIngBtn = document.getElementById('add-ingredient-row-btn');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  const modalStars = document.querySelectorAll('#modal-star-rating .star');
  modalStars.forEach(s => {
    s.addEventListener('click', () => {
      const r = parseInt(s.getAttribute('data-rating'));
      state.editingModalRating = r;
      updateModalStarRatingUI(r);
    });
  });

  if (addIngBtn) {
    addIngBtn.addEventListener('click', () => {
      syncModalDOMToState();
      const dayData = state.currentPlan.days[state.editingDayKey];
      if (!dayData.ingredients) dayData.ingredients = [];
      dayData.ingredients.push({
        id: 'ing_' + Date.now() + Math.random().toString(36).substr(2, 4),
        name: '',
        storeId: state.stores[0] ? state.stores[0].id : 'other',
        checked: false
      });
      renderModalIngredientsList(dayData.ingredients);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      syncModalDOMToState();
      const dayData = state.currentPlan.days[state.editingDayKey];
      dayData.dish = document.getElementById('edit-dish-input').value;
      dayData.memo = document.getElementById('edit-memo-input').value;
      dayData.rating = state.editingModalRating || 5;

      // Filter out empty ingredient names
      dayData.ingredients = dayData.ingredients.filter(i => i.name.trim() !== '');

      state.saveLocal();
      modal.classList.remove('active');
      renderApp();
      showToast('献立と食材を更新しました！');
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
