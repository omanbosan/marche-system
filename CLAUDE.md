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

## Googleアカウント認証版（2026-08-08追加、GitHub Pages版と併存）→ 2026-08-09にパスワード認証へ変更

本番のGitHub Pages＋パスワード認証（上記「重要URLs」のGAS URL、deploymentId末尾`...GF28Ulg`固定）とは別に、**GAS自身がHTMLを返す版**を追加した（現在は下記の通りパスワード認証）。

- ソース: `gas/Index.html`（`src/index.html`の派生。通信を`fetch()`から`google.script.run`に置換）
- サーバー側: `src/gas_code.gs`内の`routeAction`/`rpc`
- `doGet`は`action`パラメータが無い場合だけHTML版を返す分岐なので、既存の`?action=...&token=...`系（GitHub Pages版）には一切影響しない
- 管理者用デプロイURL: `https://script.google.com/macros/s/AKfycbyGx2qJ_Q8AKfAfunACHfUTfm2VZ1VlF8AYjWd5cDCLdHwYvdQBSRU0ccWBPQb2VgylLg/exec`

### 2026-08-09: Googleログイン認証が不安定だったためパスワード認証に統一
Googleアカウント判定は`appsscript.json`の`webapp.access: "ANYONE"`（＝ログイン必須の「Googleアカウントをお持ちの全員」）と組み合わさり、アプリを開くたびにGoogleアカウント選択が挟まる構成だった。これがログイン不安定の主因と見て、GitHub Pages版と同じ「パスワード＋トークン認証」に統一した。

- `rpc(action, data)`は`isMarcheAdminUser()`ではなく`verifyToken(data.token)`で判定するよう変更（`action==='auth'`のみtoken不要）
- `routeAction`に`case 'auth': return handleAuth(data.password||'');`を追加
- `gas/Index.html`のログイン画面・`api()`/`apiAsync()`/`tryAutoLogin()`/`doLogin()`/`showLoginScreen()`を`src/index.html`と同じ実装に置き換え（`localStorage`の`mb_token`/`mb_token_exp`で30日保持）
- `gas/appsscript.json`を`executeAs: "USER_DEPLOYING"` / `access: "ANYONE_ANONYMOUS"`に変更（匿名アクセス可・スプレッドシートは開発者権限でアクセス。GitHub Pages版と同じ実行モデル）
- パスワードはGitHub Pages版と共通（`config`シートの`passwordHash`）
- `isMarcheAdminUser`/`getCurrentUserEmailForApp`/`ensureAdminUsersSheet`/`getAllowedAdminEmails`/`admin_users`シート関連は未使用のまま`src/gas_code.gs`に残置
- clasp push後、`clasp deploy --deploymentId AKfycbyGx2qJ...`で管理者用デプロイのみ更新済み（GitHub Pages版のdeploymentId`...GF28Ulg`には触れていない）。匿名curlで`pw-input`を含むログイン画面が返ることを確認済み

**How to apply**: 今後この管理者用デプロイURLの認証まわりを触る場合は、GitHub Pages版のtoken認証ロジック（`verifyToken`/`handleAuth`）を流用する方針を踏襲すること。Googleアカウント判定に戻す要望が出たら、上記の未使用関数群を`rpc`から再度呼ぶ形に戻せばよい。

（以下、旧・Googleアカウント認証版の制約メモ。参考として残置）

1. **（2026-08-08訂正）`appsscript.json`の`webapp.access: "ANYONE"`は正しい値。** Google公式マニフェスト仕様では`ANYONE`＝ログイン必須の「Googleアカウントをお持ちの全員」、`ANYONE_ANONYMOUS`＝匿名含む全員、なので`ANYONE`のままでUIの「Googleアカウントをお持ちの全員」と一致する。`clasp push`/`clasp deploy`のたびにUIで手動で戻す必要はない（以前はここに「毎回UIで戻すこと」と書いていたが誤り）。ログイン後もアクセス拒否になる場合は、accessの値ではなく下記「clasp で GAS に自動デプロイしたのに反映されない」の既知の不具合（API経由のデプロイ反映バグ）を疑い、そちらの対処（Apps Scriptエディタでバージョンを選び直してデプロイ）を試すこと。
2. **`executeAs: USER_ACCESSING`にしているため、`admin_users`に追加したメールアドレスには、スプレッドシート本体も「編集者」として共有する必要がある**（実行ユーザー本人の権限でシートを読み書きするため）。共有はGoogleスプレッドシートの「共有」ボタンから手動で行う（claspのOAuthトークンでは他人作成ファイルへ権限付与できない）。

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

### 2026-08-08: 完了ボタンを押しても一覧に残るバグを修正（index_v83 / gas_v57、Googleアカウント認証版で発生）
- 全工程完了時の`completeOrder`呼び出しが`apiAsync`（fire-and-forget、失敗を検知しない）だったため、GAS側の保存が何らかの理由で失敗しても画面には一切通知されなかった
- 画面上はローカルの楽観的更新で即座に一覧から消えるが、20秒ごとの自動同期（`loadAll`）でサーバー未完了データに上書きされ、「完了を押しても残る」ように見えていた
- `tapStep`内の`completeOrder`呼び出しを、成功/失敗が分かる`api()`に変更。失敗時は一覧に注文を戻し、トーストで通知するようにした（`gas/Index.html`・`src/index.html`両方）
- あわせて`apiAsync`全般に`console.error`でのエラーログを追加（次回同様の問題が起きた際、ブラウザの開発者コンソールで原因を特定しやすくするため）
- **未解決**: 上記は「気づけるようにする」対策であり、GAS側で実際に何が失敗していたか（`executeAs: USER_ACCESSING`環境でのCacheService分離、書き込み権限、実行エラーなど）は未特定。再発したらまずブラウザの開発者コンソールで`apiAsync failed:`ログを確認すること

### 2026-08-09: 受付番号の連番自動採番が壊れていたバグを修正（index_v84 / gas_v59）
- `calcNextOrderNum()`が「未完了注文（`S.orders`、`handleGetAll`は`status!=='done'`のみ返す）」と「`localStorage.mb_last_num`」の2つだけを根拠に次番号を計算していたため、その日の注文が全部完了済みになると手がかりが無くなり、次番号が1に戻ってしまっていた
- 加えて`localStorage`はオリジン（ドメイン）ごとに別管理のため、GitHub Pages版（`omanbosan.github.io`）で貯まった`mb_last_num`は、GASが直接HTMLを返す管理者用デプロイ（`script.google.com`、[[gas/Index.html]]）では参照できず、フロント移行時にこの症状が起きやすかった
- `handleGetAll`が`status`を問わず全注文（done含む）の最大`num`を`maxOrderNum`として返すよう修正し、`calcNextOrderNum()`はまずこれを基準にするよう変更（`S.orders`・`localStorage`は保険として併用のまま残置）。`src/index.html`・`index.html`・`gas/Index.html`の3ファイル全てに同じ修正を適用済み
- **調査時に判明した別件**: GitHub Pages（`https://omanbosan.github.io/marche-system/`）が現在404「Site not found」を返す状態だった。CLAUDE.mdでは「本番・今後も触らない」としているURLだが、実際にはPages配信が止まっている可能性が高い。次回このURLに関する相談が来たら、リポジトリのSettings→Pagesの配信設定（ブランチ/フォルダ）を確認すること
- **調査したが未修正の別件**: `yayoiMap`（弥生会計の勘定科目マッピング）と`pt_margin_<pid>`（価格設定テーブルの目標粗利率）も`localStorage`のみに保存されており、サーバー同期していない。GitHub Pages版とGAS管理者版を併用すると、これらの設定もオリジンが変わるたびに空・デフォルトに戻って見える。実害の報告があればconfigシート等への保存に変更する対応を検討すること

**How to apply**: 「GASに変えてから前は出来ていたことが出来ない」系の相談が来たら、まず`localStorage`に保存している値（`mb_last_num`・`yayoiMap`・`pt_margin_*`・`mb_token`）がオリジン依存で消えていないかを疑うこと。恒久対策はサーバー側（スプレッドシート）に保存先を移すこと。
