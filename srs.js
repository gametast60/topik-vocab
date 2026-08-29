
const SRS_DATE      = "topik_srs_date";
const BOX_INTERVALS  = [0, 1, 3, 7, 14];   // index 5 (box 5) ไม่ใช้ค่านี้ ใช้ BOX5_INTERVAL แทนเสมอ ดู recordAnswer()
const BOX5_CHUNK_SIZE = 30;   // คำ/วัน จากกล่อง 5
const BOX5_INTERVAL   = 30;   // วันก่อนทวนซ้ำหลังตอบถูก
const TOMORROW_WARNING_THRESHOLD = 90;   // เกณฑ์แจ้งเตือนภาระการทวนของวันพรุ่งนี้ (Soft Limit)
const LEECH_THRESHOLD = 5;   // ตอบผิดสะสมกี่ครั้งถึงนับเป็น leech (คำยากที่วนซ้ำ)


// key สำหรับ settings แยกตาม topik
function srsSettingsKey() {
  return `topik_srs_settings_${currentTopik || "topik1"}`;
}

const WRONG_BOX_MAX = 30;       // กล่อง 6 จุได้สูงสุด 30 คำ
const DUE_CHUNK_SIZE = 20;      // ทวนวันนี้ทีละกี่คำ (ปรับได้)

// key ที่ใช้เก็บ SRS data แยกตาม topik
function srsKey() {
  return `topik_srs_${currentTopik || "topik1"}_v1`;
}
// key กล่อง 6 (wrong box) แยกตาม topik รีเซ็ตทุกวัน
function wrongBoxKey() {
  return `topik_wrongbox_${currentTopik || "topik1"}`;
}

function getDueChunkSize() {
  const s = JSON.parse(localStorage.getItem(srsSettingsKey()) || "{}");
  return s.dueChunkSize || DUE_CHUNK_SIZE;
}
function setDueChunkSize(n) {
  const s = JSON.parse(localStorage.getItem(srsSettingsKey()) || "{}");
  s.dueChunkSize = n;
  localStorage.setItem(srsSettingsKey(), JSON.stringify(s));
}

function getWrongChunkSize() {
  const s = JSON.parse(localStorage.getItem(srsSettingsKey()) || "{}");
  return s.wrongChunkSize || 15;
}
function setWrongChunkSize(n) {
  const s = JSON.parse(localStorage.getItem(srsSettingsKey()) || "{}");
  s.wrongChunkSize = n;
  localStorage.setItem(srsSettingsKey(), JSON.stringify(s));
}

function getPracticeChunkSize() {
  const s = JSON.parse(localStorage.getItem(srsSettingsKey()) || "{}");
  return s.practiceChunkSize || 10;
}
function setPracticeChunkSize(n) {
  const s = JSON.parse(localStorage.getItem(srsSettingsKey()) || "{}");
  s.practiceChunkSize = n;
  localStorage.setItem(srsSettingsKey(), JSON.stringify(s));
}

function loadSRS() {
  try { return JSON.parse(localStorage.getItem(srsKey()) || "{}"); }
  catch(e) { return {}; }
}
function saveSRS(data) {
  localStorage.setItem(srsKey(), JSON.stringify(data));
}

// ==========================================================
// WRONG BOX (กล่อง 6) — รีเซ็ตทุกวัน 00:00
// ==========================================================
function loadWrongBox() {
  try {
    const raw = JSON.parse(localStorage.getItem(wrongBoxKey()) || "{}");
    if (raw.date !== todayStr()) {
      const fresh = { date: todayStr(), words: [] };
      saveWrongBox(fresh);
      return fresh;
    }
    return raw;
  } catch(e) {
    const fresh = { date: todayStr(), words: [] };
    saveWrongBox(fresh);
    return fresh;
  }
}

function saveWrongBox(wb) {
  localStorage.setItem(wrongBoxKey(), JSON.stringify(wb));
}
function getWrongBoxWords() {
  return loadWrongBox().words || [];
}
function addToWrongBox(item) {
  const wb = loadWrongBox();
  if (wb.words.length >= WRONG_BOX_MAX) return; // เต็มแล้ว
  if (!wb.words.some(w => w.word === item.word)) {
    wb.words.push({ word: item.word, meaning: item.meaning });
    saveWrongBox(wb);
  }
}
function isWrongBoxFull() {
  return loadWrongBox().words.length >= WRONG_BOX_MAX;
}
function clearWrongBox() {
  saveWrongBox({ date: todayStr(), words: [] });
}

// ==========================================================
// BOX 5 DUE-DATE PRIORITY — ทวนระยะยาวสูงสุด 30 คำ/วัน
// ==========================================================

/**
 * ดึงคำทวนประจำวันของกล่อง 5
 * - ล้างคีย์ borrowedFor ที่ไม่ตรงกับวันนี้ (Auto-Cleanup สำหรับวันใหม่)
 * - หากจำนวนคำทวนกล่อง 5 ที่ถึงกำหนดทวนจริง (D) มีไม่ถึง 30 คำ
 * - จะทำการยืม (borrow) คำจากอนาคตมาเติมจนครบ 30 คำ โดยใช้ item.borrowedFor = today
 */
function processDailyBox5Queue() {
  const data = loadSRS();
  const today = todayStr();
  const limit = 30;

  // ① Auto-Cleanup: ลบ borrowedFor ทั้งหมดที่ไม่ใช่วันนี้ (สำหรับกรณีดองหรือเปลี่ยนวัน)
  let srsChanged = false;
  Object.values(data).forEach(item => {
    if (item.borrowedFor && item.borrowedFor !== today) {
      delete item.borrowedFor;
      srsChanged = true;
    }
  });
  if (srsChanged) {
    saveSRS(data);
  }

  // ② นับจำนวนคำกล่อง 5 ที่ถึงกำหนดทวนจริง (รวมคำที่ถูกยืมสำหรับวันนี้)
  const realDue = Object.values(data).filter(item =>
    item.box === 5 &&
    item.nextReview &&
    item.nextReview <= today
  );

  const borrowedToday = Object.values(data).filter(item =>
    item.box === 5 &&
    item.borrowedFor === today
  );

  const D = realDue.length + borrowedToday.length;

  if (D >= limit) {
    // มีคำที่ถึงกำหนด (รวมคำค้าง) ครบ 30 คำอยู่แล้ว -> ไม่ต้องดึงเพิ่ม
    return;
  }

  const needed = limit - D;

  // ③ ค้นหาคำศัพท์กล่อง 5 ในอนาคต/รอคิวทวน (หลีกเลี่ยงคำที่มี borrowedFor === today อยู่แล้ว)
  const candidates = Object.values(data).filter(item =>
    item.box === 5 &&
    (!item.borrowedFor || item.borrowedFor !== today) &&
    (item.nextReview === null || item.nextReview === undefined || item.nextReview > today)
  );

  if (candidates.length === 0) return;

  // จัดกลุ่ม candidates ตาม nextReview (กลุ่ม null อยู่หน้าสุด)
  const groups = {};
  candidates.forEach(item => {
    const key = item.nextReview || "null";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  // เรียงลำดับ key: "null" ก่อน จากนั้นเป็นวันที่เรียงจากเก่าไปใหม่
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === "null") return -1;
    if (b === "null") return 1;
    return a.localeCompare(b);
  });

  let collectedCount = 0;
  let changed = false;

  // ดึงคำจากอนาคตทีละวันมาเติมจนครบ
  for (const key of sortedKeys) {
    if (collectedCount >= needed) break;

    const group = groups[key];
    const stillNeeded = needed - collectedCount;

    if (group.length <= stillNeeded) {
      // ดึงทั้งหมดในกลุ่มวันนี้
      group.forEach(item => {
        item.borrowedFor = today;
        collectedCount++;
      });
      changed = true;
    } else {
      // สุ่มเลือกเฉพาะ stillNeeded คำจากกลุ่มวันนี้
      const shuffledGroup = shuffleArray([...group]);
      const selected = shuffledGroup.slice(0, stillNeeded);
      selected.forEach(item => {
        item.borrowedFor = today;
        collectedCount++;
      });
      changed = true;
    }
  }

  if (changed) {
    saveSRS(data);
  }
}

// ==========================================================
// DATE HELPERS
// ==========================================================
function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr, n) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// รีเซ็ทคำใหม่รายวัน (counter แยกตาม topik)
function checkDailyReset() {
  const today = todayStr();
  const dateKey = `${SRS_DATE}_${currentTopik}`;
  if (localStorage.getItem(dateKey) !== today) {
    const s = JSON.parse(localStorage.getItem(srsSettingsKey()) || "{}");
    const countKey = `todayNewWords_${currentTopik}`;
    s[countKey] = 0;
    localStorage.setItem(srsSettingsKey(), JSON.stringify(s));
    processDailyBox5Queue();                          // ← Box5 Queue รายวัน
    localStorage.setItem(dateKey, today);
  }
}

// โหลดคำศัพท์ของ topik ปัจจุบันเข้า SRS (ครั้งแรกเท่านั้น)
function initAllVocab() {
  const vocab = (typeof getTopikVocab === "function")
    ? getTopikVocab(currentTopik)
    : [];

  // ป้องกันกรณีไฟล์ข้อมูลไม่โหลดหรือเกิดความผิดพลาดในการดึงข้อมูล
  if (!Array.isArray(vocab) || vocab.length === 0) {
    console.warn("Vocab not loaded for current topik:", currentTopik);
    return;
  }

  const data = loadSRS();
  let changed = false;

  // 1. เพิ่มคำศัพท์ใหม่ หรืออัปเดตความหมายใหม่โดยไม่มีการลบคำเก่าอัติโนมัติ
  vocab.forEach(item => {
    if (!data[item.word]) {
      data[item.word] = { word: item.word, meaning: item.meaning, box: 0, nextReview: null, lapses: 0 };
      changed = true;
    } else if (data[item.word].meaning !== item.meaning) {
      data[item.word].meaning = item.meaning;
      changed = true;
    }
  });

  if (changed) saveSRS(data);

  // Migration V3: เปลี่ยนมาใช้ Due-Date Priority (borrowedFor)
  const migKey = `topik_box5_migrated_v3_${currentTopik || "topik1"}`;
  if (localStorage.getItem(migKey) !== "true") {
    processDailyBox5Queue();
    // ทำความสะอาดคีย์คิวเก่า
    localStorage.removeItem(`topik_box5_queue_${currentTopik || "topik1"}`);
    localStorage.removeItem(`topik_box5_pointer_${currentTopik || "topik1"}`);
    localStorage.setItem(migKey, "true");
  }
}

function getBoxCounts() {
  const data = loadSRS();
  const counts = [0,0,0,0,0,0];
  const items = Object.values(data);
  const total = items.length;
  items.forEach(item => {
    let box = (item.box === undefined || item.box === null) ? 0 : Number(item.box);
    if (box >= 1) {
      counts[Math.min(box, 5)]++;
    }
  });
  counts[0] = Math.max(0, total - (counts[1] + counts[2] + counts[3] + counts[4] + counts[5]));
  return counts;
}

// คำที่ถึงเวลาทวน (box 1-5)
function getDueWords() {
  const data  = loadSRS();
  const today = todayStr();
  return Object.values(data).filter(item => {
    if (item.box === 0) return true;
    if (item.box >= 1 && item.box <= 4)
      return item.nextReview && item.nextReview <= today;
    if (item.box === 5)
      return (item.nextReview && item.nextReview <= today) || item.borrowedFor === today;
    return false;
  });
}

function getTomorrowDueCount() {
  const data = loadSRS();
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const items = Object.values(data);

  // 1. Box 1-4 ที่ nextReview == tomorrow
  const box1to4Tomorrow = items.filter(item => {
    let box = (item.box === undefined || item.box === null) ? 0 : Number(item.box);
    return box >= 1 && box <= 4 && item.nextReview === tomorrow;
  }).length;

  // 2. Box 5 ของวันพรุ่งนี้ — Mirror Logic ของ processDailyBox5Queue() ทุกบรรทัด
  //    realDue = box5 ที่ nextReview <= tomorrow (เลยกำหนดแล้ว)
  const box5RealDueTomorrow = items.filter(item =>
    Number(item.box) === 5 && item.nextReview && item.nextReview <= tomorrow
  ).length;

  let box5TomorrowCount = 0;
  if (box5RealDueTomorrow >= BOX5_CHUNK_SIZE) {
    // มี due มากกว่า quota อยู่แล้ว ไม่ต้องยืมเพิ่ม
    box5TomorrowCount = box5RealDueTomorrow;
  } else {
    // candidates = box5 ที่ยังไม่ due พรุ่งนี้ และไม่มี borrowedFor === tomorrow
    // (Mirror เงื่อนไขของ Scheduler ครบถ้วน รวมถึง borrowedFor check)
    const candidatesTomorrow = items.filter(item =>
      Number(item.box) === 5 &&
      (!item.borrowedFor || item.borrowedFor !== tomorrow) &&
      (item.nextReview === null || item.nextReview === undefined || item.nextReview > tomorrow)
    ).length;
    const needed = BOX5_CHUNK_SIZE - box5RealDueTomorrow;
    box5TomorrowCount = box5RealDueTomorrow + Math.min(needed, candidatesTomorrow);
  }

  return box1to4Tomorrow + box5TomorrowCount;
}

function getDueChunk() {
  const data  = loadSRS();
  const today = todayStr();
  const all   = Object.values(data);
  const limit = getDueChunkSize();

  const due = all.filter(item =>
    (item.box >= 1 && item.box <= 4 && item.nextReview && item.nextReview <= today) ||
    (item.box === 5 && ((item.nextReview && item.nextReview <= today) || item.borrowedFor === today))
  );

  const newWords = all.filter(item => item.box === 0);

  // ① slice due ตาม limit (เรียงตาม nextReview เก่าสุดไปใหม่สุด ภายในกลุ่มวันเดียวกันสุ่มลำดับกันเอง)
  const dueGroups = {};
  due.forEach(item => {
    const key = item.nextReview || "unknown";
    if (!dueGroups[key]) dueGroups[key] = [];
    dueGroups[key].push(item);
  });
  const sortedDueKeys = Object.keys(dueGroups).sort((a, b) => a.localeCompare(b));
  const sortedDue = sortedDueKeys.flatMap(key => shuffleArray(dueGroups[key]));
  const dueChunk = sortedDue.slice(0, limit);

  // ② คำนวณโควตา Box0 จากช่องที่เหลือหลัง due และตรวจ Tomorrow Due
  const spaceLeft = limit - dueChunk.length;
  const tomorrowDue = getTomorrowDueCount();
  const allowedBox0 = spaceLeft > 0
    ? Math.max(0, Math.min(spaceLeft, TOMORROW_WARNING_THRESHOLD - tomorrowDue))
    : 0;

  // ③ combined ไม่เกิน limit แน่นอน
  return [
    ...dueChunk,
    ...shuffleArray(newWords).slice(0, allowedBox0),
  ];
}

function recordAnswer(word, correct) {
  const data  = loadSRS();
  const today = todayStr();
  const item  = data[word];
  if (!item) return;

  if (item.box === 5) {
    // กล่อง 5: ระบบทวนระยะยาว
    if (correct) {
      item.box        = 5;
      item.nextReview = addDays(today, BOX5_INTERVAL); // คงกล่อง 5, +30 วัน
    } else {
      item.box        = Math.max(1, item.box - 2);
      item.nextReview = addDays(today, 1);             // ถอยหลัง 2 กล่อง (ไม่ต่ำกว่า 1), พรุ่งนี้
      item.lapses     = (item.lapses || 0) + 1;
    }
    // เคลียร์ค่าที่ยืมมาทวนออกเสมอเมื่อตอบแล้ว
    if (item.borrowedFor) delete item.borrowedFor;
  } else {
    // กล่อง 0-4: SRS ปกติ
    if (correct) {
      item.box = Math.min(item.box + 1, 5);
      if (item.box === 5) {
        // เพิ่งเข้า box 5 (จาก box 4) → ใช้ interval 30 วัน
        item.nextReview = addDays(today, BOX5_INTERVAL);
      } else {
        item.nextReview = addDays(today, BOX_INTERVALS[item.box]);
      }
    } else {
      item.box        = Math.max(1, item.box - 2);
      item.nextReview = addDays(today, 1);
      item.lapses     = (item.lapses || 0) + 1;
    }
    // เคลียร์ borrowedFor เผื่อหลุดย้ายกล่อง
    if (item.borrowedFor) delete item.borrowedFor;
  }
  data[word] = item;
  saveSRS(data);
}

function getSRSStats() {
  const data  = loadSRS();
  const today = todayStr();
  const all   = Object.values(data);
  const total = all.length;
  const counts = [0,0,0,0,0,0];
  all.forEach(item => {
    let box = (item.box === undefined || item.box === null) ? 0 : Number(item.box);
    if (box >= 1) {
      counts[Math.min(box, 5)]++;
    }
  });
  const learned = all.filter(i => {
    let box = (i.box === undefined || i.box === null) ? 0 : Number(i.box);
    return box >= 1;
  }).length;
  const mastered = counts[5];
  const dueToday = all.filter(item => {
    let box = (item.box === undefined || item.box === null) ? 0 : Number(item.box);
    return (box >= 1 && box <= 4 && item.nextReview && item.nextReview <= today) ||
           (box === 5 && ((item.nextReview && item.nextReview <= today) || item.borrowedFor === today));
  }).length;
  const newLeft = Math.max(0, total - (counts[1] + counts[2] + counts[3] + counts[4] + counts[5]));

  return {
    total,
    learned,
    mastered,
    dueToday,
    newLeft
  };
}

// คำที่ตอบผิดสะสมเกิน threshold — คำยากที่ควรให้ผู้ใช้สนใจเป็นพิเศษ
function getLeechWords() {
  const data = loadSRS();
  return Object.values(data).filter(item => (item.lapses || 0) >= LEECH_THRESHOLD);
}