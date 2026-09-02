import { createHash } from 'node:crypto'

export const TTS_NORMALIZER_VERSION = '1.2.0'

export type TtsWarning = { code: string; message: string; start: number; end: number }
export type TtsTrace = {
  start: number
  end: number
  original: string
  normalized: string
  category: 'YEAR' | 'DATE' | 'DOCUMENT_ID' | 'NUMBER' | 'PERCENT' | 'RANGE' | 'LEGAL_ACRONYM' | 'DICTIONARY'
  ruleId: string
  confidence: number
}
export type TtsNormalizationResult = {
  sourceText: string
  displayText: string
  ttsText: string
  traces: TtsTrace[]
  warnings: TtsWarning[]
  requiresReview: boolean
  normalizerVersion: string
  sourceTextHash: string
}

type Candidate = TtsTrace
export type PronunciationDictionaryRule = { id: string; sourceText: string; spokenText: string }

const digitWords = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const scaleWords = ['', 'nghìn', 'triệu', 'tỷ']

function spokenDigit(value: string): string { return value.split('').map((digit) => digitWords[Number(digit)]).join(' ') }

// Đọc năm 4 chữ số theo chuỗi chữ số, RIÊNG chữ số cuối dùng biến thể: 4→"tư",
// 5→"lăm" (VOICE_OFF_TTS_RULES §9): 2025→"hai không hai lăm", 1994→"một chín chín tư".
const YEAR_FINAL: Record<string, string> = { '4': 'tư', '5': 'lăm' }
function speakYear(value: string): string {
  if (!/^\d{4}$/.test(value)) return spokenDigit(value)
  return value
    .split('')
    .map((digit, index) => (index === 3 && YEAR_FINAL[digit]) || digitWords[Number(digit)])
    .join(' ')
}

function readBelowThousand(value: number, forceHundreds = false): string {
  const hundreds = Math.floor(value / 100)
  const tens = Math.floor((value % 100) / 10)
  const ones = value % 10
  const parts: string[] = []
  if (hundreds || forceHundreds) parts.push(`${digitWords[hundreds]} trăm`)
  if (tens === 0 && ones > 0 && (hundreds || forceHundreds)) parts.push('lẻ')
  if (tens === 1) parts.push('mười')
  else if (tens > 1) parts.push(`${digitWords[tens]} mươi`)
  if (ones > 0) {
    if (tens > 1 && ones === 1) parts.push('mốt')
    else if (tens > 0 && ones === 5) parts.push('lăm')
    else parts.push(digitWords[ones])
  }
  return parts.join(' ')
}

/** Đọc số lượng nguyên dương trong phạm vi đủ cho narration thông thường. */
export function readVietnameseInteger(raw: string): string | null {
  const normalized = raw.replace(/\./g, '')
  if (!/^\d{1,12}$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isSafeInteger(value)) return null
  if (value === 0) return 'không'
  const groups: number[] = []
  for (let cursor = normalized; cursor.length; cursor = cursor.slice(0, -3)) groups.unshift(Number(cursor.slice(-3)))
  if (groups.length > scaleWords.length) return null
  const parts: string[] = []
  groups.forEach((group, index) => {
    if (group === 0) return
    const laterGroupExists = groups.slice(index + 1).some(Boolean)
    parts.push(readBelowThousand(group, index > 0 && group < 100 && laterGroupExists))
    const scale = scaleWords[groups.length - index - 1]
    if (scale) parts.push(scale)
  })
  return parts.join(' ')
}

// Số thập phân: CẢ phần nguyên và phần lẻ đọc theo chuỗi chữ số (VOICE_OFF_TTS_RULES
// §11.1): "23,7"→"hai ba phẩy bảy", "12,05"→"một hai phẩy không năm".
function readVietnameseDecimal(raw: string): string | null {
  const [integer, fraction] = raw.split(',')
  if (!integer || !/^\d{1,10}$/.test(integer) || !fraction || !/^\d{1,8}$/.test(fraction)) return null
  return `${spokenDigit(integer)} phẩy ${spokenDigit(fraction)}`
}

// Tháng đọc theo số đếm, RIÊNG tháng 4 = "tư" (VOICE_OFF_TTS_RULES §12.4).
function speakMonth(month: number): string {
  return month === 4 ? 'tư' : (readVietnameseInteger(String(month)) ?? String(month))
}

function isValidDate(day: number, month: number, year: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function readDate(day: number, month: number, year: string): string {
  const dayText = day < 10 ? `mùng ${readVietnameseInteger(String(day))}` : readVietnameseInteger(String(day))
  return `${dayText} tháng ${speakMonth(month)} năm ${speakYear(year)}`
}

function overlap(left: Candidate, right: Candidate): boolean { return left.start < right.end && right.start < left.end }

function collectWarnings(source: string, occupied: Candidate[]): TtsWarning[] {
  const warnings: TtsWarning[] = []
  const add = (code: string, message: string, start: number, end: number) => {
    if (!occupied.some((candidate) => candidate.start <= start && end <= candidate.end) && !warnings.some((warning) => warning.start === start && warning.end === end && warning.code === code)) warnings.push({ code, message, start, end })
  }
  for (const match of source.matchAll(/\b\d{4}\b/g)) add('AMBIGUOUS_FOUR_DIGIT_NUMBER', 'Chuỗi bốn chữ số chưa có ngữ cảnh năm hoặc mã văn bản; cần người duyệt xác nhận cách đọc.', match.index!, match.index! + match[0].length)
  for (const match of source.matchAll(/\b[A-Z]{2,}\b/g)) {
    if (!['MISA', 'AI'].includes(match[0])) add('UNKNOWN_ACRONYM', `Từ viết tắt “${match[0]}” chưa có từ điển cách đọc được duyệt.`, match.index!, match.index! + match[0].length)
  }
  for (const match of source.matchAll(/\b\d{1,2}\/\d{4}\b/g)) add('AMBIGUOUS_SLASH_NUMBER', 'Dạng số/tháng-năm chưa có ngữ cảnh; cần người duyệt xác nhận.', match.index!, match.index! + match[0].length)
  return warnings.sort((a, b) => a.start - b.start || a.code.localeCompare(b.code))
}

function candidate(start: number, original: string, normalized: string, category: Candidate['category'], ruleId: string): Candidate {
  return { start, end: start + original.length, original, normalized, category, ruleId, confidence: 1 }
}

function isWordCharacter(value: string | undefined): boolean {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value))
}

function addDictionaryCandidates(source: string, rules: PronunciationDictionaryRule[], add: (item: Candidate) => void): void {
  const comparableSource = source.toLocaleLowerCase('vi-VN')
  for (const rule of rules) {
    const original = rule.sourceText.normalize('NFC').trim()
    const spoken = rule.spokenText.normalize('NFC').trim()
    const needle = original.toLocaleLowerCase('vi-VN')
    if (!needle || !spoken) continue
    let cursor = 0
    while (cursor < comparableSource.length) {
      const start = comparableSource.indexOf(needle, cursor)
      if (start < 0) break
      const end = start + original.length
      const startsInsideWord = isWordCharacter(original[0]) && isWordCharacter(source[start - 1])
      const endsInsideWord = isWordCharacter(original.at(-1)) && isWordCharacter(source[end])
      if (!startsInsideWord && !endsInsideWord) add(candidate(start, source.slice(start, end), spoken, 'DICTIONARY', `DICTIONARY_${rule.id}`))
      cursor = start + Math.max(1, needle.length)
    }
  }
}

/**
 * Chuẩn hóa không gọi LLM. Khi chưa chắc chắn, giữ nguyên text và gắn warning
 * để workflow strict chặn bước gửi Gemini TTS ở phase tiếp theo.
 */
export function normalizeVietnameseVoiceOver(sourceText: string, dictionaryRules: PronunciationDictionaryRule[] = []): TtsNormalizationResult {
  const source = sourceText.normalize('NFC')
  const candidates: Candidate[] = []
  const add = (item: Candidate) => candidates.push(item)

  addDictionaryCandidates(source, dictionaryRules, add)

  for (const match of source.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    const [day, month, year] = match.slice(1)
    const start = match.index!
    if (isValidDate(Number(day), Number(month), Number(year))) add(candidate(start, match[0], readDate(Number(day), Number(month), year), 'DATE', 'DATE_DDMMYYYY_001'))
  }
  for (const match of source.matchAll(/\btháng\s+(\d{1,2})\/(\d{4})\b/gi)) {
    const month = Number(match[1])
    if (month >= 1 && month <= 12) add(candidate(match.index!, match[0], `tháng ${speakMonth(month)} năm ${speakYear(match[2])}`, 'DATE', 'MONTH_YEAR_001'))
  }
  for (const match of source.matchAll(/\b(\d{1,3})\/(\d{4})\/(NĐ-CP)\b/g)) {
    const spoken = readVietnameseInteger(match[1])
    if (spoken) add(candidate(match.index!, match[0], `${spoken} ${speakYear(match[2])} nờ đê xê pê`, 'DOCUMENT_ID', 'DOCUMENT_ID_VI_001'))
  }
  for (const match of source.matchAll(/\bnăm\s+(\d{4})\b/gi)) add(candidate(match.index!, match[0], `năm ${speakYear(match[1])}`, 'YEAR', 'YEAR_CONTEXT_001'))
  // Khoảng năm "2024-2026" / "giai đoạn 1994–2026": mỗi vế đọc theo quy tắc NĂM,
  // dấu gạch = "đến". Ưu tiên trước quy tắc khoảng số chung (để khỏi đọc thành số lượng).
  for (const match of source.matchAll(/\b(\d{4})\s*[-–—]\s*(\d{4})\b/g)) {
    add(candidate(match.index!, match[0], `${speakYear(match[1])} đến ${speakYear(match[2])}`, 'RANGE', 'YEAR_RANGE_001'))
  }
  // Năm độc lập có ngữ cảnh mốc thời gian (ngoài "năm" đã xử lý ở trên)
  for (const match of source.matchAll(/\b(giai đoạn|niên độ)\s+(\d{4})\b/gi)) {
    add(candidate(match.index! + match[0].length - match[2].length, match[2], speakYear(match[2]), 'YEAR', 'YEAR_CONTEXT_002'))
  }
  for (const match of source.matchAll(/\b(\d{3,4})\/(\d{4})\b/g)) add(candidate(match.index!, match[0], `${spokenDigit(match[1])} ${speakYear(match[2])}`, 'DOCUMENT_ID', 'DOCUMENT_ID_SHORT_001'))
  for (const match of source.matchAll(/\bNĐ-CP\b/g)) add(candidate(match.index!, match[0], 'nờ đê xê pê', 'LEGAL_ACRONYM', 'LEGAL_ACRONYM_NDCP_001'))
  for (const match of source.matchAll(/([+\-−])(\d+(?:,\d+)?)%/g)) {
    const number = match[2].includes(',') ? readVietnameseDecimal(match[2]) : readVietnameseInteger(match[2])
    if (number) add(candidate(match.index!, match[0], `${match[1] === '+' ? 'tăng' : 'giảm'} ${number} phần trăm`, 'PERCENT', 'SIGN_PERCENT_001'))
  }
  // Dấu bullet có khoảng trắng ("- 20%") không phải dấu giảm. Chỉ đọc đơn vị,
  // giữ nguyên bullet để nhịp danh sách không bị thay đổi nghĩa.
  for (const match of source.matchAll(/\b(\d+(?:,\d+)?)%/g)) {
    const number = match[1].includes(',') ? readVietnameseDecimal(match[1]) : readVietnameseInteger(match[1])
    if (number) add(candidate(match.index!, match[0], `${number} phần trăm`, 'PERCENT', 'PERCENT_001'))
  }
  for (const match of source.matchAll(/\b(\d+)\s*[-–]\s*(\d+)\b/g)) {
    // Cặp 4-4 chữ số là khoảng NĂM → để YEAR_RANGE_001 xử lý (đọc theo chữ số năm)
    if (match[1].length === 4 && match[2].length === 4) continue
    const from = readVietnameseInteger(match[1]); const to = readVietnameseInteger(match[2])
    if (from && to) add(candidate(match.index!, match[0], `${from} đến ${to}`, 'RANGE', 'NUMBER_RANGE_001'))
  }
  for (const match of source.matchAll(/\b(?:\d{1,3}(?:\.\d{3})+|\d+,\d+)\b/g)) {
    const spoken = match[0].includes(',') ? readVietnameseDecimal(match[0]) : readVietnameseInteger(match[0])
    if (spoken) add(candidate(match.index!, match[0], spoken, 'NUMBER', match[0].includes(',') ? 'DECIMAL_COMMA_001' : 'THOUSANDS_NUMBER_001'))
  }
  for (const match of source.matchAll(/\b\d+\b/g)) {
    // Bốn chữ số không có ngữ cảnh là năm/mã/giá trị: giữ nguyên và yêu cầu review.
    // Các case năm/mã rõ ràng đã có candidate ưu tiên ở phía trên.
    if (match[0].length === 4) continue
    const spoken = readVietnameseInteger(match[0])
    if (spoken) add(candidate(match.index!, match[0], spoken, 'NUMBER', 'INTEGER_001'))
  }

  const selected: Candidate[] = []
  for (const item of candidates.sort((a, b) => a.start - b.start || b.end - b.start || a.ruleId.localeCompare(b.ruleId))) {
    if (!selected.some((existing) => overlap(existing, item))) selected.push(item)
  }
  selected.sort((a, b) => a.start - b.start)
  const warnings = collectWarnings(source, selected)
  let cursor = 0
  const ttsText = selected.map((item) => {
    const prefix = source.slice(cursor, item.start); cursor = item.end
    return `${prefix}${item.normalized}`
  }).join('') + source.slice(cursor)
  return {
    sourceText: source,
    displayText: source,
    ttsText,
    traces: selected,
    warnings,
    requiresReview: warnings.length > 0,
    normalizerVersion: TTS_NORMALIZER_VERSION,
    sourceTextHash: createHash('sha256').update(source).digest('hex'),
  }
}
