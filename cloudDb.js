/**
 * Google Cloud (Cloud Firestore) & Firebase Authentication Sync Module
 * Enables real-time multi-user (husband & wife) concurrent access to a shared database
 * without any build step (loads Firebase Web SDK via official ES Modules CDN on demand).
 */

const FIREBASE_SDK_VERSION = '11.6.0';
const STORAGE_KEY_CONFIG = 'cloud_firebase_config';
const STORAGE_KEY_HOUSEHOLD = 'cloud_household_id';
const DEFAULT_HOUSEHOLD_ID = 'family-main';

/**
 * Recursively remove undefined values so Firestore never throws
 * "Unsupported field value: undefined".
 */
export function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item));
  }
  if (value && typeof value === 'object') {
    const cleaned = {};
    Object.keys(value).forEach((key) => {
      const val = value[key];
      if (val !== undefined) {
        cleaned[key] = stripUndefined(val);
      }
    });
    return cleaned;
  }
  return value;
}

/**
 * Sanitize household ID so it is safe as a Firestore document ID.
 */
export function sanitizeHouseholdId(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned || DEFAULT_HOUSEHOLD_ID;
}

/**
 * Parse Firebase config from either:
 * 1. Standard JSON string: {"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}
 * 2. Share bundle JSON: {"householdId":"...","firebaseConfig":{...}}
 * 3. Firebase Console JS snippet: const firebaseConfig = { apiKey: "...", ... };
 */
export function parseFirebaseConfigText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Firebase設定が空です。');
  }

  let text = rawText.trim();
  if (!text) {
    throw new Error('Firebase設定が空です。');
  }

  // First try direct JSON parse
  try {
    const parsed = JSON.parse(text);
    return extractConfigPayload(parsed);
  } catch (_) {
    // Fallback: parse Firebase Console JS object snippet
  }

  // Extract the first {...} block
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error('設定形式を認識できません。Firebaseコンソールの firebaseConfig オブジェクト、またはJSONを貼り付けてください。');
  }

  let objText = text.slice(startIdx, endIdx + 1);
  // Remove JS comments (//... and /*...*/) carefully outside strings
  objText = objText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  // Convert single quotes to double quotes for keys/values
  objText = objText.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
  // Quote unquoted keys: { apiKey: "..." } -> { "apiKey": "..." }
  objText = objText.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
  // Remove trailing commas
  objText = objText.replace(/,\s*([}\]])/g, '$1');

  try {
    const parsed = JSON.parse(objText);
    return extractConfigPayload(parsed);
  } catch (err) {
    throw new Error(`設定の解析に失敗しました: ${err.message}`);
  }
}

function extractConfigPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('有効な設定オブジェクトではありません。');
  }

  let householdId = null;
  let configObj = parsed;

  if (parsed.firebaseConfig && typeof parsed.firebaseConfig === 'object') {
    configObj = parsed.firebaseConfig;
    if (parsed.householdId) {
      householdId = sanitizeHouseholdId(parsed.householdId);
    }
  }

  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = requiredKeys.filter((k) => !configObj[k] || typeof configObj[k] !== 'string');
  if (missing.length > 0) {
    throw new Error(`必須項目が不足しています: ${missing.join(', ')}`);
  }

  const normalizedConfig = {
    apiKey: configObj.apiKey.trim(),
    authDomain: configObj.authDomain.trim(),
    projectId: configObj.projectId.trim(),
    appId: configObj.appId.trim(),
  };

  if (typeof configObj.storageBucket === 'string' && configObj.storageBucket.trim()) {
    normalizedConfig.storageBucket = configObj.storageBucket.trim();
  }
  if (typeof configObj.messagingSenderId === 'string' && configObj.messagingSenderId.trim()) {
    normalizedConfig.messagingSenderId = configObj.messagingSenderId.trim();
  }

  return { firebaseConfig: normalizedConfig, householdId };
}

export class CloudDatabaseSync {
  constructor() {
    this.config = this._loadStoredConfig();
    this.householdId = sanitizeHouseholdId(localStorage.getItem(STORAGE_KEY_HOUSEHOLD) || DEFAULT_HOUSEHOLD_ID);

    this.sdk = null;
    this.app = null;
    this.auth = null;
    this.db = null;
    this.user = null;

    this.unsubscribers = [];
    this.authUnsubscriber = null;
    this.isSubscribed = false;
    this.isInitialized = false;
    this.lastSyncAt = null;
    this.lastError = null;
    this.onAuthChangeCallback = null;
  }

  _loadStoredConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.apiKey && parsed.authDomain && parsed.projectId && parsed.appId) {
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  isConfigured() {
    return Boolean(this.config && this.config.apiKey && this.config.authDomain && this.config.projectId && this.config.appId);
  }

  getConfig() {
    return this.config ? { ...this.config } : null;
  }

  getConfigDisplayString() {
    return this.config ? JSON.stringify(this.config, null, 2) : '';
  }

  getHouseholdId() {
    return this.householdId;
  }

  setHouseholdId(rawId) {
    this.householdId = sanitizeHouseholdId(rawId);
    localStorage.setItem(STORAGE_KEY_HOUSEHOLD, this.householdId);
    return this.householdId;
  }

  saveConfigFromText(rawText, householdIdOverride = null) {
    const { firebaseConfig, householdId } = parseFirebaseConfigText(rawText);
    this.config = firebaseConfig;
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(firebaseConfig));

    if (householdIdOverride && String(householdIdOverride).trim()) {
      this.setHouseholdId(householdIdOverride);
    } else if (householdId) {
      this.setHouseholdId(householdId);
    }

    return {
      firebaseConfig: this.getConfig(),
      householdId: this.householdId
    };
  }

  exportShareConfig() {
    if (!this.isConfigured()) {
      throw new Error('先にFirebase設定を保存してください。');
    }
    return JSON.stringify(
      {
        householdId: this.householdId,
        firebaseConfig: this.config
      },
      null,
      2
    );
  }

  importShareConfig(rawText) {
    return this.saveConfigFromText(rawText);
  }

  isSignedIn() {
    return Boolean(this.user);
  }

  getCurrentUser() {
    if (!this.user) return null;
    return {
      uid: this.user.uid,
      email: this.user.email || '',
      displayName: this.user.displayName || this.user.email || 'ユーザー'
    };
  }

  async _loadFirebaseSdk() {
    if (this.sdk) return this.sdk;
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`)
    ]);
    this.sdk = { appMod, authMod, fsMod };
    return this.sdk;
  }

  async init(onAuthStateChange) {
    if (onAuthStateChange) {
      this.onAuthChangeCallback = onAuthStateChange;
    }

    if (!this.isConfigured()) {
      return false;
    }

    try {
      const { appMod, authMod, fsMod } = await this._loadFirebaseSdk();

      // Re-create app if project changed
      const existingApps = appMod.getApps();
      if (existingApps.length > 0) {
        const existing = existingApps[0];
        if (
          existing.options.projectId === this.config.projectId &&
          existing.options.apiKey === this.config.apiKey &&
          existing.options.appId === this.config.appId
        ) {
          this.app = existing;
        } else {
          this.stopRealtimeSync();
          if (this.authUnsubscriber) {
            this.authUnsubscriber();
            this.authUnsubscriber = null;
          }
          await appMod.deleteApp(existing);
          this.app = appMod.initializeApp(this.config);
          this.db = null;
          this.auth = null;
        }
      } else {
        this.app = appMod.initializeApp(this.config);
      }

      if (!this.auth) {
        this.auth = authMod.getAuth(this.app);
      }

      if (!this.db) {
        try {
          this.db = fsMod.initializeFirestore(this.app, {
            localCache: fsMod.persistentLocalCache({
              tabManager: fsMod.persistentMultipleTabManager()
            })
          });
        } catch (_) {
          // Fallback if Firestore was already initialized or IndexedDB is unavailable
          this.db = fsMod.getFirestore(this.app);
        }
      }

      // Handle mobile redirect sign-in result if returning from redirect flow
      try {
        await authMod.getRedirectResult(this.auth);
      } catch (redirErr) {
        console.warn('Redirect sign-in notice:', redirErr.message);
      }

      if (!this.authUnsubscriber) {
        this.authUnsubscriber = authMod.onAuthStateChanged(this.auth, (user) => {
          this.user = user || null;
          if (!this.user) {
            this.stopRealtimeSync();
          }
          if (this.onAuthChangeCallback) {
            this.onAuthChangeCallback(this.getCurrentUser());
          }
        });
      }

      this.isInitialized = true;
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = err.message;
      console.error('Firebase init error:', err);
      throw err;
    }
  }

  async signInWithGoogle() {
    if (!this.isConfigured()) {
      throw new Error('先に「Firebase / Google Cloud 設定」を入力して保存してください。');
    }
    if (!this.isInitialized) {
      await this.init(this.onAuthChangeCallback);
    }

    const { authMod } = this.sdk;
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await authMod.signInWithPopup(this.auth, provider);
      this.user = result.user;
      return this.getCurrentUser();
    } catch (err) {
      // On some mobile browsers (iOS Safari PWA), popups can be blocked -> fallback to redirect
      if (
        err &&
        (err.code === 'auth/popup-blocked' ||
          err.code === 'auth/operation-not-supported-in-this-environment')
      ) {
        await authMod.signInWithRedirect(this.auth, provider);
        return null;
      }
      throw this._formatAuthError(err);
    }
  }

  async signOut() {
    this.stopRealtimeSync();
    if (this.auth && this.sdk) {
      await this.sdk.authMod.signOut(this.auth);
    }
    this.user = null;
  }

  _formatAuthError(err) {
    const code = err && err.code ? err.code : '';
    if (code === 'auth/unauthorized-domain') {
      return new Error(
        `このドメイン (${window.location.hostname}) は Firebase Authentication の「承認済みドメイン」に未登録です。CLOUD_SETUP.md を参照して追加してください。`
      );
    }
    if (code === 'auth/popup-closed-by-user') {
      return new Error('ログイン画面が閉じられました。もう一度お試しください。');
    }
    if (code === 'auth/operation-not-allowed') {
      return new Error('Firebase Console で「Google」ログインプロバイダが有効になっていません。');
    }
    if (code === 'auth/invalid-api-key') {
      return new Error('Firebase の apiKey が正しくありません。設定内容を確認してください。');
    }
    return new Error(err && err.message ? err.message : 'Googleログインに失敗しました。');
  }

  formatFirestoreError(err) {
    const code = err && err.code ? err.code : '';
    if (code === 'permission-denied') {
      const email = this.user && this.user.email ? this.user.email : '現在のアカウント';
      return new Error(
        `データベースへのアクセス権限がありません（${email}）。Firestore セキュリティルールにこのメールアドレスが許可されているか確認してください。`
      );
    }
    if (code === 'unavailable') {
      return new Error('オフライン状態です。オンライン復帰時に自動で再同期されます。');
    }
    return new Error(err && err.message ? err.message : 'クラウドデータベースとの通信に失敗しました。');
  }

  _ensureReady() {
    if (!this.db || !this.sdk || !this.user) {
      throw new Error('Google Cloud 共有DBにログインしていません。');
    }
  }

  _auditFields() {
    return {
      updatedAt: new Date().toISOString(),
      updatedBy: this.user ? (this.user.email || this.user.uid) : 'local'
    };
  }

  _metaDocRef() {
    const { fsMod } = this.sdk;
    return fsMod.doc(this.db, 'households', this.householdId, 'meta', 'config');
  }

  _weeksColRef() {
    const { fsMod } = this.sdk;
    return fsMod.collection(this.db, 'households', this.householdId, 'weeks');
  }

  _weekDocRef(weekStartDate) {
    const { fsMod } = this.sdk;
    return fsMod.doc(this.db, 'households', this.householdId, 'weeks', weekStartDate);
  }

  _extraItemsColRef() {
    const { fsMod } = this.sdk;
    return fsMod.collection(this.db, 'households', this.householdId, 'extraItems');
  }

  _extraItemDocRef(itemId) {
    const { fsMod } = this.sdk;
    return fsMod.doc(this.db, 'households', this.householdId, 'extraItems', itemId);
  }

  _historyColRef() {
    const { fsMod } = this.sdk;
    return fsMod.collection(this.db, 'households', this.householdId, 'history');
  }

  _historyDocRef(histId) {
    const { fsMod } = this.sdk;
    return fsMod.doc(this.db, 'households', this.householdId, 'history', histId);
  }

  /**
   * Check whether the shared household already has any data in Cloud Firestore.
   */
  async hasRemoteData() {
    this._ensureReady();
    const { fsMod } = this.sdk;
    try {
      const metaSnap = await fsMod.getDoc(this._metaDocRef());
      if (metaSnap.exists()) return true;

      const weeksSnap = await fsMod.getDocs(fsMod.query(this._weeksColRef(), fsMod.limit(1)));
      if (!weeksSnap.empty) return true;

      const extraSnap = await fsMod.getDocs(fsMod.query(this._extraItemsColRef(), fsMod.limit(1)));
      if (!extraSnap.empty) return true;

      const histSnap = await fsMod.getDocs(fsMod.query(this._historyColRef(), fsMod.limit(1)));
      if (!histSnap.empty) return true;

      return false;
    } catch (err) {
      throw this.formatFirestoreError(err);
    }
  }

  /**
   * Save shared app settings (stores & startDayOfWeek).
   */
  async saveMetaConfig({ startDayOfWeek, stores }) {
    this._ensureReady();
    const { fsMod } = this.sdk;
    const payload = stripUndefined({
      startDayOfWeek: startDayOfWeek || 'mon',
      stores: Array.isArray(stores) ? stores : [],
      ...this._auditFields()
    });
    await fsMod.setDoc(this._metaDocRef(), payload, { merge: true });
    this.lastSyncAt = new Date().toISOString();
  }

  /**
   * Save only specific day(s) of a week to avoid overwriting concurrent edits on other days.
   */
  async saveWeekDays(weekStartDate, daysMap) {
    this._ensureReady();
    if (!weekStartDate || !daysMap || typeof daysMap !== 'object') return;
    const { fsMod } = this.sdk;

    const payload = stripUndefined({
      id: `plan_${weekStartDate}`,
      startDate: weekStartDate,
      days: daysMap,
      ...this._auditFields()
    });

    await fsMod.setDoc(this._weekDocRef(weekStartDate), payload, { merge: true });
    this.lastSyncAt = new Date().toISOString();
  }

  /**
   * Save a full week document (used for full clear or full week restore).
   */
  async saveFullWeek(weekStartDate, plan) {
    this._ensureReady();
    if (!weekStartDate || !plan) return;
    const { fsMod } = this.sdk;

    const payload = stripUndefined({
      id: plan.id || `plan_${weekStartDate}`,
      startDate: weekStartDate,
      days: plan.days || {},
      ...this._auditFields()
    });

    await fsMod.setDoc(this._weekDocRef(weekStartDate), payload);
    this.lastSyncAt = new Date().toISOString();
  }

  /**
   * Upsert a single extra shopping item (1 item = 1 doc for zero-conflict concurrent editing).
   */
  async upsertExtraItem(item) {
    this._ensureReady();
    if (!item || !item.id) return;
    const { fsMod } = this.sdk;

    const payload = stripUndefined({
      id: item.id,
      name: item.name || '',
      storeId: item.storeId || 'other',
      checked: Boolean(item.checked),
      order: typeof item.order === 'number' ? item.order : 0,
      ...this._auditFields()
    });

    await fsMod.setDoc(this._extraItemDocRef(item.id), payload, { merge: true });
    this.lastSyncAt = new Date().toISOString();
  }

  /**
   * Batch upsert multiple extra items (e.g., after drag-and-drop reorder).
   */
  async upsertExtraItemsBatch(items) {
    this._ensureReady();
    if (!Array.isArray(items) || items.length === 0) return;
    const { fsMod } = this.sdk;
    const batch = fsMod.writeBatch(this.db);
    const audit = this._auditFields();

    items.forEach((item) => {
      if (!item || !item.id) return;
      const payload = stripUndefined({
        id: item.id,
        name: item.name || '',
        storeId: item.storeId || 'other',
        checked: Boolean(item.checked),
        order: typeof item.order === 'number' ? item.order : 0,
        ...audit
      });
      batch.set(this._extraItemDocRef(item.id), payload, { merge: true });
    });

    await batch.commit();
    this.lastSyncAt = new Date().toISOString();
  }

  async deleteExtraItem(itemId) {
    this._ensureReady();
    if (!itemId) return;
    const { fsMod } = this.sdk;
    await fsMod.deleteDoc(this._extraItemDocRef(itemId));
    this.lastSyncAt = new Date().toISOString();
  }

  async clearAllExtraItems() {
    this._ensureReady();
    const { fsMod } = this.sdk;
    const snap = await fsMod.getDocs(this._extraItemsColRef());
    if (snap.empty) return;
    const batch = fsMod.writeBatch(this.db);
    snap.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    this.lastSyncAt = new Date().toISOString();
  }

  /**
   * Upsert or delete a single history archive entry.
   */
  async upsertHistoryItem(hist) {
    this._ensureReady();
    if (!hist || !hist.id) return;
    const { fsMod } = this.sdk;

    const payload = stripUndefined({
      id: hist.id,
      title: hist.title || '過去の献立',
      startDate: hist.startDate || '',
      savedAt: hist.savedAt || new Date().toISOString(),
      plan: hist.plan || {},
      ...this._auditFields()
    });

    await fsMod.setDoc(this._historyDocRef(hist.id), payload);
    this.lastSyncAt = new Date().toISOString();
  }

  async deleteHistoryItem(histId) {
    this._ensureReady();
    if (!histId) return;
    const { fsMod } = this.sdk;
    await fsMod.deleteDoc(this._historyDocRef(histId));
    this.lastSyncAt = new Date().toISOString();
  }

  /**
   * Bulk upload all local data (used for initial migration or JSON backup restore).
   * Commits in chunks of 400 operations to stay safely under Firestore's 500 ops/batch limit.
   */
  async uploadAllLocalData(exportedData) {
    this._ensureReady();
    if (!exportedData || typeof exportedData !== 'object') return;
    const { fsMod } = this.sdk;
    const audit = this._auditFields();

    const ops = [];

    // 1. Meta config
    ops.push({
      type: 'set',
      ref: this._metaDocRef(),
      data: stripUndefined({
        startDayOfWeek: exportedData.startDayOfWeek || 'mon',
        stores: Array.isArray(exportedData.stores) ? exportedData.stores : [],
        ...audit
      }),
      options: { merge: true }
    });

    // 2. Weeks
    const plansByWeek = exportedData.plansByWeek || {};
    Object.keys(plansByWeek).forEach((weekKey) => {
      const plan = plansByWeek[weekKey];
      if (!plan || typeof plan !== 'object') return;
      ops.push({
        type: 'set',
        ref: this._weekDocRef(weekKey),
        data: stripUndefined({
          id: plan.id || `plan_${weekKey}`,
          startDate: plan.startDate || weekKey,
          days: plan.days || {},
          ...audit
        })
      });
    });

    // 3. Extra items (remove stale docs not present in exportedData, upsert current ones)
    const existingExtraSnap = await fsMod.getDocs(this._extraItemsColRef());
    const newExtraIds = new Set(
      (Array.isArray(exportedData.extraShoppingItems) ? exportedData.extraShoppingItems : [])
        .filter((i) => i && i.id)
        .map((i) => i.id)
    );
    existingExtraSnap.forEach((docSnap) => {
      if (!newExtraIds.has(docSnap.id)) {
        ops.push({ type: 'delete', ref: docSnap.ref });
      }
    });

    (Array.isArray(exportedData.extraShoppingItems) ? exportedData.extraShoppingItems : []).forEach((item, idx) => {
      if (!item || !item.id) return;
      ops.push({
        type: 'set',
        ref: this._extraItemDocRef(item.id),
        data: stripUndefined({
          id: item.id,
          name: item.name || '',
          storeId: item.storeId || 'other',
          checked: Boolean(item.checked),
          order: typeof item.order === 'number' ? item.order : idx * 10,
          ...audit
        })
      });
    });

    // 4. History items
    const existingHistSnap = await fsMod.getDocs(this._historyColRef());
    const newHistIds = new Set(
      (Array.isArray(exportedData.history) ? exportedData.history : [])
        .filter((h) => h && h.id)
        .map((h) => h.id)
    );
    existingHistSnap.forEach((docSnap) => {
      if (!newHistIds.has(docSnap.id)) {
        ops.push({ type: 'delete', ref: docSnap.ref });
      }
    });

    (Array.isArray(exportedData.history) ? exportedData.history : []).forEach((hist) => {
      if (!hist || !hist.id) return;
      ops.push({
        type: 'set',
        ref: this._historyDocRef(hist.id),
        data: stripUndefined({
          id: hist.id,
          title: hist.title || '過去の献立',
          startDate: hist.startDate || '',
          savedAt: hist.savedAt || new Date().toISOString(),
          plan: hist.plan || {},
          ...audit
        })
      });
    });

    // Execute in 400-op chunks
    const CHUNK_SIZE = 400;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const batch = fsMod.writeBatch(this.db);
      const chunk = ops.slice(i, i + CHUNK_SIZE);
      chunk.forEach((op) => {
        if (op.type === 'delete') {
          batch.delete(op.ref);
        } else if (op.options) {
          batch.set(op.ref, op.data, op.options);
        } else {
          batch.set(op.ref, op.data);
        }
      });
      await batch.commit();
    }

    this.lastSyncAt = new Date().toISOString();
  }

  /**
   * Fetch a full snapshot of the shared household database (used for debug panel & manual reload).
   */
  async fetchAllRemoteSnapshot() {
    this._ensureReady();
    const { fsMod } = this.sdk;
    try {
      const [metaSnap, weeksSnap, extraSnap, histSnap] = await Promise.all([
        fsMod.getDoc(this._metaDocRef()),
        fsMod.getDocs(this._weeksColRef()),
        fsMod.getDocs(this._extraItemsColRef()),
        fsMod.getDocs(this._historyColRef())
      ]);

      const meta = metaSnap.exists() ? metaSnap.data() : {};
      const plansByWeek = {};
      weeksSnap.forEach((docSnap) => {
        plansByWeek[docSnap.id] = docSnap.data();
      });

      const extraShoppingItems = [];
      extraSnap.forEach((docSnap) => {
        extraShoppingItems.push(docSnap.data());
      });
      extraShoppingItems.sort((a, b) => (a.order || 0) - (b.order || 0));

      const history = [];
      histSnap.forEach((docSnap) => {
        history.push(docSnap.data());
      });
      history.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));

      return {
        householdId: this.householdId,
        fetchedAt: new Date().toISOString(),
        startDayOfWeek: meta.startDayOfWeek,
        stores: meta.stores,
        plansByWeek,
        extraShoppingItems,
        history
      };
    } catch (err) {
      throw this.formatFirestoreError(err);
    }
  }

  /**
   * Start real-time Firestore listeners (onSnapshot) for concurrent multi-user sync.
   */
  startRealtimeSync(handlers = {}) {
    this._ensureReady();
    this.stopRealtimeSync();

    const { fsMod } = this.sdk;
    const handleError = (err) => {
      const formatted = this.formatFirestoreError(err);
      this.lastError = formatted.message;
      if (handlers.onError) handlers.onError(formatted, err);
    };

    // 1. Meta config listener
    const unsubMeta = fsMod.onSnapshot(
      this._metaDocRef(),
      (docSnap) => {
        this.lastSyncAt = new Date().toISOString();
        if (docSnap.exists() && handlers.onMetaUpdate) {
          handlers.onMetaUpdate(docSnap.data(), {
            fromCache: docSnap.metadata.fromCache,
            hasPendingWrites: docSnap.metadata.hasPendingWrites
          });
        }
      },
      handleError
    );

    // 2. Weeks collection listener
    const unsubWeeks = fsMod.onSnapshot(
      this._weeksColRef(),
      (querySnap) => {
        this.lastSyncAt = new Date().toISOString();
        const plansByWeek = {};
        querySnap.forEach((docSnap) => {
          plansByWeek[docSnap.id] = docSnap.data();
        });
        if (handlers.onWeeksUpdate) {
          handlers.onWeeksUpdate(plansByWeek, {
            fromCache: querySnap.metadata.fromCache,
            hasPendingWrites: querySnap.metadata.hasPendingWrites,
            empty: querySnap.empty
          });
        }
      },
      handleError
    );

    // 3. Extra shopping items collection listener
    const unsubExtra = fsMod.onSnapshot(
      this._extraItemsColRef(),
      (querySnap) => {
        this.lastSyncAt = new Date().toISOString();
        const items = [];
        querySnap.forEach((docSnap) => {
          items.push(docSnap.data());
        });
        items.sort((a, b) => (a.order || 0) - (b.order || 0));
        if (handlers.onExtraItemsUpdate) {
          handlers.onExtraItemsUpdate(items, {
            fromCache: querySnap.metadata.fromCache,
            hasPendingWrites: querySnap.metadata.hasPendingWrites,
            empty: querySnap.empty
          });
        }
      },
      handleError
    );

    // 4. History collection listener
    const unsubHistory = fsMod.onSnapshot(
      this._historyColRef(),
      (querySnap) => {
        this.lastSyncAt = new Date().toISOString();
        const history = [];
        querySnap.forEach((docSnap) => {
          history.push(docSnap.data());
        });
        history.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
        if (handlers.onHistoryUpdate) {
          handlers.onHistoryUpdate(history, {
            fromCache: querySnap.metadata.fromCache,
            hasPendingWrites: querySnap.metadata.hasPendingWrites,
            empty: querySnap.empty
          });
        }
      },
      handleError
    );

    this.unsubscribers = [unsubMeta, unsubWeeks, unsubExtra, unsubHistory];
    this.isSubscribed = true;
  }

  stopRealtimeSync() {
    this.unsubscribers.forEach((unsub) => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (_) {}
    });
    this.unsubscribers = [];
    this.isSubscribed = false;
  }
}

export const cloudDb = new CloudDatabaseSync();
