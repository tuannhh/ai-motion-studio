import { createHash } from 'node:crypto'

// Nguồn quy ước: VOICE_OFF_TTS_RULES.md phiên bản 2026.09.09-r5 (mục 23.1 bổ
// sung bộ approved pronunciation nội bộ, thêm TCT/QHĐT/ĐHCĐ + "TB" phân loại
// theo ngữ cảnh; §9.2 bổ sung mẫu năm rút gọn; §11A bổ sung đọc số theo ngữ
// cảnh: giờ, tỷ lệ/phân số, tiền tệ, số định danh, số thứ tự; §23.2 (MỚI ở r5)
// bổ sung Named-Entity Pronunciation Dictionary cho tên tổ chức/liên minh/hiệp
// hội/ứng dụng viết tắt — mỗi entity có 1 cách đọc "primary" cố định, không
// suy diễn tự động từ chính tả). Sửa thêm 3 lỗi có sẵn từ r4 lộ ra khi verify
// đúng ví dụ trong §9.4/§10.3: (a) YEAR_CONTEXT_001 hard-code chữ thường "năm"
// đè lên hoa/thường gốc; (b) số lượng 4 chữ số không có "năm" đứng trước (vd
// "mục tiêu 2026 khách hàng") bị bỏ qua hoàn toàn thay vì đọc theo số đếm;
// (c) readVietnameseInteger thiếu đệm "không trăm" khi nhóm 3-chữ-số <100 là
// nhóm CUỐI cùng (vd "1.001"→sai "một nghìn một", đúng phải "một nghìn không
// trăm linh một").
export const TTS_NORMALIZER_VERSION = '1.5.1'

export type TtsWarning = { code: string; message: string; start: number; end: number }
export type TtsTrace = {
  start: number
  end: number
  original: string
  normalized: string
  category:
    | 'YEAR' | 'DATE' | 'DOCUMENT_ID' | 'NUMBER' | 'PERCENT' | 'RANGE' | 'LEGAL_ACRONYM' | 'DICTIONARY'
    | 'TIME' | 'RATIO' | 'FRACTION' | 'CURRENCY' | 'IDENTIFIER' | 'ORDINAL' | 'APPROVED_PRONUNCIATION' | 'NAMED_ENTITY_PRONUNCIATION' | 'PROTECTED' | 'BULLET'
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

// Đọc năm 4 chữ số. Mặc định theo chuỗi chữ số, chữ số cuối dùng biến thể
// 4→"tư", 5→"lăm" (VOICE_OFF_TTS_RULES §9.1: 2025→"hai không hai lăm").
// Mẫu rút gọn §9.2: hai chữ số cuối trong khoảng 01-09 (không áp dụng từ 10 trở lên).
//   - 200x (2001-2009): "hai lẻ " + chữ số cuối (chỉ 4 đổi thành "tư", còn lại đọc thường).
//   - Các thế kỷ khác (vd 19xy): 2 chữ số đầu tách rời + "linh" + chữ số cuối.
const YEAR_FINAL: Record<string, string> = { '4': 'tư', '5': 'lăm' }
const YEAR_SHORT_FINAL: Record<string, string> = { '4': 'tư' }
function speakYear(value: string): string {
  if (!/^\d{4}$/.test(value)) return spokenDigit(value)
  const [d0, d1, d2, d3] = value.split('')
  if (d2 === '0' && d3 !== '0') {
    const last = YEAR_SHORT_FINAL[d3] ?? digitWords[Number(d3)]
    if (value.startsWith('20')) return `hai lẻ ${last}`
    return `${digitWords[Number(d0)]} ${digitWords[Number(d1)]} linh ${last}`
  }
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
    else if (tens > 1 && ones === 4) parts.push('tư')
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
    // Nhóm không phải nhóm đầu (index>0) luôn có ít nhất 1 nhóm bậc cao hơn 0
    // đứng trước (group[0] luôn >0 với số nguyên hợp lệ không có 0 dẫn đầu) —
    // nên PHẢI đệm "không trăm" khi nhóm này <100, kể cả khi đây là nhóm CUỐI
    // cùng (VOICE_OFF_TTS_RULES §10.3: "1.001"→"một nghìn không trăm linh một",
    // "1.000.005"→"một triệu không trăm linh năm" — trước đây chỉ đệm khi còn
    // nhóm khác #0 phía SAU nên bỏ sót đúng 2 ví dụ này).
    parts.push(readBelowThousand(group, index > 0 && group < 100))
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

// Giờ: đủ giờ tròn bỏ "0 phút" (VOICE_OFF_TTS_RULES §11A.4: "8h00"→"tám giờ");
// AM/PM là guard bắt buộc — chỉ parser thời gian được đọc "AM/PM" theo giờ,
// KHÔNG áp dụng mapping approved-pronunciation nội bộ (vd "AM"→"A em") lên đây.
function speakTime(hour: number, minute: number): string {
  const hourWord = readVietnameseInteger(String(hour)) ?? String(hour)
  if (minute === 0) return `${hourWord} giờ`
  const minuteWord = readVietnameseInteger(String(minute)) ?? String(minute)
  return `${hourWord} giờ ${minuteWord} phút`
}

// Số thứ tự (VOICE_OFF_TTS_RULES §11A.6): "thứ 1"→"thứ nhất", "thứ 4"→"thứ tư"
// (khác cách đọc số lượng thường của 4 là "bốn"), còn lại đọc theo số đếm.
function speakOrdinal(n: number): string {
  if (n === 1) return 'nhất'
  if (n === 4) return 'tư'
  return readVietnameseInteger(String(n)) ?? String(n)
}

// Đơn vị đếm dùng làm tín hiệu QUANTITY cho số 4 chữ số độc lập — xem chỗ dùng
// ở QUANTITY_FOUR_DIGIT_001 bên dưới.
const QUANTITY_UNIT_NOUNS = [
  'khách hàng', 'người dùng', 'người', 'nhân viên', 'nhân sự', 'doanh nghiệp',
  'công ty', 'sản phẩm', 'đơn hàng', 'hồ sơ', 'giao dịch', 'lượt', 'đồng',
  'tỷ đồng', 'triệu đồng', 'nghìn đồng', 'vụ', 'cửa hàng', 'chi nhánh', 'phòng ban',
  'dự án', 'sự kiện', 'video', 'lần', 'cuộc', 'hộ gia đình', 'học sinh', 'sinh viên',
  'giáo viên', 'bệnh nhân', 'chuyến', 'đại lý', 'tổ chức', 'quốc gia', 'tỉnh thành',
]

function overlap(left: Candidate, right: Candidate): boolean { return left.start < right.end && right.start < left.end }

function collectWarnings(source: string, occupied: Candidate[]): TtsWarning[] {
  const warnings: TtsWarning[] = []
  const add = (code: string, message: string, start: number, end: number) => {
    if (!occupied.some((candidate) => candidate.start <= start && end <= candidate.end) && !warnings.some((warning) => warning.start === start && warning.end === end && warning.code === code)) warnings.push({ code, message, start, end })
  }
  for (const match of source.matchAll(/\b\d{4}\b/g)) add('AMBIGUOUS_FOUR_DIGIT_NUMBER', 'Chuỗi bốn chữ số chưa có ngữ cảnh năm hoặc mã văn bản; cần người duyệt xác nhận cách đọc.', match.index!, match.index! + match[0].length)
  for (const match of source.matchAll(/\b[A-Z]{2,}\b/g)) {
    if (!['MISA', 'AI', 'CEO', 'KPI', 'API', 'CRM', 'ERP', 'SAAS', 'TB'].includes(match[0])) add('UNKNOWN_ACRONYM', `Từ viết tắt "${match[0]}" chưa có từ điển cách đọc được duyệt.`, match.index!, match.index! + match[0].length)
  }
  // "TB" không đủ ngữ cảnh để phân loại "Trưởng ban" hay "trung bình" (đã không
  // được addTbContextCandidates nhận — occupied sẽ tự loại các occurrence đã rõ
  // nghĩa) — VOICE_OFF_TTS_RULES §23.1.1 mục 11.
  for (const match of source.matchAll(/\bTB\b/g)) add('AMBIGUOUS_TB_MEANING', '"TB" chưa xác định được là "Trưởng ban" hay "trung bình"; cần người duyệt xác nhận.', match.index!, match.index! + 2)
  for (const match of source.matchAll(/\b\d{1,2}\/\d{4}\b/g)) add('AMBIGUOUS_SLASH_NUMBER', 'Dạng số/tháng-năm chưa có ngữ cảnh; cần người duyệt xác nhận.', match.index!, match.index! + match[0].length)
  // Chuỗi số có 0 đứng đầu (SĐT/mã) chưa có từ khóa ngữ cảnh (SĐT, hotline, mã số
  // thuế...) đứng trước — KHÔNG được tự đoán là số lượng (VOICE_OFF_TTS_RULES §11A.2).
  for (const match of source.matchAll(/\b0\d{4,}\b/g)) add('AMBIGUOUS_IDENTIFIER_NUMBER', 'Chuỗi số có số 0 đứng đầu chưa có ngữ cảnh xác nhận là số điện thoại/mã định danh; cần người duyệt xác nhận cách đọc.', match.index!, match.index! + match[0].length)
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

// Bộ quy ước từ viết tắt/cách đọc nội bộ đã được phê duyệt (VOICE_OFF_TTS_RULES
// §23.1) — bắt buộc, không được tự đổi cách đọc khác. Alias (DNG/ĐNG, HĐĐT/HDDT)
// khai báo riêng từng key, trỏ cùng spoken text.
const APPROVED_PRONUNCIATIONS: Record<string, string> = {
  GPBL: 'Giải pháp bán lẻ',
  HCSN: 'Hành chính sự nghiệp',
  TTKD: 'Trung tâm kinh doanh',
  DNV: 'Doanh nghiệp vừa',
  DNN: 'Doanh nghiệp nhỏ',
  DATW: 'Dự án trung ương',
  GĐK: 'Giám đốc khối',
  CBN: 'Cán bộ nguồn',
  HAN: 'Hà Nội',
  CTH: 'Cần Thơ',
  DNG: 'Đà Nẵng',
  ĐNG: 'Đà Nẵng',
  BMT: 'Buôn Ma Thuột',
  HCM: 'Hồ Chí Minh',
  VP: 'Văn phòng',
  GĐVP: 'Giám đốc Văn phòng',
  GĐ: 'Giám đốc',
  BGĐ: 'Ban Giám đốc',
  TGĐ: 'Tổng Giám đốc',
  BTGĐ: 'Ban Tổng Giám đốc',
  HĐQT: 'Hội đồng quản trị',
  CT: 'Chủ tịch',
  PCT: 'Phó Chủ tịch',
  PGĐ: 'Phó Giám đốc',
  CVP: 'Chánh văn phòng',
  SM: 'Ét em',
  AM: 'A em',
  EMIS: 'E mít',
  AMIS: 'A mít',
  iGOV: 'ai gốp',
  iHOS: 'ai hót',
  Fingov: 'Phin góp',
  GP: 'Giải pháp',
  HĐĐT: 'Hóa đơn điện tử',
  HDDT: 'Hóa đơn điện tử',
  MIBI: 'Mi Bi',
  TCT: 'Tổng Công ty',
  KSX: 'Khối sản xuất',
  QHĐT: 'Quan hệ đối tác',
  ĐHCĐ: 'Đại hội cổ đông',
  DN: 'Doanh nghiệp',
  TLHT: 'Tỷ lệ hoàn thành',
  HTKH: 'Hoàn thành kế hoạch',
  KTDN: 'Kế toán doanh nghiệp',
  KHDS: 'Kế hoạch doanh số',
  CBNV: 'Cán bộ nhân viên',
  BLĐ: 'Ban lãnh đạo',
  VNR: 'Vi en Rì sọt',
  Jetpay: 'Dét Pây',
  'MISA Corp': 'Tập đoàn MISA',
  'MISA JSC': 'Công ty Cổ phần MISA',
  CTCP: 'Công ty Cổ phần',
  TNHH: 'Trách nhiệm hữu hạn',
  'TNHH MTV': 'Trách nhiệm hữu hạn một thành viên',
  eShop: 'I Sóp',
  MShopkeeper: 'Em Sóp Kíp pờ',
  Moneykeeper: 'Mắn ni kíp pờ',
  '&': 'Và',
}

// Key ngắn 2 ký tự dễ trùng với mã/số văn bản (VOICE_OFF_TTS_RULES §23.1.1 mục
// 10) — nếu đứng sát một số/dấu "/" (vd "CT 12/2026") thì KHÔNG mở rộng, giữ
// nguyên để tránh đọc sai "Chủ tịch" trong khi đó là tiền tố mã văn bản.
const SHORT_AMBIGUOUS_KEYS = new Set(['CT', 'DN', 'VP', 'GP', 'AM', 'SM'])

function addApprovedPronunciationCandidates(source: string, add: (item: Candidate) => void): void {
  for (const [key, spoken] of Object.entries(APPROVED_PRONUNCIATIONS)) {
    let cursor = 0
    while (cursor <= source.length) {
      const start = source.indexOf(key, cursor)
      if (start < 0) break
      const end = start + key.length
      cursor = start + Math.max(1, key.length)
      const startsInsideWord = isWordCharacter(key[0]) && isWordCharacter(source[start - 1])
      const endsInsideWord = isWordCharacter(key.at(-1)) && isWordCharacter(source[end])
      if (startsInsideWord || endsInsideWord) continue
      if (SHORT_AMBIGUOUS_KEYS.has(key)) {
        const after = source.slice(end).match(/^\s{0,2}(\S)/)
        const before = source.slice(0, start).match(/(\S)\s{0,2}$/)
        if ((after && /[\d/]/.test(after[1])) || (before && /[\d/]/.test(before[1]))) continue
      }
      add(candidate(start, source.slice(start, end), spoken, 'APPROVED_PRONUNCIATION', `APPROVED_PRONUNCIATION_${key}`))
    }
  }
}

// "TB" là contextual abbreviation (VOICE_OFF_TTS_RULES §23.1.1 mục 11) — KHÔNG
// được cấu hình như một replacement tĩnh trong APPROVED_PRONUNCIATIONS vì mang 2
// nghĩa khác nhau tùy occurrence: "Trưởng ban" (đứng trước tên ban/chức năng,
// vd "TB Pháp chế") hay "trung bình" (đứng trước số/%/tiền, vd "TB 300%"). Mỗi
// lần xuất hiện phải phân loại riêng — không cache nghĩa cho cả câu/đoạn. Nếu
// không đủ căn cứ thì giữ nguyên "TB" và để collectWarnings gắn cảnh báo.
function addTbContextCandidates(source: string, add: (item: Candidate) => void): void {
  for (const match of source.matchAll(/\bTB\b/g)) {
    const start = match.index!
    const end = start + 2
    if (isWordCharacter(source[start - 1]) || isWordCharacter(source[end])) continue
    const next = source.slice(end).match(/^\s*(\S)/)
    if (next && /[\p{N}%₫đ]/u.test(next[1])) {
      add(candidate(start, 'TB', 'trung bình', 'APPROVED_PRONUNCIATION', 'APPROVED_TB_AVERAGE_001'))
    } else if (next && /\p{Lu}/u.test(next[1])) {
      add(candidate(start, 'TB', 'Trưởng ban', 'APPROVED_PRONUNCIATION', 'APPROVED_TB_ORG_TITLE_001'))
    }
    // Không đủ căn cứ (theo sau là chữ thường, dấu câu hoặc hết câu): giữ nguyên
    // "TB", không add candidate — collectWarnings sẽ gắn AMBIGUOUS_TB_MEANING.
  }
}

// Named-Entity Pronunciation Dictionary (VOICE_OFF_TTS_RULES §23.2.5) — tên
// viết tắt của tổ chức/liên minh/hiệp hội/ứng dụng KHÔNG có quy tắc phát âm
// chung (không phải cứ ALL CAPS là đọc từng chữ, không phải cứ có nguyên âm
// là đọc thành từ). Mỗi entity dưới đây đã có cách đọc "primary" được duyệt
// sẵn (bỏ qua các "alternative" trong tài liệu vì hệ thống không random giữa
// 2 cách đọc hợp lệ — luôn dùng đúng 1 primary xác định). `VneID` là alias
// case-khác của `VNeID`, cùng trỏ 1 cách đọc.
const NAMED_ENTITY_PRONUNCIATIONS: Record<string, string> = {
  CYSEEX: 'sai xích',
  VINASA: 'vi na sa',
  FIFA: 'phi pha',
  VAA: 'vê a a',
  VAPAC: 'va pắc',
  VCCA: 'vi xi xi ây',
  NDA: 'en đi ây',
  VTCA: 'vi ti xi ây',
  viNen: 'vi nen',
  VNABC: 'vi en ây bi xi',
  VinaSME: 'vi na ét em i',
  NCA: 'en xi ây',
  HanoiBA: 'Hà Nội bi ây',
  VNeID: 'vi en i ai đi',
  VneID: 'vi en i ai đi',
}

// Cùng cơ chế boundary-safe + case-sensitive như addApprovedPronunciationCandidates
// (VOICE_OFF_TTS_RULES §23.1.1 mục 3) — không có key nào trong bảng trên là tiền
// tố/hậu tố của key khác nên không cần longest-match-first riêng.
function addNamedEntityPronunciationCandidates(source: string, add: (item: Candidate) => void): void {
  for (const [key, spoken] of Object.entries(NAMED_ENTITY_PRONUNCIATIONS)) {
    let cursor = 0
    while (cursor <= source.length) {
      const start = source.indexOf(key, cursor)
      if (start < 0) break
      const end = start + key.length
      cursor = start + Math.max(1, key.length)
      const startsInsideWord = isWordCharacter(key[0]) && isWordCharacter(source[start - 1])
      const endsInsideWord = isWordCharacter(key.at(-1)) && isWordCharacter(source[end])
      if (startsInsideWord || endsInsideWord) continue
      add(candidate(start, source.slice(start, end), spoken, 'NAMED_ENTITY_PRONUNCIATION', `NAMED_ENTITY_PRONUNCIATION_${key}`))
    }
  }
}

// Bảo vệ URL/email khỏi mọi biến đổi phía dưới (số, "&", approved pronunciation…)
// — VOICE_OFF_TTS_RULES §7. Chiếm trọn vùng, thắng mọi candidate lồng bên trong
// nhờ có vị trí bắt đầu sớm hơn trong bước chọn ưu tiên theo `start` tăng dần.
function addProtectedRegionCandidates(source: string, add: (item: Candidate) => void): void {
  for (const match of source.matchAll(/\bhttps?:\/\/\S+|\bwww\.\S+/g)) add(candidate(match.index!, match[0], match[0], 'PROTECTED', 'PROTECTED_URL_001'))
  for (const match of source.matchAll(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g)) add(candidate(match.index!, match[0], match[0], 'PROTECTED', 'PROTECTED_EMAIL_001'))
}

/**
 * Chuẩn hóa không gọi LLM. Khi chưa chắc chắn, giữ nguyên text và gắn warning
 * để workflow strict chặn bước gửi Gemini TTS ở phase tiếp theo.
 */
export function normalizeVietnameseVoiceOver(sourceText: string, dictionaryRules: PronunciationDictionaryRule[] = []): TtsNormalizationResult {
  const source = sourceText.normalize('NFC')
  const candidates: Candidate[] = []
  const add = (item: Candidate) => candidates.push(item)

  addProtectedRegionCandidates(source, add)
  addDictionaryCandidates(source, dictionaryRules, add)
  addApprovedPronunciationCandidates(source, add)
  addNamedEntityPronunciationCandidates(source, add)
  addTbContextCandidates(source, add)

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
  // Chỉ tạo candidate cho PHẦN CHỮ SỐ, không đụng vào từ "năm"/"Năm" gốc — giữ
  // nguyên hoa/thường đầu câu (trước đây hard-code chữ thường "năm" nên "Năm
  // 2026" đầu câu bị hạ xuống "năm hai không hai sáu", sai display/case).
  for (const match of source.matchAll(/\bnăm\s+(\d{4})\b/gi)) {
    add(candidate(match.index! + match[0].length - match[1].length, match[1], speakYear(match[1]), 'YEAR', 'YEAR_CONTEXT_001'))
  }
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

  // Số lượng 4 chữ số đứng độc lập nhưng có DANH TỪ ĐƠN VỊ ĐẾM theo ngay sau
  // (vd "mục tiêu 2026 khách hàng") — tín hiệu QUANTITY mạnh dù không có từ
  // khoá ngữ cảnh năm nào khác (VOICE_OFF_TTS_RULES §9.4 ví dụ 2). Danh sách
  // CÓ CHỦ ĐÍCH bounded (không phải Vietnamese Word Dictionary đầy đủ) — chỉ
  // phủ đơn vị đếm thường gặp trong kịch bản MISA, để tránh đọc nhầm một năm
  // thật không có "năm" đứng trước (vd "Đến 2026 sẽ ra mắt") thành số lượng.
  // Chỉ áp dụng khi span CHƯA được rule năm/ngày/số văn bản nào ở trên nhận
  // diện (kiểm qua `candidates` đã có), để không đọc đè lên năm đúng ngữ cảnh.
  for (const match of source.matchAll(/\b(\d{4})\s+/g)) {
    const start = match.index!
    const digitsEnd = start + match[1].length
    if (candidates.some((existing) => existing.start <= start && digitsEnd <= existing.end)) continue
    const rest = source.slice(start + match[0].length)
    if (!QUANTITY_UNIT_NOUNS.some((noun) => rest.startsWith(noun))) continue
    const spoken = readVietnameseInteger(match[1])
    if (spoken) add(candidate(start, match[1], spoken, 'NUMBER', 'QUANTITY_FOUR_DIGIT_001'))
  }

  // Giờ dạng "8h00", kể cả khoảng "8h00-12h00" (khớp trước để chiếm trọn vùng
  // nhờ span dài hơn — VOICE_OFF_TTS_RULES §11A.4).
  for (const match of source.matchAll(/\b(\d{1,2})h(\d{2})\s*[-–—]\s*(\d{1,2})h(\d{2})\b/g)) {
    add(candidate(match.index!, match[0], `${speakTime(Number(match[1]), Number(match[2]))} đến ${speakTime(Number(match[3]), Number(match[4]))}`, 'TIME', 'TIME_RANGE_001'))
  }
  for (const match of source.matchAll(/\b(\d{1,2})h(\d{2})\b/g)) {
    add(candidate(match.index!, match[0], speakTime(Number(match[1]), Number(match[2])), 'TIME', 'TIME_001'))
  }
  // "8 AM" / "8 PM": guard bắt buộc — token AM/PM trong ngữ cảnh giờ PHẢI đọc
  // theo giờ, KHÔNG được áp approved pronunciation nội bộ (vd AM→"A em").
  for (const match of source.matchAll(/\b(\d{1,2})\s?(AM|PM)\b/g)) {
    add(candidate(match.index!, match[0], `${speakTime(Number(match[1]), 0)} ${match[2] === 'AM' ? 'sáng' : 'tối'}`, 'TIME', 'TIME_AMPM_001'))
  }
  // "HH:MM": phút 2 chữ số (đã đệm 0) → giờ thật; phút 1 chữ số (16:9, 4:3, 1:1)
  // → tỷ lệ khung hình "X trên Y" (VOICE_OFF_TTS_RULES §11A.3/§11A.4).
  for (const match of source.matchAll(/\b(\d{1,2}):(\d{1,2})\b/g)) {
    const hour = Number(match[1]); const minute = Number(match[2])
    if (match[2].length === 2 && hour < 24 && minute < 60) {
      add(candidate(match.index!, match[0], speakTime(hour, minute), 'TIME', 'TIME_HHMM_001'))
    } else {
      const a = readVietnameseInteger(match[1]); const b = readVietnameseInteger(match[2])
      if (a && b) add(candidate(match.index!, match[0], `${a} trên ${b}`, 'RATIO', 'ASPECT_RATIO_001'))
    }
  }
  // Tỷ lệ/phân số dạng "N/M" có từ khóa ngữ cảnh — giữ nguyên từ khóa, chỉ đọc
  // lại phần số (VOICE_OFF_TTS_RULES §11A.3).
  for (const match of source.matchAll(/(tỷ lệ khung hình|aspect ratio|tỷ lệ|ratio)(\s+)(\d{1,3})\/(\d{1,3})\b/gi)) {
    const numStart = match.index! + match[1].length + match[2].length
    const a = readVietnameseInteger(match[3]); const b = readVietnameseInteger(match[4])
    if (a && b) add(candidate(numStart, `${match[3]}/${match[4]}`, `${a} trên ${b}`, 'RATIO', 'RATIO_001'))
  }
  for (const match of source.matchAll(/(phân số|một phần)(\s+)(\d{1,3})\/(\d{1,3})\b/gi)) {
    const numStart = match.index! + match[1].length + match[2].length
    const a = readVietnameseInteger(match[3]); const b = readVietnameseInteger(match[4])
    if (a && b) add(candidate(numStart, `${match[3]}/${match[4]}`, `${a} phần ${b}`, 'FRACTION', 'FRACTION_001'))
  }
  // Tiền tệ: hậu tố đ/₫/VNĐ/VND → "đồng" (VOICE_OFF_TTS_RULES §11A.5). Dùng
  // lookahead/lookbehind Unicode thay vì \b — \b gốc JS chỉ nhận biết [A-Za-z0-9_],
  // "đ"/"Đ" không được coi là ký tự "chữ" nên \b đứng sau chúng luôn thất bại.
  for (const match of source.matchAll(/(?<![\p{L}\p{N}])(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s?(đ|₫|VNĐ|VND)(?![\p{L}\p{N}])/gu)) {
    const spoken = match[1].includes(',') ? readVietnameseDecimal(match[1]) : readVietnameseInteger(match[1])
    if (spoken) add(candidate(match.index!, match[0], `${spoken} đồng`, 'CURRENCY', 'CURRENCY_001'))
  }
  // Số điện thoại/mã định danh: CHỈ đọc từng chữ số (giữ số 0 đầu) khi có từ khóa
  // ngữ cảnh xác nhận — không tự đoán nếu đứng một mình (VOICE_OFF_TTS_RULES §11A.2).
  for (const match of source.matchAll(/(SĐT|Hotline|hotline|[Đđ]iện thoại|CCCD|CMND|[Mm]ã số thuế|[Ss]ố tài khoản|[Mm]ã khách hàng|[Mm]ã hợp đồng)([:\s]+)(\d{6,15})\b/g)) {
    const numStart = match.index! + match[1].length + match[2].length
    add(candidate(numStart, match[3], spokenDigit(match[3]), 'IDENTIFIER', 'IDENTIFIER_DIGITS_001'))
  }
  // Số thứ tự: "thứ 4" → "thứ tư" (khác cách đọc số lượng "bốn") — §11A.6.
  for (const match of source.matchAll(/\bthứ\s+(\d{1,2})\b/g)) {
    add(candidate(match.index!, match[0], `thứ ${speakOrdinal(Number(match[1]))}`, 'ORDINAL', 'ORDINAL_001'))
  }

  // Bullet đầu dòng ("- ", "+ ", "* ") không được đọc thành lời — bỏ hẳn ký hiệu,
  // không phải chỉ tránh đọc "tăng/giảm" (VOICE_OFF_TTS_RULES §17.1). Yêu cầu có
  // khoảng trắng sau ký hiệu để phân biệt với dấu +/- ĐÍNH LIỀN số ở §17.2 (vẫn
  // phải đọc "tăng/giảm").
  for (const match of source.matchAll(/^[-+*]\s+/gm)) add(candidate(match.index!, match[0], '', 'BULLET', 'BULLET_001'))

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
    // Chuỗi ≥5 chữ số có 0 đứng đầu: khả năng cao là SĐT/mã định danh chưa có từ
    // khóa ngữ cảnh — KHÔNG tự đoán là số lượng (VOICE_OFF_TTS_RULES §11A.2).
    if (match[0].length >= 5 && match[0][0] === '0') continue
    const spoken = readVietnameseInteger(match[0])
    if (spoken) add(candidate(match.index!, match[0], spoken, 'NUMBER', 'INTEGER_001'))
  }

  const selected: Candidate[] = []
  for (const item of candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start) || a.ruleId.localeCompare(b.ruleId))) {
    if (!selected.some((existing) => overlap(existing, item))) selected.push(item)
  }
  selected.sort((a, b) => a.start - b.start)
  const warnings = collectWarnings(source, selected)
  let cursor = 0
  const rawTtsText = selected.map((item) => {
    const prefix = source.slice(cursor, item.start); cursor = item.end
    return `${prefix}${item.normalized}`
  }).join('') + source.slice(cursor)
  // Lỗi thật đã gặp (2026-09-01, xem gemini.ts buildVoiceInstruction): Gemini TTS
  // "nhập vai" đổi giọng khi gặp dấu ngoặc kép trích dẫn, dù đã dặn trong prompt —
  // dặn bằng lời chỉ có tác dụng xác suất. Ở đây bỏ hẳn KÝ HIỆU ngoặc kép (không
  // đổi từ ngữ, chỉ bỏ tín hiệu hình thức "đây là lời thoại nhân vật khác") khỏi
  // ttsText — displayText/caption vẫn giữ nguyên dấu ngoặc cho người xem.
  const ttsText = rawTtsText.replace(/["“”„‚«»‹›]/g, '')
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
