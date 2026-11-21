# AGENTS.md

このファイルは、AIエージェントが `weekly-dinner-planner` リポジトリで安全かつ一貫した品質で開発・保守を行うための作業ガイドラインです。

---

## 1. プロジェクト概要・技術スタック

1週間の夕食献立とスーパー別買い物リストを管理し、Google Cloud（Cloud Firestore）経由で夫婦間（iPhone / Android / PC）でリアルタイム同時同期できる PWA（Progressive Web App）です。

- **フロントエンド**: Vanilla HTML / CSS / JavaScript（ES Modules）
- **ビルドツール**: なし（静的ファイルのまま動作させる。不要なフレームワークやビルド工程を勝手に導入しない）
- **外部ライブラリ（CDN）**: Lucide Icons、Firebase Web SDK（ES Modules 動的読み込み：Auth + Cloud Firestore）
- **データ保存**: `localStorage`（ローカルキャッシュ）＋ Google Cloud Cloud Firestore（夫婦共有リアルタイム DB）
- **テスト**: Playwright（`test-runner.mjs` による E2E リグレッションテスト）

---

## 2. ファイル構成

| ファイル | 役割 |
| :--- | :--- |
| `index.html` | UI 構造、モーダル定義、4タブ構成（`#page-planner`, `#page-shopping`, `#page-history`, `#page-settings`）、バージョン表示 |
| `app.js` | アプリ本体の状態管理（`AppState`）、各画面描画、イベント処理、モーダル制御、リアルタイム同期統合 |
| `cloudDb.js` | Firebase Auth（Google ログイン）および Cloud Firestore による夫婦同時リアルタイム同期・差分更新（`CloudDatabaseSync`） |
| `firestore.rules` | ご夫婦2名の Google アカウントのみ許可する Firestore セキュリティルール定義テンプレート |
| `CLOUD_SETUP.md` | Google Cloud / Firebase プロジェクト作成・セキュリティルール設定・夫婦端末接続のセットアップ手順書 |
| `styles.css` | レスポンシブ・モバイル向けスタイル定義 |
| `sw.js` | PWA Service Worker（Network-first 戦略、キャッシュ管理） |
| `manifest.json` | PWA マニフェスト（アイコン、テーマカラー等） |
| `test-runner.mjs` | ローカル HTTP サーバー起動＋Playwright によるリグレッションテスト一式 |

---

## 3. 作業ワークフロー

### 作業前の確認
- **大きな変更（新機能追加、データ構造変更、UI構成変更、複数ファイルにまたがる改修）を行う前に、必ず実装方針・変更予定ファイルを簡潔に提示してユーザーの承認を得ること。**
- 仕様や意図が曖昧な場合は、推測で実装を進めず質問して確認すること。
- 影響範囲を把握してから編集する（特に `app.js` は単一ファイルで大きいため、関連する描画関数・イベントリスナー・状態更新箇所を事前に確認する）。

### Git 運用ルール
- **ユーザーから明示的な指示がない限り、勝手に `git commit` や `git push` を実行しない。**
- コミットを求められた場合は、変更内容が分かる簡潔なコミットメッセージを作成する（既存の履歴に合わせて `feat:`, `fix:`, `chore:`, `test:` などのプレフィックスを使用）。
- テスト実行で生成されるスクリーンショット（`*.png`）や一時ファイルはコミットしない（`.gitignore` 対象を維持する）。

---

## 4. テスト・検証ルール（必須）

コードを変更したら、完了報告の前に必ず Playwright リグレッションテストを実行して動作を検証すること。

```bash
npm test
# （直接実行する場合: node test-runner.mjs）
```

- **初回セットアップが必要な場合**: `node_modules` が存在しない場合は `npm install`（必要に応じて `npx playwright install chromium`）を行う。
- **合否の確認方法**:
  - テスト失敗時・未捕捉エラー発生時は終了コード `1` で終了する。
  - 終了コード `0` に加え、標準出力の `REGRESSION TEST SUMMARY` で `100%` かつ `❌ FAIL` が 0 件、`Uncaught errors = 0` であることも確認すること。
- **テスト追加の原則**:
  - 新機能を追加した場合やバグを修正した場合は、`test-runner.mjs` にも該当ケースの検証を追加する。
- **テストを実行できない環境の場合**:
  - 実行できなかった事実と理由（例: Node.js やブラウザ未導入）を正直にユーザーへ報告し、テスト済みのように報告しない。

---

## 5. バージョン更新プロトコル

機能追加やバグ修正に伴いバージョンを上げる場合、以下の **4箇所すべてを必ず同じバージョンに同期更新** すること（現在: `3.0.1`）。

1. `index.html` — ヘッダーの `<span class="version-badge">vX.Y.Z</span>`
2. `sw.js` — `const CACHE_NAME = 'weekly-dinner-vX.Y.Z';`（PWA キャッシュ更新のため必須）
3. `app.js` — `AppState.exportAllData()` 内の `version: 'X.Y.Z'`
4. `test-runner.mjs` — バージョン検証アサーション（`versionText === 'vX.Y.Z'`）

> バージョンを上げるべきか判断に迷う場合は、作業前または完了時にユーザーへ確認すること。

---

## 6. コーディング規約・再発防止ガードレール

過去の不具合履歴およびアプリ特性に基づき、以下を厳守すること。

### DOM・セレクタ整合性
- `index.html` の要素 `id` / `class`、または `app.js` 内の動的生成 HTML の属性を変更・追加する場合は、以下3箇所の整合性を必ず照合する：
  1. `index.html`
  2. `app.js`（`getElementById` / `querySelector` / イベント委譲）
  3. `test-runner.mjs`（テスト用セレクタ）
- タブ切り替え（`switchTab`）で非アクティブページが確実に非表示になる構造（`.page` / `.page.active`）を壊さないこと。

### テスト用グローバル公開の維持
- `test-runner.mjs` やブラウザからのデバッグが依存しているため、`app.js` で `window` に公開しているオブジェクト・関数を無断で削除・リネームしないこと：
  - `window.state`
  - `window.cloudDb`
  - `window.renderApp`
  - `window.updateSyncStatusUI`
  - `window.formatBackupDisplayName`
  - `window.reorderStoreItems`

### データ後方互換性
- ユーザーのブラウザ（`localStorage`）や Google Drive には過去バージョンのデータ構造（単一料理形式や古い履歴形式）が残っている可能性がある。
- データ構造を変更・拡張する際は、必ず `sanitizeWeeklyPlan()` / `normalizeDayData()` / `importAllData()` で既存データを安全に読み込める後方互換性を維持すること。

### セキュリティ・プライバシー
- ユーザー入力値（料理名、食材名、メモ、店舗名、ファイル名等）を `innerHTML` 等で描画する際は、必ず `escapeHtml()` を通して XSS を防止する。
- Google Cloud Client ID やアクセストークンなどの認証情報をソースコードにハードコードしない（必ず実行時の `localStorage` 経由で扱う）。

### PWA・モバイル UI 配慮
- スマートフォン（iPhone / Android）での片手操作・狭い画面幅での利用がメイン。ボタンやモーダルがはみ出したり押しにくくなったりしないよう配慮する。
- 新しい静的アセットファイルを追加した場合は、`sw.js` の `ASSETS` 配列への追加も検討する。

---

## 7. コミュニケーション方針

- ユーザーへの説明・質問・作業報告は **日本語** で簡潔かつ分かりやすく行う。
- 専門用語（ハーネス、テスト、Git 操作等）を使う際は、必要に応じて背景や理由をひとこと添える。
