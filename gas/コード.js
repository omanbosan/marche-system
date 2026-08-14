// ============================================================
//  受注管理システム — GAS v7
//  郵送工程追加・在庫管理・保留・入金確認対応
// ============================================================

const SPREADSHEET_ID = '1-27E8JVuZ3aD-cGsNCiq6WdCB6OemqghRKvx7NhjTQE';

const SH = {
  ORDERS:   'orders',
  ITEMS:    'items',
  STEPS:    'steps',
  PRODUCTS: 'products',
  HISTORY:  'history',
  SALES:    'sales',
  CONFIG:   'config',
  STOCK_LOG:'stock_log',
  EXPENSES:    'expenses',
  FIXED_COSTS: 'fixed_costs',
  ADMIN_USERS: 'admin_users',
};

function ok(data) {
  const o = ContentService.createTextOutput(JSON.stringify({ ok: true, data: data }));
  o.setMimeType(ContentService.MimeType.JSON);
  return o;
}
function err(msg) {
  const o = ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg }));
  o.setMimeType(ContentService.MimeType.JSON);
  return o;
}

// ============================================================
//  チャンク一時保存
// ============================================================
function storeChunk(sid, ci, d) {
  PropertiesService.getScriptProperties().setProperty('chunk_'+sid+'_'+ci, d);
  return ok({ stored: true });
}

function assembleChunks(sid, total, lastChunk) {
  const props = PropertiesService.getScriptProperties();
  var full = '';
  for (var i = 0; i < total - 1; i++) {
    full += props.getProperty('chunk_'+sid+'_'+i) || '';
    props.deleteProperty('chunk_'+sid+'_'+i);
  }
  return full + lastChunk;
}

// ============================================================
//  エントリポイント
// ============================================================
function doGet(e) {
  try {
    const action = e.parameter.action || '';

    // action指定が無い場合＝このURLをブラウザで直接開いた場合。
    // GAS直配信版は使用終了とし、GitHub Pages版へ誘導する案内ページを返す。
    // 既存のGitHub Pages版フロントエンドは必ずaction付きでリクエストするので、
    // このガードには一切引っかからず今までの動作に影響しない。
    if (!action) {
      var redirectUrl = 'https://omanbosan.github.io/marche-system/';
      // GASのHtmlServiceはコンテンツをサンドボックス化されたiframe内（googleusercontent.com）に
      // 表示するため、<meta http-equiv="refresh">だけだとiframe自身しか遷移せず、
      // タブ本体（script.google.com）はそのまま残ってしまうことがある。
      // window.top.location を明示的に書き換えて親フレームごと遷移させる。
      var guideHtml = '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>移転しました</title>' +
        '<style>body{font-family:sans-serif;background:#1a1a2e;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px}' +
        'a{color:#c8a84a;font-weight:bold;font-size:18px}p{font-size:14px;color:#aaa}</style></head>' +
        '<body><div><p>このページは使用を終了しました。<br>移動しない場合は下のリンクをタップしてください。</p>' +
        '<a href="' + redirectUrl + '" target="_top">' + redirectUrl + '</a></div>' +
        '<script>' +
        'try { window.top.location.href = "' + redirectUrl + '"; }' +
        'catch(e) { try { window.location.href = "' + redirectUrl + '"; } catch(e2) {} }' +
        '</script>' +
        '</body></html>';
      return HtmlService.createHtmlOutput(guideHtml)
        .setTitle('移転しました')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    const token  = e.parameter.token  || '';
    const sid    = e.parameter.sid    || '';
    const ci     = parseInt(e.parameter.ci    || '0');
    const total  = parseInt(e.parameter.total || '1');
    const dRaw   = e.parameter.d || '{}';

    if (action === 'storeChunk') return storeChunk(sid, ci, dRaw);
    if (action !== 'auth' && !verifyToken(token)) return err('Unauthorized');

    var data = {};
    try {
      var fullJson = (sid && total > 1) ? assembleChunks(sid, total, dRaw) : dRaw;
      data = JSON.parse(fullJson);
    } catch(ex) { data = {}; }

    switch (action) {
      case 'auth':           return handleAuth(e.parameter.password || '');
      case 'ping':           return ok({ pong: true });
      case 'getAll':         return handleGetAll();
      case 'getHistory':     return handleGetHistory(data.year||'', data.month||'');
      case 'saveOrderFast':  return handleSaveOrderFast(data);
      case 'saveOrder':      return handleSaveOrderFast(data.order||data);
      case 'saveOrderHeader':return handleSaveOrderHeader(data);
      case 'saveOrderItem':  return handleSaveOrderItem(data);
      case 'saveOrderStep':  return handleSaveOrderStep(data);
      case 'updateStep':     return handleUpdateStep(data);
      case 'updateItem':     return handleUpdateItem(data);
      case 'updateOrder':    return handleUpdateOrder(data);
      case 'completeOrder':  return handleCompleteOrder(data);
      case 'deleteOrder':    return handleDeleteOrder(data.orderId||'');
      case 'deleteItem':     return handleDeleteItem(data);
      case 'addItemToOrder': return handleAddItemToOrder(data);
      case 'deleteHistory':  return handleDeleteHistory(data);
      case 'saveProduct':     return handleSaveProduct(data.product||data);
      case 'deleteProduct':   return handleDeleteProduct(data.productId||'');
      case 'reorderProducts': return handleReorderProducts(data);
      case 'adjustStock':       return handleAdjustStock(data);
      case 'transferStock':     return handleTransferStock(data);
      case 'updateHistory':     return handleUpdateHistory(data);
      case 'exportCSV':         return handleExportCSV();
      case 'fixSalesTypeNames': return ok({ result: fixSalesTypeNames() });
      case 'fixItemTypes':      return handleFixItemTypes();
      case 'recordOrderSales':  return handleRecordOrderSales(data);
      case 'getExpenses':       return handleGetExpenses(data.year||'', data.month||'');
      case 'saveExpense':       return handleSaveExpense(data.expense||data);
      case 'deleteExpense':     return handleDeleteExpense(data.expenseId||'');
      case 'saveLaborRate':     return handleSaveLaborRate(data.rate||0);
      case 'getFixedCosts':     return handleGetFixedCosts(data.year||'', data.month||'');
      case 'saveFixedCost':     return handleSaveFixedCost(data.cost||data);
      case 'deleteFixedCost':   return handleDeleteFixedCost(data.costId||'');
      default:               return err('Unknown action: ' + action);
    }
  } catch(ex) {
    return err(ex.toString());
  }
}

function doPost(e) { return err('GETを使用してください'); }

// ============================================================
//  Googleアカウント認証版（gas/Index.html から google.script.run 経由で呼ばれる）
//  2026-08-09: Googleログイン認証が不安定だったため、GitHub Pages版と同じ
//  パスワード＋トークン認証（verifyToken、下記rpc参照）に統一した。
//  ・既存のdoGetのswitchとは意図的に別関数(routeAction)にしている。
//    doGet側の本番動作(トークン認証)には一切触れないようにするため、
//    アクション追加時はこちらにも忘れず反映すること。
//
//  以下のGoogleアカウント判定用の関数群（〜isMarcheAdminUserまで）は
//  現在未使用（呼び出し元なし）。admin_usersシートによるアカウント単位の
//  許可制に戻す場合のために残してある。
// ============================================================
const MARCHE_ADMIN_EMAILS_SEED = ['omanbosan.lv@gmail.com'];

function ensureAdminUsersSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH.ADMIN_USERS);
  if (!sh) {
    sh = ss.insertSheet(SH.ADMIN_USERS);
    sh.getRange(1,1,1,2).setValues([['email','note']]);
    sh.getRange(1,1,1,2).setBackground('#1a1a2e').setFontColor('#c8a84a').setFontWeight('bold');
    sh.setFrozenRows(1);
    MARCHE_ADMIN_EMAILS_SEED.forEach(function(email) {
      sh.appendRow([email, '初期登録']);
    });
  }
  return sh;
}

// admin_users シートのemail列を読み、許可されたGoogleアカウント一覧を返す
function getAllowedAdminEmails() {
  const sh = ensureAdminUsersSheet();
  const rows = sh.getDataRange().getValues();
  var emails = [];
  for (var i = 1; i < rows.length; i++) {
    var email = (rows[i][0] || '').toString().trim().toLowerCase();
    if (email) emails.push(email);
  }
  return emails;
}

function isMarcheAdminUser() {
  var email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  return !!email && getAllowedAdminEmails().indexOf(email) !== -1;
}

function routeAction(action, data) {
  switch (action) {
    case 'auth':           return handleAuth(data.password || '');
    case 'ping':           return ok({ pong: true });
    case 'getAll':         return handleGetAll();
    case 'getHistory':     return handleGetHistory(data.year||'', data.month||'');
    case 'saveOrderFast':  return handleSaveOrderFast(data);
    case 'saveOrder':      return handleSaveOrderFast(data.order||data);
    case 'saveOrderHeader':return handleSaveOrderHeader(data);
    case 'saveOrderItem':  return handleSaveOrderItem(data);
    case 'saveOrderStep':  return handleSaveOrderStep(data);
    case 'updateStep':     return handleUpdateStep(data);
    case 'updateItem':     return handleUpdateItem(data);
    case 'updateOrder':    return handleUpdateOrder(data);
    case 'completeOrder':  return handleCompleteOrder(data);
    case 'deleteOrder':    return handleDeleteOrder(data.orderId||'');
    case 'deleteItem':     return handleDeleteItem(data);
    case 'addItemToOrder': return handleAddItemToOrder(data);
    case 'deleteHistory':  return handleDeleteHistory(data);
    case 'saveProduct':     return handleSaveProduct(data.product||data);
    case 'deleteProduct':   return handleDeleteProduct(data.productId||'');
    case 'reorderProducts': return handleReorderProducts(data);
    case 'adjustStock':       return handleAdjustStock(data);
    case 'transferStock':     return handleTransferStock(data);
    case 'updateHistory':     return handleUpdateHistory(data);
    case 'exportCSV':         return handleExportCSV();
    case 'fixSalesTypeNames': return ok({ result: fixSalesTypeNames() });
    case 'fixItemTypes':      return handleFixItemTypes();
    case 'recordOrderSales':  return handleRecordOrderSales(data);
    case 'getExpenses':       return handleGetExpenses(data.year||'', data.month||'');
    case 'saveExpense':       return handleSaveExpense(data.expense||data);
    case 'deleteExpense':     return handleDeleteExpense(data.expenseId||'');
    case 'saveLaborRate':     return handleSaveLaborRate(data.rate||0);
    case 'getFixedCosts':     return handleGetFixedCosts(data.year||'', data.month||'');
    case 'saveFixedCost':     return handleSaveFixedCost(data.cost||data);
    case 'deleteFixedCost':   return handleDeleteFixedCost(data.costId||'');
    default:                  return err('Unknown action: ' + action);
  }
}

// google.script.run から呼ばれる唯一のエントリポイント。
// GitHub Pages版のdoGet同様、'auth'以外はtoken必須（パスワード認証）。
function rpc(action, data) {
  data = data || {};
  if (action !== 'auth' && !verifyToken(data.token || '')) throw new Error('Unauthorized');
  var result = routeAction(action, data);
  var parsed = JSON.parse(result.getContent());
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

// ============================================================
//  認証（複数端末対応）
// ============================================================
function verifyToken(token) {
  if (!token) return false;
  var tokens = [];
  try { tokens = JSON.parse(getConfig().sessionTokens || '[]'); } catch(e) { return false; }
  return tokens.some(function(t) { return t.token === token && t.exp > Date.now(); });
}

function handleAuth(pw) {
  const cfg  = getConfig();
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, pw, Utilities.Charset.UTF_8
  ).map(function(b){ return ('0'+(b&0xFF).toString(16)).slice(-2); }).join('');
  if (hash !== cfg.passwordHash) return err('パスワードが違います');

  const newToken = Utilities.getUuid();
  // ログイン保持：30日間有効
  var expDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  var tokens = [];
  try { tokens = JSON.parse(cfg.sessionTokens || '[]'); } catch(e) { tokens = []; }
  tokens = tokens.filter(function(t){ return t.exp > Date.now(); });
  tokens.push({ token: newToken, exp: expDate.getTime() });
  setConfig('sessionTokens', JSON.stringify(tokens));
  return ok({ token: newToken });
}

// ============================================================
//  設定
// ============================================================
function getConfig() {
  const sh   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH.CONFIG);
  const rows = sh.getDataRange().getValues();
  const cfg  = {};
  rows.forEach(function(r){ if(r[0]) cfg[r[0]] = r[1]; });
  return cfg;
}
function setConfig(key, value) {
  const sh   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH.CONFIG);
  const rows = sh.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) { sh.getRange(i+1,2).setValue(value); return; }
  }
  sh.appendRow([key, value]);
}

// キャッシュを無効化（書き込み系操作後に呼ぶ）
function invalidateCache() {
  try { CacheService.getScriptCache().remove('getAll_v1'); } catch(e){}
}

// ============================================================
//  全データ取得（CacheServiceで高速化）
// ============================================================
function handleGetAll() {
  // キャッシュから返せる場合は即返す（25秒TTL）
  try {
    const cache = CacheService.getScriptCache();
    const hit = cache.get('getAll_v1');
    if (hit) return ok(JSON.parse(hit));
  } catch(e){}

  const ss       = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ordersシートの自動マイグレーション（shippingFee列・discount列追加）
  try {
    var oMigSh = ss.getSheetByName(SH.ORDERS);
    if (oMigSh && oMigSh.getLastColumn() < 10) {
      if (oMigSh.getLastColumn() < 10) oMigSh.insertColumnsAfter(9, 10 - oMigSh.getLastColumn());
      oMigSh.getRange(1, 10).setValue('shippingFee');
    }
    if (oMigSh && oMigSh.getLastColumn() < 11) {
      oMigSh.insertColumnsAfter(10, 11 - oMigSh.getLastColumn());
      oMigSh.getRange(1, 11).setValue('discount');
    }
    if (oMigSh && oMigSh.getLastColumn() < 12) {
      oMigSh.insertColumnsAfter(11, 12 - oMigSh.getLastColumn());
      oMigSh.getRange(1, 12).setValue('numGroup');
    }
  } catch(eM){}
  // productsシートの自動マイグレーション（productType列追加）
  try {
    var pMigSh = ss.getSheetByName(SH.PRODUCTS);
    if (pMigSh && pMigSh.getLastColumn() < 14) {
      pMigSh.insertColumnsAfter(pMigSh.getLastColumn(), 14 - pMigSh.getLastColumn());
      pMigSh.getRange(1, 14).setValue('productType');
    }
  } catch(eM2){}
  // itemsシートの自動マイグレーション（engraveOpt列・engraveLabel列追加）
  try {
    var iMigSh = ss.getSheetByName(SH.ITEMS);
    if (iMigSh && iMigSh.getLastColumn() < 17) {
      iMigSh.insertColumnsAfter(iMigSh.getLastColumn(), 17 - iMigSh.getLastColumn());
      iMigSh.getRange(1, 17).setValue('engraveOpt');
    }
    if (iMigSh && iMigSh.getLastColumn() < 18) {
      iMigSh.insertColumnsAfter(iMigSh.getLastColumn(), 18 - iMigSh.getLastColumn());
      iMigSh.getRange(1, 18).setValue('engraveLabel');
    }
  } catch(eM3){}
  const orders   = sheetToObjects(ss.getSheetByName(SH.ORDERS));
  const items    = sheetToObjects(ss.getSheetByName(SH.ITEMS));
  const steps    = sheetToObjects(ss.getSheetByName(SH.STEPS));
  const products = sheetToObjects(ss.getSheetByName(SH.PRODUCTS));

  const active = orders.filter(function(o){ return o.status !== 'done'; });
  active.forEach(function(o){
    o.items = items.filter(function(it){ return it.orderId === o.id; }).map(function(it){
      it.steps        = steps.filter(function(s){ return s.itemId === it.id; });
      it.skipBinarize   = (it.skipBinarize   == 1 || it.skipBinarize   === true);
      it.skipDesign     = (it.skipDesign     == 1 || it.skipDesign     === true);
      it.onHold         = (it.onHold         == 1 || it.onHold         === true);
      it.paid           = (it.paid           == 1 || it.paid           === true);
      it.doubleBinarize = (it.doubleBinarize == 1 || it.doubleBinarize === true);
      it.engraveOpt     = (it.engraveOpt     == 1 || it.engraveOpt     === true);
      it.engraveLabel   = it.engraveLabel || '';
      it.optionFee      = Number(it.optionFee  || 0);
      it.optionNote     = it.optionNote || '';
      it.steps.forEach(function(s){ s.done = (s.done == 1 || s.done === true); });
      return it;
    });
  });

  // 商品のstepTimesJson・typesJsonをパース
  products.forEach(function(p){
    if (typeof p.stepTimesJson === 'string') {
      try { p.stepTimes = JSON.parse(p.stepTimesJson); } catch(e){ p.stepTimes={}; }
    }
    if (typeof p.typesJson === 'string') {
      try { p.types = JSON.parse(p.typesJson); } catch(e){ p.types=[]; }
    } else { p.types = []; }
    p.stock     = Number(p.stock     || 0);
    p.stockLoc  = Number(p.stockLoc  || 0);
    p.stockShip = Number(p.stockShip || 0);
    p.stockWarn = Number(p.stockWarn || 3);
    p.costPrice = Number(p.costPrice || 0);
    p.productType = p.productType || 'engrave';
    // typesのstockLoc/stockShipもパース
    if (p.types) {
      p.types.forEach(function(t){
        t.stockLoc  = Number(t.stockLoc  || 0);
        t.stockShip = Number(t.stockShip || 0);
      });
    }
  });
  // itemsのtypeId・typeNameを含める
  items.forEach(function(it){
    it.typeId   = it.typeId   || '';
    it.typeName = it.typeName || '';
  });

  // 時給（管理会計用）
  var laborRate = 0;
  try {
    var cfg = getConfig();
    laborRate = Number(cfg.laborRatePerHour || 0);
  } catch(e){}

  // 次の受付番号を正しく連番にするため、完了済み(done)も含めた全注文の最大番号を返す
  // （activeだけだとその日の注文が全部完了済みになった時に番号がリセットされてしまうため）
  // レーザー彫刻あり／物販のみ（numGroup）で別々に連番管理するため、グループ別に最大値を計算する
  var maxOrderNum = 0, maxOrderNumEngrave = 0, maxOrderNumGoods = 0;
  orders.forEach(function(o){
    var n = Number(o.num);
    if (n > maxOrderNum) maxOrderNum = n;
    var grp = o.numGroup || 'engrave'; // 旧データ（numGroup未設定）はengrave扱い
    if (grp === 'goods') { if (n > maxOrderNumGoods) maxOrderNumGoods = n; }
    else                 { if (n > maxOrderNumEngrave) maxOrderNumEngrave = n; }
  });

  var result = { orders: active, products: products, laborRatePerHour: laborRate,
    maxOrderNum: maxOrderNum, maxOrderNumEngrave: maxOrderNumEngrave, maxOrderNumGoods: maxOrderNumGoods };
  // 結果をキャッシュに保存（50秒間）
  // フロント同期が30秒ごとなので、50秒TTLで「30秒→キャッシュヒット→60秒→再読み込み」のサイクルになる
  // 書き込み系操作時は invalidateCache() でキャッシュを即座に消去するため、ステップ更新等は遅延なく反映
  try {
    var json = JSON.stringify(result);
    if (json.length < 95000) { // 100KB制限の安全マージン
      CacheService.getScriptCache().put('getAll_v1', json, 50);
    }
  } catch(e){}
  return ok(result);
}

function handleGetHistory(year, month) {
  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hist     = sheetToObjects(ss.getSheetByName(SH.HISTORY));
  if (year) {
    hist = hist.filter(function(h){
      const d = new Date(h.completedAt);
      return d.getFullYear() == year && (month ? (d.getMonth()+1) == month : true);
    });
  }
  const sales    = sheetToObjects(ss.getSheetByName(SH.SALES));
  const orders   = sheetToObjects(ss.getSheetByName(SH.ORDERS));
  const allItems = sheetToObjects(ss.getSheetByName(SH.ITEMS));
  const steps    = sheetToObjects(ss.getSheetByName(SH.STEPS));

  // orderをマップ化
  var orderMap = {};
  orders.forEach(function(o){ orderMap[o.id] = o; });

  // itemをマップ化
  var itemMap = {};
  allItems.forEach(function(it){ itemMap[it.id] = it; });

  // 現地・郵送のorderIdセット
  var localOrderIds = {}, shipOrderIds = {};
  orders.forEach(function(o){
    if (o.deliveryType === 'shipping') shipOrderIds[o.id] = true;
    else localOrderIds[o.id] = true;
  });

  // stepsをitemIdでグループ化
  var stepsByItem = {};
  steps.forEach(function(s){
    if (!stepsByItem[s.itemId]) stepsByItem[s.itemId] = [];
    stepsByItem[s.itemId].push(s);
  });

  // ① 行程別平均実績時間（現地のみ）
  var stepStats = {};
  steps.forEach(function(s){
    if (!s.done || !s.durationMins || Number(s.durationMins) <= 0) return;
    var it = itemMap[s.itemId];
    if (!it || !localOrderIds[it.orderId]) return;
    var si = String(s.stepIndex);
    if (!stepStats[si]) stepStats[si] = [];
    stepStats[si].push(Number(s.durationMins));
  });
  var stepAvg = {};
  Object.keys(stepStats).forEach(function(si){
    var vals = stepStats[si];
    stepAvg[si] = Math.round(vals.reduce(function(a,b){return a+b;},0) / vals.length);
  });

  // productsシートから商品名マップを作成
  var products = sheetToObjects(ss.getSheetByName(SH.PRODUCTS));
  var productNameMap = {};
  products.forEach(function(p){ productNameMap[p.id] = p.name; });

  // ① 行程別平均実績時間（現地のみ・受付除外）
  var stepStats = {};
  steps.forEach(function(s){
    if (!s.done) return;
    if (Number(s.stepIndex) === 0) return; // 受付は自動完了のため除外
    var dur = Number(s.durationMins);
    if (dur <= 0) return;
    if (s.startedAt && s.completedAt && s.startedAt === s.completedAt) return;
    var it = itemMap[s.itemId];
    if (!it || !localOrderIds[it.orderId]) return;
    var si = String(s.stepIndex);
    if (!stepStats[si]) stepStats[si] = [];
    stepStats[si].push(dur);
  });
  var stepAvg = {};
  Object.keys(stepStats).forEach(function(si){
    var vals = stepStats[si];
    stepAvg[si] = Math.round(vals.reduce(function(a,b){return a+b;},0) / vals.length);
  });

  // ② 商品別平均制作時間（現地のみ・商品名で集計）
  var prodStats = {}; // {productName: [totalMins]}
  allItems.forEach(function(it){
    if (!localOrderIds[it.orderId]) return;
    var itemSteps = stepsByItem[it.id] || [];
    var total = itemSteps.reduce(function(s,sd){
      return s + (Number(sd.durationMins) || 0);
    }, 0);
    if (total <= 0) return;
    // productsシートから商品名を取得
    var pname = productNameMap[it.pid] || it.pid;
    if (!pname) return;
    if (!prodStats[pname]) prodStats[pname] = [];
    prodStats[pname].push(total);
  });
  var prodAvg = {};
  Object.keys(prodStats).forEach(function(pname){
    var vals = prodStats[pname];
    prodAvg[pname] = Math.round(vals.reduce(function(a,b){return a+b;},0) / vals.length);
  });

  // ③ 郵送の平均所要日数（受付〜発送）
  var shipDays = [];
  hist.filter(function(h){ return h.deliveryType === 'shipping'; })
      .forEach(function(h){
        if (h.waitMinutes && Number(h.waitMinutes) > 0) {
          shipDays.push(Number(h.waitMinutes));
        }
      });
  var shipAvgDays = shipDays.length
    ? Math.round(shipDays.reduce(function(a,b){return a+b;},0) / shipDays.length * 10) / 10
    : null;

  // histに詳細情報を付加
  hist.forEach(function(h){
    h.salesItems = sales.filter(function(s){ return s.historyId === h.id; });
    var ord = orderMap[h.orderId];
    if (ord) {
      h.channel    = ord.channel    || 'marche';
      h.createdAt  = ord.createdAt  || '';
      h.numGroup   = ord.numGroup   || 'engrave';
    } else {
      h.numGroup = 'engrave';
    }
    // 工程別実績（現地・郵送とも）
    var ordItems = allItems.filter(function(it){ return it.orderId === h.orderId; });
    var stepDetailArr = [];
    ordItems.forEach(function(it){
      (stepsByItem[it.id] || []).forEach(function(s){
        if (s.done && Number(s.durationMins) > 0) {
          stepDetailArr.push({ stepIndex: Number(s.stepIndex), durationMins: Number(s.durationMins) });
        }
      });
    });
    var sdMap = {};
    stepDetailArr.forEach(function(sd){
      var si = String(sd.stepIndex);
      if (!sdMap[si]) sdMap[si] = 0;
      sdMap[si] += sd.durationMins;
    });
    h.stepDetails = Object.keys(sdMap).map(function(si){
      return { stepIndex: Number(si), durationMins: sdMap[si] };
    });
  });

  return ok({ history: hist, stepAvg: stepAvg, prodAvg: prodAvg, shipAvgDays: shipAvgDays });
}


function handleSaveOrderFast(data) {
  if (!data || !data.id) return err('data missing');
  invalidateCache(); // 書き込み前にキャッシュ無効化
  const ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  const oSh = ss.getSheetByName(SH.ORDERS);
  const iSh = ss.getSheetByName(SH.ITEMS);
  const sSh = ss.getSheetByName(SH.STEPS);

  // typeId→typeName, productId→productName 補完用マップ
  var typeNameMap = {};
  var prodNameMap = {};
  try {
    sheetToObjects(ss.getSheetByName(SH.PRODUCTS)).forEach(function(p){
      prodNameMap[String(p.id)] = p.name || '';
      try {
        var types = JSON.parse(p.typesJson || '[]');
        (types||[]).forEach(function(t){ typeNameMap[String(t.id)] = t.name || ''; });
      } catch(e){}
    });
  } catch(e){}

  // 物販のみ／彫刻オプション不使用のアイテムだけの注文かどうか（＝即完了・進捗管理タブに出さない）
  var allInstant = (data.items||[]).length > 0 && (data.items||[]).every(function(it){ return !!it.allDone; });

  // 注文ヘッダー（numGroupはレーザー彫刻あり/物販のみで受付番号を別連番管理するための区分）
  oSh.appendRow([
    data.id, data.num, data.note||'', data.deliveryType,
    data.createdAt, allInstant?data.createdAt:'', allInstant?'done':'active', '', data.channel||'marche',
    data.shippingFee||0, data.discount||0, allInstant?'goods':'engrave'
  ]);

  var itemRows = [], stepRows = [];
  (data.items||[]).forEach(function(it){
    // typeNameが空でtypeIdがある場合はproductsから補完
    var resolvedTypeName = it.typeName || '';
    if (!resolvedTypeName && it.typeId) {
      resolvedTypeName = typeNameMap[String(it.typeId)] || '';
    }
    itemRows.push([
      it.id, data.id, it.pid, it.idx||0, it.totalOf||1,
      0, 0, it.price||0, it.paymentMethod||'', 0, 0,
      it.typeId||'', resolvedTypeName,
      it.optionFee||0, it.optionNote||'', it.doubleBinarize?1:0,
      it.engraveOpt?1:0, it.engraveLabel||''
    ]);
    var stepIds = it.stepIds || [];
    // 郵送は7ステップ、現地は6ステップ
    var nSteps = data.deliveryType === 'shipping' ? 7 : 6;
    for (var si = 0; si < nSteps; si++) {
      var isDone, stepAt;
      if (it.allDone) {
        // 物販のみ／彫刻オプション不使用アイテムは全工程を作成時点で完了扱いにする
        isDone = 1;
        stepAt = it.step0At || data.createdAt;
      } else {
        isDone = (si === 0 && it.step0Done) ? 1 : 0;
        stepAt = (si === 0 && it.step0Done) ? (it.step0At||'') : '';
      }
      // 受付完了時は2値化の startedAt も同時に設定（時間計算を正確にするため）
      var startedAt   = it.allDone ? stepAt : ((si === 0) ? stepAt : (si === 1 && it.step0Done ? (it.step0At||'') : ''));
      var completedAt = it.allDone ? stepAt : ((si === 0) ? stepAt : '');
      var durMins     = isDone ? 0 : '';
      stepRows.push([stepIds[si]||Utilities.getUuid(), it.id, si, isDone, startedAt, completedAt, durMins]);
    }
  });

  if (itemRows.length > 0) iSh.getRange(iSh.getLastRow()+1,1,itemRows.length,18).setValues(itemRows);
  if (stepRows.length > 0) sSh.getRange(sSh.getLastRow()+1,1,stepRows.length,7).setValues(stepRows);

  // 現地注文、または物販のみ（allInstant）の注文は登録時に売上記録
  if (data.deliveryType !== 'shipping' || allInstant) {
    var salesItems = (data.items||[]).map(function(it){
      var resolvedTypeName = it.typeName || (it.typeId ? typeNameMap[String(it.typeId)] || '' : '');
      return {
        pid: it.pid,
        productName: prodNameMap[String(it.pid)] || '',
        typeName: resolvedTypeName,
        price: it.price||0,
        paymentMethod: it.paymentMethod||'cash'
      };
    });
    var firstPayMethod = salesItems.length > 0 ? (salesItems[0].paymentMethod || 'cash') : 'cash';
    recordSalesForOrder(ss, data.id, data.num||'', data.deliveryType, salesItems, data.shippingFee||0, firstPayMethod, data.discount||0);
  }

  return ok({ saved: true });
}

function handleSaveOrderHeader(data) {
  SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH.ORDERS).appendRow([
    data.id, data.num, data.note||'', data.deliveryType,
    data.createdAt, '', 'active', '', data.channel||'marche'
  ]);
  return ok({ saved: true });
}

function handleSaveOrderItem(data) {
  SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH.ITEMS).appendRow([
    data.id, data.orderId, data.pid, data.idx||0, data.totalOf||1,
    data.skipBinarize?1:0, data.skipDesign?1:0,
    data.price||0, data.paymentMethod||'', 0, 0,
    data.typeId||'', data.typeName||''
  ]);
  return ok({ saved: true });
}

function handleSaveOrderStep(data) {
  SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH.STEPS).appendRow([
    data.id, data.itemId, data.stepIndex, 0, '', '', ''
  ]);
  return ok({ saved: true });
}

// ============================================================
//  ステップ更新
// ============================================================
function handleUpdateStep(data) {
  invalidateCache();
  const sh   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH.STEPS);
  const rows = sh.getDataRange().getValues();
  var targetRow = -1;
  var itemId = '';
  var stepIndex = 0;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.stepId) {
      targetRow = i;
      itemId    = rows[i][1];
      stepIndex = Number(rows[i][2]);
      break;
    }
  }
  if (targetRow < 0) return ok({ updated: false });

  sh.getRange(targetRow+1, 4).setValue(data.done ? 1 : 0);

  if (data.completedAt) {
    // startedAtの決定：
    // 1. 渡された値
    // 2. 既存のstartedAt
    // 3. 前のステップのcompletedAt（最も正確）
    // 4. completedAtと同じ（最終手段）
    var startedAt = data.startedAt || rows[targetRow][4] || '';

    // 前のステップのcompletedAtを探す（startedAtが空か完了と同時刻の場合）
    if (!startedAt || startedAt === data.completedAt) {
      for (var j = 1; j < rows.length; j++) {
        if (rows[j][1] === itemId && Number(rows[j][2]) === stepIndex - 1) {
          var prevCompleted = rows[j][5];
          if (prevCompleted) {
            // Sheetsは日付をDateオブジェクトで返す場合があるのでISOに統一
            startedAt = (prevCompleted instanceof Date)
              ? prevCompleted.toISOString()
              : String(prevCompleted);
          }
          break;
        }
      }
    }

    // それでもなければDBのstartedAtを使い、なければcompletedAtを使う
    if (!startedAt) startedAt = rows[targetRow][4] ? String(rows[targetRow][4]) : data.completedAt;

    sh.getRange(targetRow+1, 5).setValue(startedAt);
    sh.getRange(targetRow+1, 6).setValue(data.completedAt);

    // 終了時刻もISOに統一して計算
    var start = new Date(startedAt);
    var end   = new Date(data.completedAt);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      var dur = Math.round((end - start) / 60000);
      sh.getRange(targetRow+1, 7).setValue(dur > 0 ? dur : 0);
    }
  } else if (data.startedAt) {
    // completedAtなし（次のステップ開始記録）
    var existing = rows[targetRow][4];
    if (!existing) sh.getRange(targetRow+1, 5).setValue(data.startedAt);
  }

  return ok({ updated: true });
}

// ============================================================
//  アイテム更新（onHold・paid対応）
// ============================================================
function handleUpdateItem(data) {
  invalidateCache();
  const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SH.ITEMS);
  const rows = sh.getDataRange().getValues();
  var foundOrderId = '';
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.itemId) {
      foundOrderId = rows[i][1];
      if (data.price         !== undefined) sh.getRange(i+1,8).setValue(data.price);
      if (data.skipBinarize  !== undefined) sh.getRange(i+1,6).setValue(data.skipBinarize?1:0);
      if (data.skipDesign    !== undefined) sh.getRange(i+1,7).setValue(data.skipDesign?1:0);
      if (data.paymentMethod !== undefined) sh.getRange(i+1,9).setValue(data.paymentMethod);
      if (data.onHold        !== undefined) sh.getRange(i+1,10).setValue(data.onHold?1:0);
      if (data.paid          !== undefined) sh.getRange(i+1,11).setValue(data.paid?1:0);
      if (data.typeId        !== undefined) sh.getRange(i+1,12).setValue(data.typeId||'');
      if (data.typeName      !== undefined) sh.getRange(i+1,13).setValue(data.typeName||'');
      if (data.optionFee     !== undefined) sh.getRange(i+1,14).setValue(data.optionFee||0);
      if (data.optionNote    !== undefined) sh.getRange(i+1,15).setValue(data.optionNote||'');
      if (data.doubleBinarize!== undefined) sh.getRange(i+1,16).setValue(data.doubleBinarize?1:0);
      break;
    }
  }

  // 郵送注文で入金確認チェック → 売上記録（paid=true/1 のときのみ）
  if ((data.paid === true || data.paid === 1) && foundOrderId) {
    var oSh   = ss.getSheetByName(SH.ORDERS);
    var oRows = oSh.getDataRange().getValues();
    var orderDeliveryType = '';
    var orderNum          = '';
    var shippingFee       = 0;
    for (var oi = 1; oi < oRows.length; oi++) {
      if (oRows[oi][0] === foundOrderId) {
        orderDeliveryType = oRows[oi][3];
        orderNum          = oRows[oi][1];
        shippingFee       = Number(oRows[oi][9]||0);
        break;
      }
    }
    if (orderDeliveryType === 'shipping') {
      // 商品名マップ
      var prodNameMap = {};
      try {
        sheetToObjects(ss.getSheetByName(SH.PRODUCTS)).forEach(function(p){
          prodNameMap[String(p.id)] = p.name || '';
        });
      } catch(e){}
      // 最新のアイテム行を再取得
      var freshRows = sh.getDataRange().getValues();
      var salesItems = [];
      for (var ii = 1; ii < freshRows.length; ii++) {
        if (freshRows[ii][1] === foundOrderId) {
          salesItems.push({
            pid:           freshRows[ii][2],
            productName:   prodNameMap[String(freshRows[ii][2])] || '',
            typeName:      freshRows[ii][12] || '',
            price:         Number(freshRows[ii][7]) || 0,
            paymentMethod: freshRows[ii][8] || 'cash'
          });
        }
      }
      var orderPayMethod = salesItems.length > 0 ? (salesItems[0].paymentMethod || 'cash') : 'cash';
      recordSalesForOrder(ss, foundOrderId, orderNum, orderDeliveryType, salesItems, shippingFee, orderPayMethod);
    }
  }

  return ok({ updated: true });
}

// ============================================================
//  注文更新
// ============================================================
function handleUpdateOrder(data) {
  invalidateCache();
  const sh   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH.ORDERS);
  const rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.orderId) {
      if (data.num          !== undefined) sh.getRange(i+1,2).setValue(data.num);
      if (data.note         !== undefined) sh.getRange(i+1,3).setValue(data.note);
      if (data.deliveryType !== undefined) sh.getRange(i+1,4).setValue(data.deliveryType);
      if (data.channel      !== undefined) sh.getRange(i+1,9).setValue(data.channel);
      if (data.shippingFee  !== undefined) sh.getRange(i+1,10).setValue(data.shippingFee||0);
      if (data.discount     !== undefined) sh.getRange(i+1,11).setValue(data.discount||0);
      break;
    }
  }
  return ok({ updated: true });
}

// ============================================================
//  売上記録ヘルパー（現地：登録時、郵送：入金確認時に呼ぶ）
// ============================================================
function recordSalesForOrder(ss, orderId, num, deliveryType, items, shippingFee, shippingPayment, discount) {
  // 重複チェック：既に履歴があればスキップ（冪等性）
  var hSh   = ss.getSheetByName(SH.HISTORY);
  var hRows = hSh.getDataRange().getValues();
  for (var hi = 1; hi < hRows.length; hi++) {
    if (hRows[hi][1] === orderId) return hRows[hi][0]; // 既に記録済み → hId を返す
  }
  var now  = new Date().toISOString();
  var hId  = Utilities.getUuid();
  var sSh  = ss.getSheetByName(SH.SALES);
  hSh.appendRow([hId, orderId, num, now, 0, deliveryType]);
  (items||[]).forEach(function(it){
    var displayName = it.productName || it.pid || '';
    if (it.typeName) displayName += ' [' + it.typeName + ']';
    sSh.appendRow([
      Utilities.getUuid(), hId, orderId,
      it.pid, displayName, it.price, it.paymentMethod, now
    ]);
  });
  // 支払い方法は注文アイテムと統一する（送料・割引とも）
  var commonPayment = (items && items.length > 0) ? (items[0].paymentMethod || 'cash') : (shippingPayment || 'cash');
  if (Number(shippingFee||0) > 0) {
    sSh.appendRow([
      Utilities.getUuid(), hId, orderId,
      '', '送料', Number(shippingFee), commonPayment, now
    ]);
  }
  if (Number(discount||0) > 0) {
    sSh.appendRow([
      Utilities.getUuid(), hId, orderId,
      '', '割引', -Number(discount), commonPayment, now
    ]);
  }
  return hId;
}

function handleRecordOrderSales(data) {
  if (!data.orderId) return err('orderId missing');
  invalidateCache();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hId = recordSalesForOrder(
    ss, data.orderId, data.num||'', data.deliveryType||'',
    data.items||[], data.shippingFee||0, data.shippingPayment||'', data.discount||0
  );
  return ok({ hId: hId });
}

// ============================================================
//  注文完了
// ============================================================
function handleCompleteOrder(data) {
  invalidateCache();
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const oSh   = ss.getSheetByName(SH.ORDERS);
  const oRows = oSh.getDataRange().getValues();
  var waitMins = 0;
  for (var i = 1; i < oRows.length; i++) {
    if (oRows[i][0] === data.orderId) {
      const created = new Date(oRows[i][4]);
      const comp    = new Date(data.completedAt);
      // 郵送は日数、現地は分
      if (data.deliveryType === 'shipping') {
        waitMins = Math.round((comp - created) / 86400000); // 日数
      } else {
        waitMins = Math.round((comp - created) / 60000);    // 分
      }
      oSh.getRange(i+1,6).setValue(data.completedAt);
      oSh.getRange(i+1,7).setValue('done');
      break;
    }
  }

  // 既に売上記録済み（現地は登録時・郵送は入金時）かチェック
  var hSh            = ss.getSheetByName(SH.HISTORY);
  var hRows          = hSh.getDataRange().getValues();
  var alreadyRecorded = false;
  var resultHId      = '';
  for (var hi = 1; hi < hRows.length; hi++) {
    if (hRows[hi][1] === data.orderId) {
      alreadyRecorded = true;
      resultHId = hRows[hi][0];
      // 完了時刻・待ち時間を更新
      hSh.getRange(hi+1, 4).setValue(data.completedAt);
      hSh.getRange(hi+1, 5).setValue(waitMins);
      break;
    }
  }

  if (!alreadyRecorded) {
    // 未記録の場合は従来通り history + sales を作成
    const hId = Utilities.getUuid();
    resultHId = hId;
    hSh.appendRow([hId, data.orderId, data.num, data.completedAt, waitMins, data.deliveryType]);
    (data.items||[]).forEach(function(it){
      var displayName = it.productName || '';
      if (it.typeName) displayName += ' [' + it.typeName + ']';
      ss.getSheetByName(SH.SALES).appendRow([
        Utilities.getUuid(), hId, data.orderId,
        it.pid, displayName, it.price, it.paymentMethod, data.completedAt
      ]);
    });
    if (Number(data.shippingFee||0) > 0) {
      // 送料の支払い方法はアイテムと統一
      var sfPayment2 = (data.items && data.items.length > 0) ? (data.items[0].paymentMethod || 'cash') : (data.shippingPayment || 'cash');
      ss.getSheetByName(SH.SALES).appendRow([
        Utilities.getUuid(), hId, data.orderId,
        '', '送料', Number(data.shippingFee), sfPayment2, data.completedAt
      ]);
    }
    if (Number(data.discount||0) > 0) {
      var dcPayment = (data.items && data.items.length > 0) ? (data.items[0].paymentMethod || 'cash') : (data.shippingPayment || 'cash');
      ss.getSheetByName(SH.SALES).appendRow([
        Utilities.getUuid(), hId, data.orderId,
        '', '割引', -Number(data.discount), dcPayment, data.completedAt
      ]);
    }
  }

  return ok({ hId: resultHId });
}

// ============================================================
//  削除
// ============================================================
function handleDeleteOrder(orderId) {
  if (!orderId) return err('orderId missing');
  invalidateCache();
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const iSh   = ss.getSheetByName(SH.ITEMS);
  const iRows = iSh.getDataRange().getValues();
  const ids   = iRows.filter(function(r){ return r[1]===orderId; }).map(function(r){ return r[0]; });
  deleteRowsWhere(ss.getSheetByName(SH.ORDERS), 0, orderId);
  deleteRowsWhere(iSh, 1, orderId);
  ids.forEach(function(id){ deleteRowsWhere(ss.getSheetByName(SH.STEPS), 1, id); });
  // 現地注文は登録時に売上・履歴が即記録されるため、削除時にも連動して消す
  deleteRowsWhere(ss.getSheetByName(SH.HISTORY), 1, orderId);
  deleteRowsWhere(ss.getSheetByName(SH.SALES),   2, orderId);
  return ok({ deleted: true });
}

// ============================================================
//  アイテム単体削除（在庫戻し含む）
// ============================================================
function handleDeleteItem(data) {
  if (!data.itemId) return err('itemId missing');
  invalidateCache();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  // ステップ削除
  deleteRowsWhere(ss.getSheetByName(SH.STEPS), 1, data.itemId);
  // アイテム削除
  deleteRowsWhere(ss.getSheetByName(SH.ITEMS), 0, data.itemId);
  // 在庫を戻す
  if (data.productId) {
    handleAdjustStock({ productId: data.productId, typeId: data.typeId||'', delta: 1, isShip: data.isShip });
  }
  return ok({ deleted: true });
}

// ============================================================
//  アイテム追加（既存注文に1個追加・在庫引き落とし）
// ============================================================
function handleAddItemToOrder(data) {
  if (!data.orderId || !data.itemId) return err('data missing');
  invalidateCache();
  const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  const iSh  = ss.getSheetByName(SH.ITEMS);
  const sSh  = ss.getSheetByName(SH.STEPS);
  const now  = new Date().toISOString();

  // アイテム行追加
  iSh.appendRow([
    data.itemId, data.orderId, data.pid, data.idx||0, 1,
    0, 0, data.price||0, data.paymentMethod||'',
    0, 0, data.typeId||'', data.typeName||'',
    data.optionFee||0, data.optionNote||'', data.doubleBinarize?1:0,
    data.engraveOpt?1:0, data.engraveLabel||''
  ]);

  // ステップ行追加（受付=step0を自動完了。物販のみ／彫刻オプション不使用なら全工程を完了扱いで作成）
  var nSteps = data.deliveryType === 'shipping' ? 7 : 6;
  var stepIds = [];
  for (var si = 0; si < nSteps; si++) {
    var sid = Utilities.getUuid();
    stepIds.push(sid);
    var isDone, stepAt, startedAt;
    if (data.allDone) {
      isDone = 1; stepAt = now; startedAt = now;
    } else {
      isDone    = si === 0 ? 1 : 0;
      stepAt    = si === 0 ? now : '';
      startedAt = si === 0 ? now : (si === 1 ? now : '');
    }
    sSh.appendRow([sid, data.itemId, si, isDone, startedAt, stepAt, isDone ? 0 : '']);
  }

  // 在庫を引く
  if (data.productId) {
    handleAdjustStock({ productId: data.productId, typeId: data.typeId||'', delta: -1, isShip: data.isShip });
  }

  // 既に売上記録済みの注文（現地：登録時、郵送：発送完了時）に追加した場合は、追加分もsalesに反映する
  appendSalesLineIfRecorded(ss, data.orderId, data.pid, data.productName, data.typeName, data.price, data.paymentMethod, now);

  return ok({ item: { id: data.itemId, stepIds: stepIds } });
}

// 注文が既にhistoryに売上記録済みなら、追加した1点分をsalesに1行追記する（未記録ならまだ売上計上のタイミングではないので何もしない）
function appendSalesLineIfRecorded(ss, orderId, pid, productName, typeName, price, paymentMethod, now) {
  var hSh   = ss.getSheetByName(SH.HISTORY);
  var hRows = hSh.getDataRange().getValues();
  for (var hi = 1; hi < hRows.length; hi++) {
    if (hRows[hi][1] === orderId) {
      var displayName = productName || pid || '';
      if (typeName) displayName += ' [' + typeName + ']';
      ss.getSheetByName(SH.SALES).appendRow([
        Utilities.getUuid(), hRows[hi][0], orderId,
        pid, displayName, Number(price||0), paymentMethod||'cash', now
      ]);
      return true;
    }
  }
  return false;
}

function handleDeleteHistory(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  deleteRowsWhere(ss.getSheetByName(SH.HISTORY), 0, data.historyId);
  deleteRowsWhere(ss.getSheetByName(SH.SALES),   1, data.historyId);
  if (data.orderId) handleDeleteOrder(data.orderId);
  return ok({ deleted: true });
}

function deleteRowsWhere(sheet, col, val) {
  const rows = sheet.getDataRange().getValues();
  for (var i = rows.length-1; i >= 1; i--) {
    if (rows[i][col] === val) sheet.deleteRow(i+1);
  }
}

// ============================================================
//  商品マスター
// ============================================================
function handleSaveProduct(p) {
  if (!p) return err('product missing');
  invalidateCache();
  const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SH.PRODUCTS);
  const rows = sh.getDataRange().getValues();
  const json          = JSON.stringify(p.stepTimes  || {});
  const typesJson     = JSON.stringify(p.types      || []);
  const setPricesJson = JSON.stringify(p.setPrices  || []);
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === p.id) {
      sh.getRange(i+1,1,1,14).setValues([[
        p.id, p.name, p.price, p.totalMinutes, json,
        p.stock||0, p.stockWarn||3, typesJson,
        p.stockLoc||0, p.stockShip||0, p.sharedStockWith||'', p.costPrice||0, setPricesJson,
        p.productType||'engrave'
      ]]);
      return ok({ saved: true });
    }
  }
  sh.appendRow([p.id, p.name, p.price, p.totalMinutes, json,
    p.stock||0, p.stockWarn||3, typesJson,
    p.stockLoc||0, p.stockShip||0, p.sharedStockWith||'', p.costPrice||0, setPricesJson,
    p.productType||'engrave']);
  return ok({ saved: true });
}

function handleDeleteProduct(productId) {
  invalidateCache();
  deleteRowsWhere(
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH.PRODUCTS), 0, productId
  );
  return ok({ deleted: true });
}

function handleReorderProducts(data) {
  var ids = data.ids || [];
  if (!ids.length) return err('ids missing');
  invalidateCache();
  var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh  = ss.getSheetByName(SH.PRODUCTS);
  var all = sh.getDataRange().getValues();
  if (all.length < 2) return ok({ reordered: true });

  var header = all[0];
  var rowMap  = {};
  for (var i = 1; i < all.length; i++) {
    var rowId = String(all[i][0]);
    rowMap[rowId] = all[i];
  }

  // IDリスト順に並べ直す（リストにないIDは末尾に追加）
  var newRows = [];
  ids.forEach(function(id) {
    if (rowMap[id]) { newRows.push(rowMap[id]); delete rowMap[id]; }
  });
  Object.keys(rowMap).forEach(function(id) { newRows.push(rowMap[id]); });

  // ヘッダー行を除くデータ範囲を一括上書き
  var dataRange = sh.getRange(2, 1, all.length - 1, header.length);
  // 新しい行数に合わせてバッファ作成
  var buf = newRows.map(function(r){ return r; });
  // 不足分を空行で埋める（行数が変わることは通常ないが安全のため）
  while (buf.length < all.length - 1) buf.push(header.map(function(){ return ''; }));
  dataRange.setValues(buf.slice(0, all.length - 1));

  return ok({ reordered: true });
}

// ============================================================
//  在庫調整
// ============================================================
function handleAdjustStock(data) {
  invalidateCache();
  var found = false;
  const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SH.PRODUCTS);
  const rows = sh.getDataRange().getValues();
  var logLoc = 0, logShip = 0;

  // sharedStockWith の解決：連動先が設定されている場合はそちらを操作する
  for (var ri = 1; ri < rows.length; ri++) {
    if (String(rows[ri][0]) === String(data.productId)) {
      var sharedWith = rows[ri][10]; // col 11: sharedStockWith
      if (sharedWith) {
        data = Object.assign({}, data, { productId: String(sharedWith), typeId: null });
      }
      break;
    }
  }

  for (var i = 1; i < rows.length; i++) {
    // String() で型の不一致を防ぐ
    if (String(rows[i][0]) === String(data.productId)) {
      found = true;
      if (data.typeId) {
        // タイプ別在庫更新
        var typesJson = rows[i][7] || '[]';
        var types = [];
        try { types = JSON.parse(typesJson); } catch(e){ types=[]; }
        types = types.map(function(t){
          if (String(t.id) === String(data.typeId)) {
            var curLoc  = Number(t.stockLoc  || 0);
            var curShip = Number(t.stockShip || 0);
            if (data.delta !== undefined) {
              // デルタモード（注文登録/削除）: GASが現在値を読んで加減算
              if (data.isShip) t.stockShip = Math.max(0, curShip + Number(data.delta));
              else             t.stockLoc  = Math.max(0, curLoc  + Number(data.delta));
            } else {
              // 絶対値モード（手動在庫調整）
              if (data.stockLoc  !== undefined) t.stockLoc  = data.stockLoc;
              if (data.stockShip !== undefined) t.stockShip = data.stockShip;
            }
            logLoc  = Number(t.stockLoc  || 0);
            logShip = Number(t.stockShip || 0);
          }
          return t;
        });
        sh.getRange(i+1,8).setValue(JSON.stringify(types));
      } else {
        // タイプなし在庫更新
        var curLoc  = Number(rows[i][8] || 0);
        var curShip = Number(rows[i][9] || 0);
        if (data.delta !== undefined) {
          // デルタモード: GASが現在値を読んで加減算
          if (data.isShip) {
            logShip = Math.max(0, curShip + Number(data.delta));
            logLoc  = curLoc;
            sh.getRange(i+1,10).setValue(logShip);
          } else {
            logLoc  = Math.max(0, curLoc + Number(data.delta));
            logShip = curShip;
            sh.getRange(i+1,9).setValue(logLoc);
          }
        } else {
          // 絶対値モード（手動在庫調整）
          if (data.stockLoc  !== undefined) { sh.getRange(i+1,9).setValue(data.stockLoc);   logLoc  = data.stockLoc;  }
          if (data.stockShip !== undefined) { sh.getRange(i+1,10).setValue(data.stockShip); logShip = data.stockShip; }
        }
      }
      break;
    }
  }

  // ログ記録（見つからない場合も記録）
  const logSh = ss.getSheetByName(SH.STOCK_LOG);
  if (logSh) {
    var modeNote = data.delta !== undefined ? 'delta:'+data.delta : 'abs';
    var logNote = (data.typeId ? 'type:'+data.typeId+' ' : '')
      + modeNote + ' loc:' + logLoc + ' ship:' + logShip
      + (data.isShip ? ' [郵送]' : ' [現地]')
      + (found ? '' : ' ★NOT_FOUND★');
    logSh.appendRow([
      Utilities.getUuid(), String(data.productId),
      data.isShip ? logShip : logLoc,
      (data.reason||'') + ' ' + logNote,
      new Date().toISOString()
    ]);
  }

  if (!found) return err('商品が見つかりません: ' + data.productId);
  return ok({ adjusted: true });
}

// ============================================================
//  履歴更新
// ============================================================
function handleUpdateHistory(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (data.deliveryType !== undefined) {
    const hSh   = ss.getSheetByName(SH.HISTORY);
    const hRows = hSh.getDataRange().getValues();
    for (var i = 1; i < hRows.length; i++) {
      if (hRows[i][0] === data.historyId) {
        hSh.getRange(i+1,6).setValue(data.deliveryType); break;
      }
    }
  }
  if (data.salesItems && data.salesItems.length) {
    const sSh   = ss.getSheetByName(SH.SALES);
    const sRows = sSh.getDataRange().getValues();
    data.salesItems.forEach(function(si){
      for (var i = 1; i < sRows.length; i++) {
        if (sRows[i][0] === si.id) {
          if (si.price         !== undefined) sSh.getRange(i+1,6).setValue(si.price);
          if (si.paymentMethod !== undefined) sSh.getRange(i+1,7).setValue(si.paymentMethod);
          break;
        }
      }
    });
  }
  return ok({ updated: true });
}

function handleExportCSV() {
  return ok({ url: SpreadsheetApp.openById(SPREADSHEET_ID).getUrl() });
}

// ============================================================
//  過去データ修正：salesシートのproductNameに種類名を付加
//  ※ fixAllSheets() を実行してから使うこと
//  GASエディタから直接実行する（APIからは不要）
// ============================================================
// ============================================================
//  既存itemsシートのtypeName空白をtypeIdから補完
// ============================================================
function handleFixItemTypes() {
  invalidateCache();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // products から typeId→typeName マップを作成
  var typeNameMap = {};
  sheetToObjects(ss.getSheetByName(SH.PRODUCTS)).forEach(function(p){
    try {
      var types = JSON.parse(p.typesJson || '[]');
      (types||[]).forEach(function(t){ typeNameMap[String(t.id)] = t.name || ''; });
    } catch(e){}
  });

  // itemsシートを直接更新
  const iSh   = ss.getSheetByName(SH.ITEMS);
  const iRows = iSh.getDataRange().getValues();
  var fixed = 0;
  for (var i = 1; i < iRows.length; i++) {
    var typeId   = String(iRows[i][11] || '');  // col 12 = typeId (0-indexed 11)
    var typeName = String(iRows[i][12] || '');  // col 13 = typeName (0-indexed 12)
    if (typeId && !typeName) {
      var name = typeNameMap[typeId];
      if (name) {
        iSh.getRange(i+1, 13).setValue(name);
        fixed++;
      }
    }
  }
  return ok({ fixed: fixed });
}

function fixSalesTypeNames() {
  var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  var iSh  = ss.getSheetByName(SH.ITEMS);
  var sSh  = ss.getSheetByName(SH.SALES);

  var items = sheetToObjects(iSh);
  var salesData = sSh.getDataRange().getValues();
  if (salesData.length < 2) return 'データなし';

  var sHeaders = salesData[0];
  var orderIdCol    = sHeaders.indexOf('orderId');
  var pidCol        = sHeaders.indexOf('pid');
  var productNameCol= sHeaders.indexOf('productName');
  if (orderIdCol < 0 || pidCol < 0 || productNameCol < 0) {
    return 'salesシートのヘッダーが不正です';
  }

  // itemsをorderId+pidでグループ化（idx昇順）
  var itemGroups = {};
  items.forEach(function(it){
    if (!it.typeName) return;
    var key = String(it.orderId) + '__' + String(it.pid);
    if (!itemGroups[key]) itemGroups[key] = [];
    itemGroups[key].push(it);
  });
  Object.keys(itemGroups).forEach(function(key){
    itemGroups[key].sort(function(a,b){ return Number(a.idx||0) - Number(b.idx||0); });
  });

  // salesをorderId+pidでグループ化（行番号付き）
  var salesGroups = {};
  for (var i = 1; i < salesData.length; i++) {
    var row = salesData[i];
    var key = String(row[orderIdCol]) + '__' + String(row[pidCol]);
    if (!salesGroups[key]) salesGroups[key] = [];
    salesGroups[key].push({ rowNum: i + 1, name: String(row[productNameCol]) });
  }

  var updated = 0;
  Object.keys(itemGroups).forEach(function(key){
    var itList  = itemGroups[key];
    var saList  = salesGroups[key];
    if (!saList) return;
    for (var j = 0; j < Math.min(itList.length, saList.length); j++) {
      var it = itList[j], sa = saList[j];
      if (!it.typeName) continue;
      if (sa.name.indexOf('[') >= 0) continue; // 既に種類名あり
      var newName = sa.name + ' [' + it.typeName + ']';
      sSh.getRange(sa.rowNum, productNameCol + 1).setValue(newName);
      updated++;
    }
  });

  return '完了: ' + updated + '件更新';
}

// ============================================================
//  在庫移動（現地⇔郵送）
// ============================================================
function handleTransferStock(data) {
  // data: {productId, typeId, amount, toShip}
  // toShip=true: loc→ship, toShip=false: ship→loc
  if (!data.productId || !(data.amount > 0)) return err('invalid data');
  invalidateCache();
  var amt = Number(data.amount);
  // Reduce source
  handleAdjustStock({ productId: data.productId, typeId: data.typeId||'', delta: -amt, isShip: !data.toShip });
  // Increase destination
  handleAdjustStock({ productId: data.productId, typeId: data.typeId||'', delta: +amt, isShip: data.toShip });
  return ok({ transferred: amt });
}

// ============================================================
//  ユーティリティ
// ============================================================
function sheetToObjects(sheet) {
  if (!sheet) return [];
  const all = sheet.getDataRange().getValues();
  if (all.length < 2) return [];
  const headers = all[0];
  return all.slice(1).map(function(r){
    const obj = {};
    headers.forEach(function(h,i){ obj[h] = (r[i]===''?null:r[i]); });
    return obj;
  });
}

// ============================================================
//  初回セットアップ（手動実行）
// ============================================================
function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  createSheetWithHeaders(ss, SH.CONFIG,    ['key','value']);
  createSheetWithHeaders(ss, SH.PRODUCTS,  ['id','name','price','totalMinutes','stepTimesJson','stock','stockWarn','typesJson','stockLoc','stockShip','sharedStockWith','costPrice','setPricesJson','productType']);
  createSheetWithHeaders(ss, SH.ORDERS,    ['id','num','note','deliveryType','createdAt','completedAt','status','sharedImageRef','channel','shippingFee','discount','numGroup']);
  createSheetWithHeaders(ss, SH.ITEMS,     ['id','orderId','pid','idx','totalOf','skipBinarize','skipDesign','price','paymentMethod','onHold','paid','typeId','typeName','optionFee','optionNote','doubleBinarize','engraveOpt','engraveLabel']);
  createSheetWithHeaders(ss, SH.STEPS,     ['id','itemId','stepIndex','done','startedAt','completedAt','durationMins']);
  createSheetWithHeaders(ss, SH.HISTORY,   ['id','orderId','num','completedAt','waitMinutes','deliveryType']);
  createSheetWithHeaders(ss, SH.SALES,     ['id','historyId','orderId','pid','productName','price','paymentMethod','completedAt']);
  createSheetWithHeaders(ss, SH.STOCK_LOG, ['id','productId','stock','reason','createdAt']);
  createSheetWithHeaders(ss, SH.EXPENSES,    ['id','date','category','amount','note']);
  createSheetWithHeaders(ss, SH.FIXED_COSTS,['id','date','category','amount','note']);

  const pw   = 'luke1227mb';
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, pw, Utilities.Charset.UTF_8
  ).map(function(b){ return ('0'+(b&0xFF).toString(16)).slice(-2); }).join('');
  setConfig('passwordHash', hash);
  setConfig('sessionTokens', '[]');
  setConfig('laborRatePerHour', '0');
  Logger.log('✅ セットアップ完了！ パスワード: ' + pw);
}

function createSheetWithHeaders(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length)
      .setBackground('#1a1a2e').setFontColor('#c8a84a').setFontWeight('bold');
  }
  return sh;
}

// ============================================================
//  診断・シート修正ツール（問題発生時に実行）
// ============================================================
function diagnose() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ['orders','items','steps','products','config','history','sales','stock_log'];
  sheets.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) { Logger.log(name + ': シートなし'); return; }
    const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    Logger.log(name + 'ヘッダー(' + sh.getLastColumn() + '列): ' + JSON.stringify(headers));
    Logger.log(name + 'データ行数: ' + (sh.getLastRow()-1));
  });
}

function fixAllSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  fixHeader(ss,'orders',   ['id','num','note','deliveryType','createdAt','completedAt','status','sharedImageRef','channel','shippingFee','discount','numGroup']);
  fixHeader(ss,'items',    ['id','orderId','pid','idx','totalOf','skipBinarize','skipDesign','price','paymentMethod','onHold','paid','typeId','typeName','optionFee','optionNote','doubleBinarize','engraveOpt','engraveLabel']);
  fixHeader(ss,'steps',    ['id','itemId','stepIndex','done','startedAt','completedAt','durationMins']);
  fixHeader(ss,'products', ['id','name','price','totalMinutes','stepTimesJson','stock','stockWarn','typesJson','stockLoc','stockShip','sharedStockWith','costPrice','setPricesJson','productType']);
  fixHeader(ss,'history',  ['id','orderId','num','completedAt','waitMinutes','deliveryType']);
  fixHeader(ss,'sales',    ['id','historyId','orderId','pid','productName','price','paymentMethod','completedAt']);
  fixHeader(ss,'config',   ['key','value']);
  fixHeader(ss,'stock_log',['id','productId','stock','reason','createdAt']);
  fixHeader(ss,'expenses',    ['id','date','category','amount','note']);
  fixHeader(ss,'fixed_costs', ['id','date','category','amount','note']);
  Logger.log('✅ 全シート修正完了');
  diagnose();
}

function fixHeader(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    Logger.log(name + ': シート新規作成');
  }
  var cur = sh.getLastColumn();
  if (cur < headers.length) {
    sh.insertColumnsAfter(Math.max(cur,1), headers.length - Math.max(cur,1));
  }
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.getRange(1,1,1,headers.length)
    .setBackground('#1a1a2e').setFontColor('#c8a84a').setFontWeight('bold');
  sh.setFrozenRows(1);
  Logger.log(name + ': ヘッダー修正完了');
}

// ============================================================
//  既存ステップの実績時間を再計算（手動実行用）
//  durationMins が 0 または空のステップを対象に、
//  前のステップの completedAt から startedAt を再計算して上書きする
// ============================================================
function recalcStepDurations() {
  var sh   = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH.STEPS);
  var rows = sh.getDataRange().getValues();
  // col: 0=id, 1=itemId, 2=stepIndex, 3=done, 4=startedAt, 5=completedAt, 6=durationMins

  // itemId → steps のマップを作成
  var byItem = {};
  for (var i = 1; i < rows.length; i++) {
    var iid = rows[i][1];
    if (!byItem[iid]) byItem[iid] = [];
    byItem[iid].push({ row: i, si: Number(rows[i][2]), done: rows[i][3], completedAt: rows[i][5], durationMins: rows[i][6] });
  }

  var fixed = 0;
  for (var i = 1; i < rows.length; i++) {
    var done     = rows[i][3];
    var stepIdx  = Number(rows[i][2]);
    var completedAt = rows[i][5];
    var durMins  = rows[i][6];

    // 完了済み、かつ durationMins が 0 か空、かつ completedAt がある行を対象
    if (!done || !completedAt) continue;
    var durNum = (durMins === '' || durMins === null) ? -1 : Number(durMins);
    if (durNum > 0) continue; // 正常値はスキップ
    if (stepIdx === 0) continue; // 受付は除外

    // 前のステップ（同じ itemId で stepIndex = stepIdx-1）の completedAt を探す
    var iid    = rows[i][1];
    var steps  = byItem[iid] || [];
    var prevStep = null;
    for (var k = 0; k < steps.length; k++) {
      if (steps[k].si === stepIdx - 1) { prevStep = steps[k]; break; }
    }

    var startedAt = '';
    if (prevStep && prevStep.completedAt) {
      startedAt = (prevStep.completedAt instanceof Date)
        ? prevStep.completedAt.toISOString()
        : String(prevStep.completedAt);
    }
    if (!startedAt) continue; // 前ステップがなければスキップ

    var endVal = (completedAt instanceof Date) ? completedAt.toISOString() : String(completedAt);
    var start  = new Date(startedAt);
    var end    = new Date(endVal);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    var dur = Math.round((end - start) / 60000);
    if (dur <= 0) continue; // 計算できないものはスキップ

    // startedAt と durationMins を上書き
    sh.getRange(i + 1, 5).setValue(startedAt);
    sh.getRange(i + 1, 7).setValue(dur);
    fixed++;
    Logger.log('修正: row=' + (i+1) + ' itemId=' + iid + ' step=' + stepIdx + ' dur=' + dur + '分');
  }

  Logger.log('✅ recalcStepDurations 完了: ' + fixed + '件修正');
  return fixed;
}

// ============================================================
//  管理会計 — マルシェ費用
// ============================================================
function handleGetExpenses(year, month) {
  var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh  = ss.getSheetByName(SH.EXPENSES);
  if (!sh) return ok({ expenses: [] });
  var rows = sheetToObjects(sh);
  if (year) {
    rows = rows.filter(function(r) {
      var d = new Date(r.date);
      return d.getFullYear() == year && (month ? (d.getMonth()+1) == month : true);
    });
  }
  return ok({ expenses: rows });
}

function handleSaveExpense(exp) {
  if (!exp || !exp.date || !exp.amount) return err('expense data missing');
  var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh  = ss.getSheetByName(SH.EXPENSES);
  if (!sh) sh = createSheetWithHeaders(ss, SH.EXPENSES, ['id','date','category','amount','note']);
  var id = exp.id || Utilities.getUuid();
  // 既存IDがあれば上書き
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sh.getRange(i+1,1,1,5).setValues([[id, exp.date, exp.category||'other', Number(exp.amount||0), exp.note||'']]);
      return ok({ saved: true, id: id });
    }
  }
  sh.appendRow([id, exp.date, exp.category||'other', Number(exp.amount||0), exp.note||'']);
  return ok({ saved: true, id: id });
}

function handleDeleteExpense(expenseId) {
  if (!expenseId) return err('expenseId missing');
  var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh  = ss.getSheetByName(SH.EXPENSES);
  if (!sh) return ok({ deleted: false });
  var rows = sh.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(expenseId)) {
      sh.deleteRow(i+1);
      return ok({ deleted: true });
    }
  }
  return ok({ deleted: false });
}

function handleSaveLaborRate(rate) {
  setConfig('laborRatePerHour', String(Number(rate)||0));
  invalidateCache();
  return ok({ saved: true });
}

// ============================================================
//  固定費・仕入れ（事業全体 P&L 用）
// ============================================================
function handleGetFixedCosts(year, month) {
  var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh  = ss.getSheetByName(SH.FIXED_COSTS);
  if (!sh) return ok({ costs: [] });
  var rows = sheetToObjects(sh);
  if (year) {
    rows = rows.filter(function(r) {
      var d = new Date(r.date);
      return d.getFullYear() == year && (month ? (d.getMonth()+1) == month : true);
    });
  }
  return ok({ costs: rows });
}

function handleSaveFixedCost(cost) {
  if (!cost || !cost.date || !cost.amount) return err('cost data missing');
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH.FIXED_COSTS);
  if (!sh) sh = createSheetWithHeaders(ss, SH.FIXED_COSTS, ['id','date','category','amount','note']);
  var id = cost.id || Utilities.getUuid();
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sh.getRange(i+1,1,1,5).setValues([[id, cost.date, cost.category||'other', Number(cost.amount||0), cost.note||'']]);
      return ok({ saved: true, id: id });
    }
  }
  sh.appendRow([id, cost.date, cost.category||'other', Number(cost.amount||0), cost.note||'']);
  return ok({ saved: true, id: id });
}

function handleDeleteFixedCost(costId) {
  if (!costId) return err('costId missing');
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH.FIXED_COSTS);
  if (!sh) return ok({ deleted: false });
  var rows = sh.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(costId)) {
      sh.deleteRow(i+1);
      return ok({ deleted: true });
    }
  }
  return ok({ deleted: false });
}
