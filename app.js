// หน้าเปิดระบบลงงานประจำวัน (แอปที่ติดตั้งได้) — ฝังหน้าระบบ (Google Apps Script /exec) เต็มจอ
// Apps Script ใส่ไฟล์ประกาศแอป (manifest) เองไม่ได้ → Chrome ให้แค่ "สร้างทางลัด" ⇒ หน้านี้มี manifest + ไอคอน แล้วฝังหน้าระบบไว้ข้างใน
// ลิงก์ระบบไม่อยู่ในไฟล์ใดของหน้านี้ (หน้านี้อยู่ใน repo สาธารณะ): ตั้งครั้งเดียวต่อเครื่อง — ลิงก์ตั้งค่า #exec=<ลิงก์> หรือวางในช่อง ·
// เก็บใน localStorage ของเครื่อง · หน้าระบบส่ง { type: 'dws-ready' } มาเมื่อเปิดได้ (เข้าสู่ระบบ Google แล้ว) — ไม่มาในเวลา = บอกทางแก้
(function (root) {
  'use strict';

  var STORE_KEY = 'dws.launcher.execUrl.v1';
  var AFTER_LOAD_MS = 8000;   // กรอบโหลดเสร็จแล้ว (รวมหน้า error ของ Google) แต่หน้าระบบยังไม่ส่งข้อความ = ยังไม่ได้เข้าสู่ระบบ / เปิดไม่ได้
  var GIVE_UP_MS = 25000;     // กรอบไม่โหลดเลย (เน็ตช้า / หลุด)

  // ลิงก์ระบบที่ยอมรับ: /exec หรือ /dev ของ Apps Script (บัญชีทั่วไป / Workspace) — ตัด ?… #… ทิ้ง · ไม่ใช่ = ''
  // หน้านี้รันบนเครื่อง (localhost) = รับหน้าระบบจำลอง (npm run dev) ด้วย
  function normalizeExecUrl(text, pageHost) {
    var raw = String(text === null || text === undefined ? '' : text).trim();
    if (/^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]{20,}\/(?:exec|dev)(?:[?#].*)?$/.test(raw)) {
      return raw.replace(/[?#].*$/, '');
    }
    if (/^(localhost|127\.0\.0\.1)$/.test(String(pageHost || ''))) {
      var dev = /^(http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)\/?(?:[?#].*)?$/.exec(raw);
      if (dev) return dev[1] + '/';
    }
    return '';
  }

  // ลิงก์ตั้งค่า: https://…/#exec=<ลิงก์ระบบ> (ส่วนหลัง # ไม่ถูกส่งไปที่ server ของหน้านี้)
  function readSetupFragment(hash) {
    var m = /^#exec=(.+)$/.exec(String(hash || ''));
    if (!m) return '';
    try {
      return decodeURIComponent(m[1]);
    } catch (error) {
      return '';
    }
  }

  // ข้อความ "เปิดได้แล้ว" ต้องมาจากกรอบ sandbox ของ Google (หน้าระบบจริง) หรือจากหน้าระบบจำลองบนเครื่อง
  function isReadyMessage(origin, data, execUrl) {
    if (!data || data.type !== 'dws-ready') return false;
    var from = String(origin || '');
    if (/^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com$/.test(from)) return true;
    var dev = /^(http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)\//.exec(String(execUrl || ''));
    return !!dev && from === dev[1];
  }

  var api = { normalizeExecUrl: normalizeExecUrl, readSetupFragment: readSetupFragment, isReadyMessage: isReadyMessage, STORE_KEY: STORE_KEY };
  root.DWSLauncher = api;
  if (root.DWS_LAUNCHER_TEST || typeof document === 'undefined') return;

  // ---------- หน้าจอ ----------
  var frame = document.getElementById('app');
  var cover = document.getElementById('cover');
  var waiting = document.getElementById('waiting');
  var help = document.getElementById('help');
  var setup = document.getElementById('setup');
  var input = document.getElementById('execInput');
  var setupError = document.getElementById('setupError');
  var execUrl = '';
  var ready = false;
  var timers = [];

  function readStore() {
    try { return root.localStorage.getItem(STORE_KEY) || ''; } catch (error) { return ''; }
  }
  function writeStore(value) {
    try {
      if (value) root.localStorage.setItem(STORE_KEY, value);
      else root.localStorage.removeItem(STORE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }
  function clearTimers() {
    timers.forEach(function (id) { clearTimeout(id); });
    timers = [];
  }

  function showSetup(message) {
    clearTimers();
    frame.hidden = true;
    cover.hidden = true;
    setup.hidden = false;
    setupError.textContent = message || '';
    setupError.hidden = !message;
    input.value = execUrl;
    input.focus();
  }

  function showHelp() {
    if (ready) return;
    waiting.hidden = true;
    help.hidden = false;
  }

  // เปิดหน้าระบบในกรอบ · ข้อความปิดจนกว่าหน้าระบบจะบอกว่าเปิดได้
  function openApp() {
    clearTimers();
    ready = false;
    setup.hidden = true;
    cover.hidden = false;
    waiting.hidden = false;
    help.hidden = true;
    frame.hidden = false;
    frame.src = execUrl;
    timers.push(setTimeout(showHelp, GIVE_UP_MS));
  }

  frame.addEventListener('load', function () {
    if (!ready && frame.src) timers.push(setTimeout(showHelp, AFTER_LOAD_MS));
  });

  root.addEventListener('message', function (event) {
    if (!isReadyMessage(event.origin, event.data, execUrl)) return;
    ready = true;
    clearTimers();
    cover.hidden = true;
  });

  // กลับมาที่แอป (เช่น หลังเข้าสู่ระบบ Google ในหน้าต่างที่เปิดแยก) และหน้าระบบยังไม่เปิด = โหลดใหม่
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && execUrl && !ready && setup.hidden) openApp();
  });

  document.getElementById('signIn').addEventListener('click', function () {
    root.open(execUrl, '_blank', 'noopener');
  });
  document.getElementById('retry').addEventListener('click', openApp);
  // ผู้ดูแล: เอาข้อความออกให้เห็นว่า Google แสดงอะไรในกรอบ (เช่น "ต้องมีสิทธิ์เข้าถึง" = บัญชีในเครื่องเปิดลิงก์นี้ไม่ได้) — แคปส่งผู้ดูแลระบบ
  document.getElementById('peek').addEventListener('click', function () { cover.hidden = true; });
  document.getElementById('changeLink').addEventListener('click', function () { showSetup(''); });

  setup.addEventListener('submit', function (event) {
    event.preventDefault();
    var url = normalizeExecUrl(input.value, root.location.hostname);
    if (!url) {
      showSetup('ลิงก์ไม่ถูกต้อง — ต้องเป็นลิงก์ระบบที่ลงท้ายด้วย /exec');
      return;
    }
    execUrl = url;
    if (!writeStore(url)) {
      showSetup('เครื่องนี้เก็บลิงก์ไม่ได้ (ปิดโหมดไม่ระบุตัวตน แล้วลองใหม่)');
      return;
    }
    openApp();
  });

  // ลิงก์ตั้งค่าใน # → บันทึก (ถูกต้อง) แล้วลบออกจากแถบที่อยู่ · คืน 'saved' / 'invalid' / '' (ไม่มี)
  function takeSetupHash() {
    var fromHash = readSetupFragment(root.location.hash);
    if (!fromHash) return '';
    var url = normalizeExecUrl(fromHash, root.location.hostname);
    if (url) writeStore(url);
    try { root.history.replaceState(null, '', root.location.pathname + root.location.search); } catch (error) { /* ไม่สำคัญ */ }
    return url ? 'saved' : 'invalid';
  }

  // เริ่ม: ลิงก์ตั้งค่าก่อน → ลิงก์ที่เครื่องจำไว้ → ไม่มี / ลิงก์ตั้งค่าผิด = หน้าตั้งค่า (ช่องมีลิงก์เดิมให้)
  function start() {
    var taken = takeSetupHash();
    execUrl = normalizeExecUrl(readStore(), root.location.hostname);
    if (execUrl && taken !== 'invalid') openApp();
    else showSetup(taken === 'invalid' ? 'ลิงก์ในลิงก์ตั้งค่าไม่ถูกต้อง — วางลิงก์ระบบที่ลงท้ายด้วย /exec' : '');
  }

  // เปิดลิงก์ตั้งค่าตอนหน้านี้เปิดอยู่แล้ว = เปลี่ยนแค่ # (ไม่โหลดหน้าใหม่) — ใช้ลิงก์ใหม่ทันที
  root.addEventListener('hashchange', function () {
    if (readSetupFragment(root.location.hash)) start();
  });
  start();

  // เปิดหน้านี้ได้แม้เน็ตหลุด (ข้อความบอกให้ลองใหม่แทนหน้าไดโนเสาร์ของ Chrome)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* ไม่มีก็ใช้งานได้ */ });
  }
})(this);
