# 受注管理システム — Claude Code 引き継ぎドキュメント

## プロジェクト概要

レーザー工房向けの受注管理システム。
- **フロントエンド**: GitHub Pages（静的HTML/JS/CSS 単一ファイル）
- **バックエンド**: Google Apps Script（GAS）
- **データ**: Googleスプレッドシート

---

## 重要URLs・認証情報

```
GitHub リポジトリ : https://github.com/omanbosan/marche-system
GitHub Pages URL  : https://omanbosan.github.io/marche-system/
GAS URL           : https://script.google.com/macros/s/AKfycbwQ8-M1NueHtjLf8Q1B5I6X-YTfdDUTcczYaFxRIaP4Ocq9UL-gj6rcucHZWNAGF28Ulg/exec
GAS スクリプトID  : 1Dalr98OYU8tdXNnJ9glby1vqUIohudYxuE4seyC0BFRvAt6IsNNK8fih
スプレッドシートID : 1-27E8JVuZ3aD-cGsNCiq6WdCB6OemqghRKvx7NhjTQE
Googleアカウント   : omanbo.monodukuri@gmail.com（スプレッドシート・GASの所有者）
アプリパスワード   : luke1227mb
担当               : 美咲（受付・デザイン・撮影・完成連絡）、栄人（2値化・彫刻）
```

---

## ファイル構成

```
marche-system/
├── CLAUDE.md          # このファイル（Claude Codeへの指示）
├── index.html         # GitHub Pages 公開用（src/index.html のコピー）
├── src/
│   ├── index.html     # フロントエンド（現行バージョン・編集はこちら）
│   └── gas_code.gs    # GASバックエンド（現行バージョン・編集はこちら）
├── releases/
│   ├── index_v12.html # 過去バージョン（v2〜v12）
│   ├── gas_v13.gs     # 過去バージョン（v2〜v13）
│   └── ...
├── gas/               # clasp用（GAS自動デプロイ設定後に使用）
├── deploy.sh          # デプロイスクリプト
└── SETUP.md
```

---

## 必須ルール（必ず守ること）

### 1. リビジョン管理
- **修正前に必ずバージョンを上げて保存する**
- `src/index.html` を編集する前に `releases/index_vN.html` にコピー（Nは現在の最新番号+1）
- `src/gas_code.gs` を編集する前に `releases/gas_vN.gs` にコピー
- コミットメッセージには変更内容を日本語で明記

```bash
# 例：リビジョンアップの手順（deploy.sh が自動で行う）
./deploy.sh all "変更内容の説明"

# または手動で行う場合
cp src/index.html releases/index_v14.html
cp src/gas_code.gs releases/gas_v14.gs
cp src/index.html index.html
# → src/index.html または src/gas_code.gs を編集
git add -A
git commit -m "v14: 変更内容"
git push
```

### 2. デプロイ手順

#### フロントエンド（GitHub Pages）
```bash
# src/index.html を編集後
./deploy.sh frontend "変更内容の説明"
# → リビジョン保存 + index.html更新 + push を自動実行
# → GitHub Pagesが自動でデプロイ（数分かかる場合あり）
```

#### バックエンド（GAS）
```bash
# clasp を使う場合
cd gas/
clasp push
clasp deploy --versionNumber N --description "変更内容"

# 手動の場合
# src/gas_code.gs の内容をApps Scriptエディタに貼り付けて
# 「新しいバージョンでデプロイ」を実行
```

---

## スプレッドシート シート構成

| シート名 | 主な列 |
|---------|--------|
| orders | id, num, note, deliveryType, createdAt, completedAt, status, sharedImageRef, channel |
| items | id, orderId, pid, idx, totalOf, skipBinarize, skipDesign, price, paymentMethod, onHold, paid, typeId, typeName, optionFee, optionNote, doubleBinarize |
| steps | id, itemId, stepIndex, done, startedAt, completedAt, durationMins |
| products | id, name, price, totalMinutes, stepTimesJson, stock, stockWarn, typesJson, stockLoc, stockShip |
| history | id, orderId, num, completedAt, waitMinutes, deliveryType |
| sales | id, historyId, orderId, pid, productName, price, paymentMethod, completedAt |
| config | key, value |
| stock_log | id, productId, stock, reason, createdAt |

---

## システム設計の重要事項

### 工程ステップ
- **現地（6ステップ）**: 受付→2値化→デザイン→彫刻→撮影→完成連絡
- **郵送（7ステップ）**: 受付→2値化→デザイン→顧客確認→彫刻→撮影→発送

### 在庫管理
- 在庫は**注文登録時**に引き落とし（完了時ではない）
- 注文削除時に在庫を戻す
- タイプ別×現地/郵送で4軸管理（stockLoc/stockShip）

### 通信設計
- GASはGETリクエストのみ（CORS対策）
- 大きいデータはchunk分割して送信（MAX 1500文字）
- ステップ更新・保留・入金確認は`apiAsync`（fire-and-forget、ローディングなし）
- 注文登録・削除はローディング表示あり

### 認証
- パスワードはSHA-256ハッシュでGASのconfigシートに保存
- トークンは当日23:59まで有効
- 複数端末対応（トークンリスト管理）

---

## clasp セットアップ（GAS自動デプロイ用）

```bash
# claspのインストール
npm install -g @google/clasp

# Googleアカウントでログイン
clasp login

# プロジェクトをクローン（既存GASプロジェクトの場合）
mkdir gas && cd gas
clasp clone <SCRIPT_ID>

# または新規作成
clasp create --type standalone --title "受注管理システム"

# .clasp.json に scriptId を設定
echo '{"scriptId":"<SCRIPT_ID>","rootDir":"./"}' > .clasp.json

# デプロイ
clasp push
clasp deploy --description "v8: バグ修正"
```

GASのSCRIPT_IDはApps Scriptエディタの「プロジェクトの設定」から確認できます。

---

## よくある問題と対処

### アイテムが表示されない
- itemsシートのヘッダーが正しいか確認
- GASで `fixAllSheets()` を実行

### 工程別実績時間が--になる
- stepsシートのdurationMinsが0になっている
- GASの `handleUpdateStep` で前のステップのcompletedAtからstartedAtを計算

### Unauthorized エラー
- localStorageのトークンが切れている
- ログインし直す（当日23:59で自動切れ）

### 在庫が反映されない
- productsシートのstockLoc/stockShip列があるか確認
- `fixAllSheets()` を実行してから `migrateStockToLoc()` を実行

### clasp で GAS に自動デプロイしたのに反映されない・「アクセスが拒否されました」になる
- `clasp push` → `clasp deploy --deploymentId <本番のdeploymentId>` はAPI上は成功してdeploymentConfigも正しく見えるが、実際のWebアプリアクセスが403（アクセス拒否）になることがある（API経由のdeploy更新が反映しきらない既知の不具合）
- **対処**: Apps Scriptエディタ（https://script.google.com/home/projects/&lt;スクリプトID&gt;/edit）を開き、「デプロイ」→「デプロイを管理」→ 対象デプロイの鉛筆アイコン → バージョンを選択し直して「デプロイ」を押す。これで確実に直る
- clasp自体は `gas/` ディレクトリにローカルインストール済み（グローバルnpm権限がないため）。`cd gas && npx clasp push` / `npx clasp deploy --deploymentId <id>` で使う
- `clasp login` は端末のメインGoogleアカウントがデフォルトで選択されがちなので、必ずアカウント選択画面で `omanbo.monodukuri@gmail.com` を明示的に選ぶこと（別アカウントのままだと `The caller does not have permission` エラーになる）

---

## 現在の未解決問題（引き継ぎ事項）

1. **工程別実績時間の2値化が--になる**
   - GASのhandleUpdateStepで前ステップのcompletedAtを参照するよう修正済みだが、既存データには反映されない
   - 新規データから正しく記録されるはず

2. **商品別平均時間の名前がIDになっていた**
   - productsシートから直接名前を引くよう修正済み

---

## 開発メモ

- タブ: 現地 / 郵送 / 履歴 / 売上 / 商品
- 自動同期: 30秒ごと（入力中・モーダル表示中はスキップ）
- 手動同期: ヘッダーの↺ボタン
- パスワードを変更する場合は `setup()` を再実行

### 2026-07-04: 受付削除時に売上が残るバグを修正（gas_v52）
- 現地注文は登録時に即 `history`/`sales` へ売上記録される仕様（`recordSalesForOrder`）だが、`handleDeleteOrder` が `orders`/`items`/`steps` しか消しておらず、削除しても売上に残っていた
- `handleDeleteOrder` に `history`（col1=orderId）・`sales`（col2=orderId）の削除を追加して修正済み
- **注意**: この修正より前に「受付」タブから削除された注文は、`sales`/`history` に孤立レコードが残っている可能性がある。売上集計が過去分だけ多い等の報告があれば、sales/historyシートをorderId基準でordersシートに存在しない行がないか確認すること
