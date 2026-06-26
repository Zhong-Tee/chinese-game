/** คอลัมน์มาตรฐานสำหรับ export/import คำศัพท์ */
export const FLASHCARD_EXPORT_COLUMNS = [
  'id1',
  'cn',
  'pinyin',
  'vocabulary',
  'pinyin_vocab',
  'th',
  'sentence_test',
  'pinyin_sentence',
  'translate',
];

const COMPARE_FIELDS = [
  'cn',
  'pinyin',
  'vocabulary',
  'pinyin_vocab',
  'th',
  'sentence_test',
  'pinyin_sentence',
  'translate',
];

function normCell(value) {
  if (value == null) return '';
  return String(value).trim();
}

function escapeCsvCell(value) {
  const text = normCell(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** แปลงข้อความ CSV เป็นแถว object (รองรับฟิลด์มี comma ใน quotes) */
export function parseFlashcardCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      if (ch === '\r') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);

  if (rows.length === 0) {
    return { headers: [], records: [], errors: ['ไฟล์ว่างเปล่า'] };
  }

  const headers = rows[0].map((h) => normCell(h).toLowerCase());
  const records = [];
  const errors = [];

  for (let r = 1; r < rows.length; r += 1) {
    const values = rows[r];
    const record = {};
    headers.forEach((header, idx) => {
      if (header) record[header] = values[idx] ?? '';
    });
    records.push(record);
  }

  return { headers, records, errors };
}

export function normalizeFlashcardImportRow(record) {
  const row = {};
  FLASHCARD_EXPORT_COLUMNS.forEach((field) => {
    row[field] = normCell(record[field]);
  });
  row.id1 = Number(row.id1);
  return row;
}

export function flashcardRowChanged(existing, incoming) {
  return COMPARE_FIELDS.some((field) => normCell(existing?.[field]) !== normCell(incoming?.[field]));
}

export function flashcardsToCsv(rows) {
  const headerLine = FLASHCARD_EXPORT_COLUMNS.join(',');
  const dataLines = (rows || []).map((row) =>
    FLASHCARD_EXPORT_COLUMNS.map((col) => escapeCsvCell(row?.[col])).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

export async function fetchAllFlashcardsForExport(supabase) {
  const { data, error } = await supabase
    .from('flashcards')
    .select(FLASHCARD_EXPORT_COLUMNS.join(', '))
    .order('id1', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function downloadFlashcardCsv(rows, filename = 'flashcards_export.csv') {
  const csv = flashcardsToCsv(rows);
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * นำเข้าคำศัพท์จาก CSV
 * - คำใหม่ (id1 ไม่มีใน DB) → insert
 * - ข้อมูลเหมือนเดิม → ข้าม
 * - ข้อมูลเปลี่ยน → update
 * @param {Function} [onProgress] ({ phase, label, processed, total, percent, inserted, updated, unchanged, ts })
 */
export async function importFlashcardsFromRecords(supabase, records, onProgress) {
  const result = {
    totalRows: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
  };

  const emit = (partial) => {
    onProgress?.({
      phase: 'loading',
      label: 'กำลังโหลดข้อมูลเดิม...',
      processed: 0,
      total: records.length,
      percent: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      ts: Date.now(),
      ...partial,
    });
  };

  emit({ phase: 'loading', label: 'กำลังโหลดข้อมูลเดิมจากระบบ...', percent: 5 });

  const { data: existingRows, error: fetchError } = await supabase
    .from('flashcards')
    .select(`id1, ${COMPARE_FIELDS.join(', ')}`);

  if (fetchError) {
    result.errors.push(`โหลดข้อมูลเดิมล้มเหลว: ${fetchError.message}`);
    emit({ phase: 'done', label: 'Import ล้มเหลว', percent: 100, ...result });
    return result;
  }

  const existingById = new Map((existingRows || []).map((row) => [Number(row.id1), row]));
  const seenIds = new Set();
  const toInsert = [];
  const toUpdate = [];

  emit({
    phase: 'analyzing',
    label: 'กำลังตรวจสอบแถวในไฟล์...',
    processed: 0,
    total: records.length,
    percent: 10,
  });

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const lineNo = index + 2;
    const row = normalizeFlashcardImportRow(record);
    result.totalRows += 1;

    if (!Number.isFinite(row.id1) || row.id1 <= 0) {
      result.errors.push(`แถว ${lineNo}: id1 ไม่ถูกต้อง`);
    } else if (seenIds.has(row.id1)) {
      result.errors.push(`แถว ${lineNo}: id1 ซ้ำในไฟล์ (${row.id1})`);
    } else {
      seenIds.add(row.id1);

      if (!row.cn) {
        result.errors.push(`แถว ${lineNo}: ต้องมี cn`);
      } else {
        const payload = {};
        COMPARE_FIELDS.forEach((field) => {
          payload[field] = row[field] || null;
        });

        const existing = existingById.get(row.id1);
        if (!existing) {
          toInsert.push({ id1: row.id1, ...payload });
        } else if (flashcardRowChanged(existing, payload)) {
          toUpdate.push({ id1: row.id1, ...payload });
        } else {
          result.unchanged += 1;
        }
      }
    }

    const processed = index + 1;
    if (processed % 25 === 0 || processed === records.length) {
      emit({
        phase: 'analyzing',
        label: 'กำลังตรวจสอบแถวในไฟล์...',
        processed,
        total: records.length,
        percent: 10 + Math.round((processed / records.length) * 25),
        unchanged: result.unchanged,
      });
      // ให้ UI อัปเดตระหว่างวิเคราะห์ไฟล์ใหญ่
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const uploadTotal = toInsert.length + toUpdate.length;
  let uploaded = 0;

  if (uploadTotal === 0) {
    emit({
      phase: 'done',
      label: 'เสร็จแล้ว — ไม่มีแถวที่ต้องอัปโหลด',
      processed: records.length,
      total: records.length,
      percent: 100,
      inserted: result.inserted,
      updated: result.updated,
      unchanged: result.unchanged,
    });
    return result;
  }

  const reportUpload = (label) => {
    emit({
      phase: uploaded < toInsert.length ? 'inserting' : 'updating',
      label,
      processed: uploaded,
      total: uploadTotal,
      percent: 35 + Math.round((uploaded / uploadTotal) * 65),
      inserted: result.inserted,
      updated: result.updated,
      unchanged: result.unchanged,
    });
  };

  const INSERT_BATCH = 100;
  for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
    const batch = toInsert.slice(i, i + INSERT_BATCH);
    reportUpload(`กำลังเพิ่มคำใหม่... (${uploaded}/${uploadTotal})`);
    const { error } = await supabase.from('flashcards').insert(batch);
    if (error) {
      batch.forEach((row) => result.errors.push(`เพิ่ม id1 ${row.id1} ล้มเหลว: ${error.message}`));
    } else {
      result.inserted += batch.length;
    }
    uploaded += batch.length;
    reportUpload(`เพิ่มคำใหม่แล้ว ${uploaded}/${uploadTotal} แถว`);
  }

  for (let i = 0; i < toUpdate.length; i += 1) {
    const row = toUpdate[i];
    if (i === 0 || i % 5 === 0 || i === toUpdate.length - 1) {
      reportUpload(`กำลังอัปเดตคำที่เปลี่ยน... (${uploaded}/${uploadTotal})`);
    }
    const { id1, ...payload } = row;
    const { error } = await supabase.from('flashcards').update(payload).eq('id1', id1);
    if (error) {
      result.errors.push(`อัปเดต id1 ${id1} ล้มเหลว: ${error.message}`);
    } else {
      result.updated += 1;
    }
    uploaded += 1;
  }

  emit({
    phase: 'done',
    label: 'Import เสร็จแล้ว',
    processed: uploadTotal,
    total: uploadTotal,
    percent: 100,
    inserted: result.inserted,
    updated: result.updated,
    unchanged: result.unchanged,
  });

  return result;
}
