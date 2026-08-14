# 受注管理システム — Claude Code 引き継ぎドキュメント

## プロジェクト概要

レーザー工房向けの受注管理システム。
- **フロントエンド**: 2026-08-14〜 **GitHub Pages版（`index.html`＝`src/index.html`のコピー）が本流に戻った**。GASの動作が重く不安定という現場の声を受け、リポジトリを再度公開化してPages配信を復活させた（GitHub Freeは非公開リポジトリでPagesを配信できないため）。GAS直配信版（`gas/Index.html`）は使用終了。このURLをブラウザで直接開くと、GitHub PagesのURLへ2秒後に自動リダイレクトする案内ページを返すだけになっている（`doGet`の`action`未指定分岐、`src/gas_code.gs`）。**GitHub Pages版のAPI通信先としては引き続きGASが必須**（`action`付きリクエストは今まで通りGASが処理する。案内ページ化はUIの直接アクセス時のみ）
- **バックエンド**: Google Apps Script（GAS）
- **データ**: Googleスプレッドシート

---

## ⚠️ セキュリティ注意事項（2026-08-14）

リポジトリは現在**公開（public）**。このCLAUDE.md自体がリポジトリにコミットされているため、下記のパスワード・IDはgit履歴を含め誰でも閲覧可能な状態。パスワードは公開当時から変更していない（既に漏洩している前提で扱うこと）。パスワード変更の相談が来たら`setup()`の再実行で対応する。

## 重要URLs・認証情報

```
GitHub リポジトリ : https://github.com/omanbosan/marche-system （2026-08-14〜再公開）
GitHub Pages URL  : https://omanbosan.github.io/marche-system/ （本流フロントエンド）
GAS URL（本流だったが使用終了・案内ページのみ）: https://script.google.com/macros/s/AKfycbyGx2qJ_Q8AKfAfunACHfUTfm2VZ1VlF8AYjWd5cDCLdHwYvdQBSRU0ccWBPQb2VgylLg/exec
GAS URL（GitHub Pages用API・本流）: https://script.google.com/macros/s/AKfycbwQ8-M1NueHtjLf8Q1B5I6X-YTfdDUTcczYaFxRIaP4Ocq9UL-gj6rcucHZWNAGF28Ulg/exec
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
| orders | id, num, note, deliveryType, createdAt, completedAt, status, sharedImageRef, channel, shippingFee, discount |
| items | id, orderId, pid, idx, totalOf, skipBinarize, skipDesign, price, paymentMethod, onHold, paid, typeId, typeName, optionFee, optionNote, doubleBinarize, engraveOpt |
| steps | id, itemId, stepIndex, done, startedAt, completedAt, durationMins |
| products | id, name, price, totalMinutes, stepTimesJson, stock, stockWarn, typesJson, stockLoc, stockShip, sharedStockWith, costPrice, setPricesJson, productType |
| history | id, orderId, num, completedAt, waitMinutes, deliveryType |
| sales | id, historyId, orderId, pid, productName, price, paymentMethod, completedAt |
| config | key, value |
| stock_log | id, productId, stock, reason, createdAt |

---

## システム設計の重要事項

### 工程ステップ
- **現地（6ステップ）**: 受付→2値化→デザイン→彫刻→撮影→完成連絡
- **郵送（7ステップ）**: 受付→2値化→デザイン→顧客確認→彫刻→撮影→発送

### 商品種別（productType、2026-08-14追加）
- `engrave`（デフォルト・既存商品）: 通常どおり全工程を通す彫刻商品
- `goods`: 物販のみ。工程管理なし。受付と同時に`orders.status='done'`で作成され、進捗タブ（現地/郵送）には一切表示されない。売上（sales/history）は受付と同時に記録される
- `goods_opt`: 物販＋彫刻オプション。受付モーダルの「オプション追加料金」欄に商品ごとの「🔨 彫刻オプションを追加」トグルが出る。ONなら通常の彫刻商品と同じ全工程を通し、OFFなら`goods`と同じ扱い（即完了）
- 実装のキモ：`goods`／彫刻オプションOFFの`goods_opt`アイテムは、**作成時点で全ステップを`done=true`で生成する**だけで実現している（`src/gas_code.gs`の`handleSaveOrderFast`・`src/index.html`の`saveOrder()`）。既存の「全アイテムの全ステップが`done`になったら注文完了」ロジック（`tapStep`内`allItemsDone`）をそのまま流用しているため、彫刻商品と物販商品が同一受付に混在していても、彫刻側の最終工程を押した瞬間に混在していた物販アイテムも一緒に完了扱いになる
- 商品登録画面（`ov-product`）に商品種別セグメント（`seg-product-type`）を追加。`物販のみ`選択時は工程時間グリッド（`step-time-grid`）を非表示にする

### クーポン割引（discount、2026-08-14追加）
- 事前登録なし。受付モーダルでその場で「金額」または「割合(%)」を選んで手入力し、**商品合計＋送料の1回だけ**に適用する（`T.discountType`/`T.discountValue`、`calcDiscountAmount()`）
- `orders.discount`列に最終確定額（円）を保存。`sales`シートには送料と同じパターンで`productName:'割引', price:マイナス値`の行を1本追加する形で計上（`recordSalesForOrder`・`handleCompleteOrder`）
- 現地／物販のみ注文は受付と同時に、郵送（彫刻あり）注文は完了時（`handleCompleteOrder`）に割引行が売上に反映される
- **既知の制限**: 一度sales記録済みの注文の`discount`を後から編集しても、sales側の金額は遡って修正されない（`shippingFee`の編集と同じ既存の制限を踏襲）

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

### 2026-08-14: 物販専用商品・彫刻オプション商品・クーポン割引を追加（index_v85 / gas_v85）
- 詳細は上記「商品種別（productType）」「クーポン割引（discount）」の項を参照
- `products.productType`・`items.engraveOpt`・`orders.discount`の3列を追加。`handleGetAll`内に`shippingFee`列と同じパターンの自動マイグレーションを実装済みなので、本番スプレッドシートは次回`getAll`実行時に自動で列が追加される（`fixAllSheets()`の手動実行は不要のはずだが、反映されない場合は保険として実行すること）
- 既存の彫刻商品（`productType`が空欄の行）は`handleGetAll`のパース時に`'engrave'`扱いにフォールバックするため、後方互換あり
- `./deploy.sh all`は`index`と`gas`のリビジョン番号を同期させる仕様（大きい方の番号を両方に使う）のため、gas側も前回のv59から一気にv85まで飛んでいる（欠番ではなく仕様どおり）
- **重要な発見**: `./deploy.sh`は`src/index.html`・`src/gas_code.gs`をGitHubにpushするだけで、**本番で実際に使われている`gas/Index.html`・`gas/コード.js`（GAS直配信版）には一切自動反映されない**。`.github/workflows/deploy-gas.yml`も`src/gas_code.gs`→`gas/Code.gs`をpush対象にしており、既存の`gas/コード.js`（日本語ファイル名）とは別物。今回`src/index.html`だけ更新してdeploy.shを実行した直後、本番URL（`https://script.google.com/macros/s/AKfycbyGx2qJ.../exec`）は8/9時点のまま何も変わっておらず、危うく「デプロイした」と報告するところだった
- **正しい本番反映手順（2026-08-14時点の最新版。GitHub Pages本流化後）**:
  - フロントエンド（`src/index.html`）の変更 → `./deploy.sh frontend`（or `all`）でリビジョン保存＋`index.html`更新＋push。GitHub Pagesが自動配信するのでこれだけで完結（`gas/Index.html`はdoGetの案内ページ化により**もう誰にも読み込まれない死んだファイル**になったので、同期は不要）
  - バックエンド（`src/gas_code.gs`）の変更 → 以下の手順で**必ず2つのデプロイID両方**に反映する:
    1. `cp src/gas_code.gs "gas/コード.js"`
    2. `cd gas && npx clasp push --force`
    3. `npx clasp deploy --deploymentId AKfycbyGx2qJ_Q8AKfAfunACHfUTfm2VZ1VlF8AYjWd5cDCLdHwYvdQBSRU0ccWBPQb2VgylLg --description "..."` （案内ページ用）
    4. `npx clasp deploy --deploymentId AKfycbwQ8-M1NueHtjLf8Q1B5I6X-YTfdDUTcczYaFxRIaP4Ocq9UL-gj6rcucHZWNAGF28Ulg --description "..."` （**GitHub Pages版が実際に呼ぶAPI本体。こちらを忘れると機能が実質無効になる**）
    5. `npx clasp deployments`でどちらも最新バージョン番号にピン留めされているか確認
    6. `curl -sS -L -A "Mozilla/5.0"`（User-Agent必須。無いとGoogleのボット判定ページが返ることがある）で両URLに実際にアクセスし、変更点の文字列がレスポンスに含まれているか確認する。反映されていなければApps Scriptエディタで「デプロイを管理」→バージョンを選び直して手動デプロイする
    7. `gas/コード.js`の変更を`git add`してpushしておく（次回`src/gas_code.gs`との差分比較の基準にするため）

### 2026-08-14: GAS直配信版の動作が重い・不安定という指摘によりGitHub Pages版へ本流を戻した（index_v85 / gas_v86）
- ユーザーから「GASページより前のGitHub Pageの方が動作が軽くて安定している」との指摘を受け、リポジトリを再公開してGitHub Pages配信を復活させた（設定変更はユーザー自身がGitHub UIで実施）
- 併せて「GAS直配信版はもう使わない」との要望により、`doGet`の`action`未指定分岐（＝ブラウザで直接URLを開いた場合）を、フルアプリ表示からGitHub PagesのURLへの案内ページ（2秒後に自動リダイレクト）に変更した。`action`付きリクエスト（GitHub Pages版が`fetch()`で呼ぶAPI）は従来通り動作し、一切影響なし
- **注意**: リポジトリが公開になったことで、このCLAUDE.md内のパスワード・スプレッドシートID・スクリプトIDはgit履歴ごと誰でも閲覧可能。ユーザーはパスワード変更をしない選択をした（既に長期間公開されていたため今更、との判断）。今後この点について相談があれば、まず現状（公開・パスワード未変更）を伝えること
- **How to apply**: 今後「GASページの方を直したい」「GAS直配信版を復活させたい」という相談が来たら、まずこの経緯（動作が重い・不安定という理由で意図的に使用終了にした）を伝えること。復活させる場合は`doGet`の案内ページ分岐を元の`HtmlService.createHtmlOutputFromFile('Index')`に戻せばよい

### 2026-08-14: 案内ページが`<meta http-equiv="refresh">`だけだと遷移しない不具合を修正（gas_v87）
- 案内ページ導入直後、「タップしてもすぐGASページに戻ってしまう」という報告があった
- GASのHtmlServiceはコンテンツをサンドボックス化されたiframe（`*.googleusercontent.com`）内に表示し、タブのアドレスバー自体は`script.google.com`のまま。`<meta http-equiv="refresh">`はこのiframe自身しか遷移させられず、親フレーム（タブ本体）は`script.google.com`に残ったままになっていた可能性が高い
- `<script>window.top.location.href = redirectUrl</script>`で親フレームごと明示的に書き換える方式に変更し、リンクにも`target="_top"`を追加。meta refreshは削除（JSでの即時遷移に一本化）
- **もし再発したら**: ユーザー側で古い「おまんぼさん受注管理」タブ（GAS直配信版のログイン画面が既に読み込まれた状態のもの）がSafariに残っていて、それを開いているだけの可能性もある。ホーム画面に追加したアイコンがあれば作り直しを、既存タブは一度完全に閉じてから新規タブでURLを開き直すよう案内すること

### 2026-08-14: 【重大】GitHub Pages版が実際に呼ぶAPIデプロイに、v85〜v87のバックエンド変更が反映されていなかった不具合を発見・修正
- 同一Apps Scriptプロジェクト（スクリプトID`1Dalr...`）には`clasp deployments`で見ると**複数のデプロイ（デプロイID）が存在し、それぞれ別バージョンにピン留めされている**ことが判明:
  - `AKfycbyGx2qJ...`（案内ページ専用。CLAUDE.mdで「本流」と誤記していたURL）→ 私が`clasp deploy`のたびにこのIDばかり指定していたため、常に最新版になっていた
  - `AKfycbwQ8-M1...`（`src/index.html`の`GAS_URL`定数が実際に呼ぶAPI本体。**GitHub Pages版が依存する唯一のバックエンド**）→ v59時点（@77）にピン留めされたまま放置されていた
- 結果として、物販専用商品・彫刻オプション・クーポン割引を追加した際（v85）、**フロントエンド（UI）だけが新しくなり、実際に叩かれるバックエンドは古いまま**という状態になっていた。商品種別を保存しても`productType`列は書き込まれず、次回読み込み時に消えたように見える／注文の`discount`も保存されるが集計に反映されない、といった不具合が起きていたはず（実際にユーザーが気づく前に発見・修正できた）
- `npx clasp deploy --deploymentId AKfycbwQ8-M1NueHtjLf8Q1B5I6X-YTfdDUTcczYaFxRIaP4Ocq9UL-gj6rcucHZWNAGF28Ulg`で該当デプロイを最新版に更新し、`curl`（正常なUser-Agentヘッダー付き。GASは自動化ツールっぽいUser-AgentだとreCAPTCHA的なチャレンジページを返すことがあるため注意）で新コードが反映されていることを確認済み
- **How to apply**: 今後`src/gas_code.gs`を変更してデプロイする際は、**`clasp deploy --deploymentId`を必ず両方（案内ページ用`AKfycbyGx2qJ...`・GitHub Pages API用`AKfycbwQ8-M1...`）に対して実行すること**。`clasp deployments`で現在のデプロイ一覧とピン留めバージョンを都度確認する習慣をつけること。上記「正しい本番反映手順」の4番も両デプロイID対応に読み替えて適用する

### 2026-08-14: 商品保存系ハンドラに`invalidateCache()`漏れがあり、保存直後にキャッシュへ巻き戻る不具合を修正（gas_v88）
- 上記のデプロイ取り違え修正後も「物販+彫刻オプションを保存し直したのに、受付画面でオプションが出てこない」との報告があり調査したところ、`handleSaveProduct`・`handleDeleteProduct`・`handleReorderProducts`・`handleAdjustStock`の4つの商品系ハンドラに`invalidateCache()`の呼び出しが無いことが判明（他の保存系ハンドラ、例えば`handleSaveOrderFast`や`handleTransferStock`には入っている）。これは今回の機能追加で作った不具合ではなく、以前から存在していた既存バグ
- `handleGetAll`は結果を50秒間`CacheService`にキャッシュしており、画面は20秒ごとに自動同期（`loadAll`）で`S.products`をサーバー応答で丸ごと上書きする。保存直後にキャッシュが無効化されないと、次の自動同期が古いキャッシュを取得して`S.products`が保存前の状態に巻き戻ってしまう
- 4つのハンドラすべての先頭に`invalidateCache();`を追加。`clasp deploy`は今回から両デプロイID（案内ページ用・GitHub Pages API用）に対して実施し、`clasp deployments`で両方が同じバージョンにピン留めされていることを確認済み
- **How to apply**: 今後「保存したのに画面を開き直すと反映されていない／数秒後に元に戻る」系の相談が来たら、まず該当のGASハンドラに`invalidateCache()`があるか確認すること。特に商品・在庫関連（`products`シートを書き換える処理）は要注意
