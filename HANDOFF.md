# 作業記録・引き継ぎメモ（weekly-dinner-planner v3.0.1）

更新日時: 2026-11-21 23:05 (JST)

---

## 1. 現在のプロジェクト状態（完了済み）

- **リポジトリ**: `weekly-dinner-planner`（`main` ブランチ）
- **最新アプリコードコミット**: `33a672b`（`origin/main` と同期済み）
  - `33a672b` `fix: Align week start date keys to local timezone and handle legacy shifted keys (v3.0.1)`
  - `e1746e5` `feat: Migrate cloud sync to Google Cloud Firestore for real-time shared access (v3.0.0)`
  - `7fc853f` `feat: Simplify modal ingredient add/delete buttons to icons (v2.5.1)`
- **現在のアプリバージョン**: **`v3.0.1`**
  - `index.html` / `sw.js` / `app.js` / `test-runner.mjs` / `AGENTS.md` のすべてを同期済み
- **自動テスト結果（直前の `npm test`）**:
  - **51 / 51 TESTS PASSED (100%) / Uncaught errors = 0 / 終了コード 0**

---

## 2. 本セッションで実施・完了したこと

### ① テスト・画面プレビュー確認
- 引き継ぎ直後の `npm test`（42 / 42 PASS）を確認。
- プレビュー用ローカルサーバー（`http://127.0.0.1:8000/`）を起動し、Chrome リモートデバッグ経由でブラウザ表示を確認。

### ② Google Cloud（Cloud Firestore）共有データベース構成の設計・実装（`v3.0.0`）
旧 Google Drive 単一 JSON 上書き方式（`googleDrive.js`）を廃止し、ご夫婦が各自の Google アカウントから同時にリアルタイム参照・編集できる構成へ完全移行しました。

- **新規追加ファイル**:
  - [`cloudDb.js`](./cloudDb.js): Firebase Web SDK（v11.6.0）を ES Modules CDN から動的読み込み（オフライン・テスト環境でも安全動作）。`households/{householdId}` 配下を `meta/config`・`weeks/{週}`（曜日単位部分更新）・`extraItems/{id}`（1品＝1ドキュメント）・`history/{id}`（1件＝1ドキュメント）に分割保存し、`onSnapshot` によるリアルタイム同期とオフライン永続キャッシュを実装。Firebase コンソールの JS 形式 `firebaseConfig` の直接貼り付け解析、パートナー端末用設定コピー機能を搭載。
  - [`firestore.rules`](./firestore.rules): ご夫婦 2 名の Google メールアドレスのみ読み書き許可するセキュリティルールテンプレート。
  - [`CLOUD_SETUP.md`](./CLOUD_SETUP.md): 最新の Firebase コンソール画面（「Database と Storage」「セキュリティ」「⚙️ 設定」「Standard エディション」）に合わせた日本語セットアップ手順書。
- **改修・整理ファイル**:
  - [`index.html`](./index.html) / [`app.js`](./app.js): クラウド設定 UI 刷新、リアルタイム同期統合、モーダル編集中バッファ保護、閲覧週（`selectedWeekStartDate`）の端末別独立管理、日用品フォームの重複リスナー解消。
  - [`sw.js`](./sw.js) / [`AGENTS.md`](./AGENTS.md) / [`test-runner.mjs`](./test-runner.mjs): `cloudDb.js` 対応・ドキュメント更新・同時編集＆設定パースの E2E テスト追加。
  - 旧 `googleDrive.js` を削除（※手動の JSON 書き出し・読み込みバックアップ機能は維持）。

### ③ Firebase 実環境セットアップ＆夫婦端末での接続確認
- Firebase プロジェクト（`weekly-dinner-planner` / 無料 Spark プラン）を作成。
- Cloud Firestore（Standard エディション / `asia-northeast1` 東京）を作成。
- Authentication で Google ログインを有効化＋承認済みドメイン設定。
- Firestore セキュリティルールをご夫婦 2 名の Google アカウント限定で公開。
- **奥様のスマホを 1 台目として接続し、奥様の献立データを初期データとしてクラウドへアップロード → ご主人の端末側でもデータ反映を確認済み**。

### ④ 週キーの 1 日ズレ（UTC/JST）および開始曜日同期バグの修正（`v3.0.1`）
- [`app.js`](./app.js) 内の初期週キー計算に残っていた `toISOString().split('T')[0]`（UTC 変換による日本時間 1 日ズレ）と `new Date(startDateStr)` をすべてローカル時間計算（`formatDateToISO` / `parseISODate`）に統一。
- 過去バージョンで作られた 1 日ズレの週キーも自動で今週の正規キーへ救済する `normalizeWeekKey()` を実装。
- `startDayOfWeek`（週の開始曜日）の変更・リモート同期時に `selectedWeekStartDate` を自動再計算するよう改善。
- [`test-runner.mjs`](./test-runner.mjs) に初回今週表示・旧ズレキー自動救済・開始曜日同期の検証テストを追加し、**51 / 51 PASS（100%）** を確認して `origin/main` へプッシュ済み。

---

## 3. 開発・運用上の補足

- **テスト用ポートとプレビュー用ポート**:
  - `npm test` はポート `8080` を使用します。
  - 画面プレビュー用のローカルサーバーにはポート `8000`（`python3 -m http.server 8000 --bind 127.0.0.1`）を使用してください。
- **セキュリティ・プライバシー**:
  - Firebase の実接続設定（`firebaseConfig`）や家族共有 ID（デフォルト `family-main`）はリポジトリに含めず、各端末の `localStorage` のみで管理しています。
  - Firestore へのアクセス権は Firebase コンソール側のセキュリティルールでご夫婦 2 名の Google メールアドレスに限定されています。

---

## 4. 次回セッションへの引き継ぎ用プロンプト（そのままコピーして使えます）

```text
前のセッションからの引き継ぎです。
まずプロジェクトルートの `AGENTS.md` と `HANDOFF.md` を確認し、記載されたルールに従って作業してください。
私はハーネスエンジニアリングにまだ慣れていないため、専門用語や手順は引き続き分かりやすくサポートしてもらえると助かります。

## 現在のプロジェクト状態（完了済み）
- リポジトリ: `weekly-dinner-planner`（`main` ブランチ、`origin/main` と同期済み）
- 現在のアプリバージョン: `v3.0.1`（`index.html` / `sw.js` / `app.js` / `test-runner.mjs` / `AGENTS.md` を同期済み）
- ハーネス・テスト環境整備済み:
  - `AGENTS.md`（テスト必須、4ファイルバージョン同期、DOM/データ互換ガードレール、勝手な commit/push 禁止、大きな変更前の事前確認など）
  - Node.js / npm / Playwright Chromium 構築済み
  - 直前の `npm test` は **51 / 51 TESTS PASSED (100%) / Uncaught errors = 0**
- 直近の大きな改修（`v3.0.0`〜`v3.0.1`）:
  - 旧 Google Drive 同期（`googleDrive.js`）から **Google Cloud（Cloud Firestore）＋ Firebase Auth（Googleログイン）による夫婦同時リアルタイム同期**（`cloudDb.js` / `firestore.rules` / `CLOUD_SETUP.md`）へ完全移行済み
  - 実環境の Firebase プロジェクト設定・夫婦 2 名限定のセキュリティルール適用・奥様の献立データ初期アップロード・ご主人の端末での反映確認まで完了済み
  - `v3.0.1` で週開始日キーのタイムゾーン 1 日ズレ修正、旧ズレキー自動救済、開始曜日同期時の週キー自動調整を実施済み

## 開発・確認時の補足
- `npm test` がポート `8080` を使用するため、画面プレビュー用のローカルサーバーを起動する場合はポート `8000`（例: `python3 -m http.server 8000 --bind 127.0.0.1`）を使ってください。
- 前のセッションで動かしていたプレビューサーバーは終了している可能性があるため、必要なら起動してください。

## 次にやりたいこと
（ここにお願いしたい内容を入力してください）
```
