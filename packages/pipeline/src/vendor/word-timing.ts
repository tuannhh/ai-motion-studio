// Gỡ phụ thuộc NestJS khi vendor vào pipeline: dùng Error thường.
class BadRequestException extends Error {}

export const WORD_TIMING_VERSION = '1.0.0'
export const WORD_TIMING_SOURCE = 'ESTIMATED_PROPORTIONAL'
export const FORCED_WORD_TIMING_SOURCE = 'GEMINI_FORCED_ALIGNMENT'
export type WordTimingSource = typeof WORD_TIMING_SOURCE | typeof FORCED_WORD_TIMING_SOURCE

export type WordTiming = {
  index: number
  text: string
  startMs: number
  endMs: number
  textStart: number
  textEnd: number
}

export type DisplayWordTiming = {
  index: number
  text: string
  startMs: number
  endMs: number
  ttsWordStart: number
  ttsWordEnd: number
}

export type WordTimingResult = {
  version: string
  source: WordTimingSource
  durationMs: number
  textHashInput: string
  words: WordTiming[]
  displayTextHashInput?: string
  displayWords?: DisplayWordTiming[]
  mappingSource?: 'TRACE_OFFSET'
}

export type ForcedWordTimingCandidate = { text: string; startMs: number; endMs: number }

function lexicalToken(value: string): string | null {
  const matches = [...value.normalize('NFC').matchAll(/[\p{L}\p{M}\p{N}_]+(?:[-’'][\p{L}\p{M}\p{N}_]+)*/gu)]
  return matches.length === 1 && matches[0][0] === value.normalize('NFC').trim().replace(/^[^\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_]+$/gu, '') ? matches[0][0] : null
}

/**
 * Chuẩn hóa output timestamp từ provider về đúng token của TTS. Provider
 * không được phép tự thêm/bớt/sửa từ; mọi sai lệch đều dừng theo fail-closed.
 * Khoảng im lặng đầu/cuối được gộp vào từ biên để giữ contract karaoke phủ kín
 * toàn bộ WAV giống renderer hiện tại.
 */
export function buildForcedWordTimings(textInput: string, durationMsInput: number, candidates: ForcedWordTimingCandidate[]): WordTimingResult {
  const text = textInput.normalize('NFC')
  const durationMs = Math.round(durationMsInput)
  if (!text.trim() || !Number.isFinite(durationMs) || durationMs <= 0) throw new BadRequestException('Không thể tạo forced alignment khi text hoặc thời lượng audio không hợp lệ.')
  const expected = [...text.matchAll(/[\p{L}\p{M}\p{N}_]+(?:[-’'][\p{L}\p{M}\p{N}_]+)*/gu)].map((match) => ({ text: match[0], start: match.index!, end: match.index! + match[0].length }))
  if (!expected.length || candidates.length !== expected.length) throw new BadRequestException('Forced alignment không khớp số từ TTS.')
  let cursor = 0
  const words = candidates.map((candidate, index) => {
    if (lexicalToken(candidate.text) !== expected[index].text) throw new BadRequestException(`Forced alignment lệch từ TTS tại vị trí ${index}.`)
    if (!Number.isFinite(candidate.startMs) || !Number.isFinite(candidate.endMs) || candidate.endMs <= candidate.startMs) throw new BadRequestException(`Forced alignment có khoảng thời gian không hợp lệ tại từ ${index}.`)
    const startMs = index === 0 ? 0 : cursor
    const endMs = index === candidates.length - 1 ? durationMs : Math.round(candidate.endMs)
    if (endMs <= startMs || endMs > durationMs) throw new BadRequestException(`Forced alignment vượt thời lượng audio tại từ ${index}.`)
    cursor = endMs
    return { index, text: expected[index].text, startMs, endMs, textStart: expected[index].start, textEnd: expected[index].end }
  })
  if (cursor !== durationMs) throw new BadRequestException('Forced alignment không phủ kín thời lượng audio.')
  return { version: WORD_TIMING_VERSION, source: FORCED_WORD_TIMING_SOURCE, durationMs, textHashInput: text, words }
}

/**
 * Kiểm tra hợp đồng timing trước preview/render. Timing proportional vẫn là
 * fallback (chưa phải forced alignment), nhưng phải phủ kín audio và không có
 * khoảng trống/chồng lấn để karaoke không chạy sai hoặc lệch khỏi master.
 * Trả về thông điệp lỗi thay vì ném exception để caller chọn HTTP semantics.
 */
export function validateWordTimingContract(timing: Pick<WordTimingResult, 'durationMs' | 'words' | 'displayWords'>): string | null {
  const { durationMs, words, displayWords } = timing
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 'Thời lượng timing không hợp lệ.'
  if (!Array.isArray(words) || words.length === 0) return 'Timing TTS phải có ít nhất một từ.'
  if (!Array.isArray(displayWords) || displayWords.length === 0) return 'Timing hiển thị phải có ít nhất một từ.'

  const validateSequence = (
    name: string,
    entries: Array<{ index: number; startMs: number; endMs: number }>,
  ): string | null => {
    let cursor = 0
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      if (entry.index !== index) return `${name} có index không liên tục.`
      if (!Number.isInteger(entry.startMs) || !Number.isInteger(entry.endMs)) return `${name} phải dùng mốc thời gian nguyên.`
      if (entry.startMs !== cursor) return `${name} có khoảng trống hoặc chồng lấn tại từ ${index}.`
      if (entry.endMs <= entry.startMs || entry.endMs > durationMs) return `${name} có khoảng thời gian không hợp lệ tại từ ${index}.`
      cursor = entry.endMs
    }
    return cursor === durationMs ? null : `${name} không phủ kín thời lượng audio.`
  }

  const wordsError = validateSequence('Timing TTS', words)
  if (wordsError) return wordsError
  const displayError = validateSequence('Timing hiển thị', displayWords)
  if (displayError) return displayError

  for (const [index, entry] of displayWords.entries()) {
    if (!Number.isInteger(entry.ttsWordStart) || !Number.isInteger(entry.ttsWordEnd) || entry.ttsWordStart < 0 || entry.ttsWordEnd < entry.ttsWordStart || entry.ttsWordEnd >= words.length) {
      return `Timing hiển thị tham chiếu TTS không hợp lệ tại từ ${index}.`
    }
  }
  return null
}

function graphemeWeight(value: string): number {
  return Math.max(1, Array.from(value.normalize('NFC')).length)
}

/**
 * Tạo timing ổn định từ text TTS và duration WAV. Đây là fallback có thể lặp lại,
 * không phải forced alignment; renderer phải hiển thị source để human biết độ tin cậy.
 */
export function buildProportionalWordTimings(textInput: string, durationMsInput: number): WordTimingResult {
  const text = textInput.normalize('NFC')
  const durationMs = Math.round(durationMsInput)
  if (!text.trim() || !Number.isFinite(durationMs) || durationMs <= 0) throw new BadRequestException('Không thể tạo word timing khi text hoặc thời lượng audio không hợp lệ.')
  const words = [...text.matchAll(/[\p{L}\p{M}\p{N}_]+(?:[-’'][\p{L}\p{M}\p{N}_]+)*/gu)].map((match) => ({ text: match[0], start: match.index!, end: match.index! + match[0].length, weight: graphemeWeight(match[0]) }))
  if (!words.length) throw new BadRequestException('Không tìm thấy từ hợp lệ để tạo word timing.')
  const totalWeight = words.reduce((sum, word) => sum + word.weight, 0)
  let cursor = 0
  const timings = words.map((word, index) => {
    const startMs = cursor
    cursor = index === words.length - 1 ? durationMs : Math.round((durationMs * (words.slice(0, index + 1).reduce((sum, item) => sum + item.weight, 0))) / totalWeight)
    return { index, text: word.text, startMs, endMs: cursor, textStart: word.start, textEnd: word.end }
  })
  return { version: WORD_TIMING_VERSION, source: WORD_TIMING_SOURCE, durationMs, textHashInput: text, words: timings }
}

type NormalizerTrace = { start: number; end: number; original: string; normalized: string }

function mapSourceOffsetToTts(offset: number, traces: NormalizerTrace[], endBias: boolean): number {
  let sourceCursor = 0
  let ttsCursor = 0
  for (const trace of traces) {
    if (offset <= trace.start) return ttsCursor + offset - sourceCursor
    ttsCursor += trace.start - sourceCursor
    sourceCursor = trace.start
    if (offset <= trace.end) return ttsCursor + (endBias ? trace.normalized.length : 0)
    ttsCursor += trace.normalized.length
    sourceCursor = trace.end
  }
  return ttsCursor + offset - sourceCursor
}

/** Ghép khoảng chữ hiển thị với các token TTS sau khi normalizer đã mở rộng số/mã. */
export function mapWordTimingsToDisplayText(timing: WordTimingResult, displayTextInput: string, tracesInput: NormalizerTrace[]): WordTimingResult {
  const displayText = displayTextInput.normalize('NFC')
  if (!displayText.trim() || !timing.words.length) throw new BadRequestException('Không thể map phụ đề khi thiếu display text hoặc word timing.')
  const traces = tracesInput.filter((trace) => Number.isInteger(trace.start) && Number.isInteger(trace.end) && trace.start >= 0 && trace.end > trace.start).sort((a, b) => a.start - b.start)
  const displayWords = [...displayText.matchAll(/[\p{L}\p{M}\p{N}_]+(?:[-’'][\p{L}\p{M}\p{N}_]+)*/gu)]
  if (!displayWords.length) throw new BadRequestException('Không tìm thấy từ hiển thị để map word timing.')
  let previousTtsIndex = 0
  const mapped = displayWords.map((match, index) => {
    const displayStart = match.index!
    const displayEnd = displayStart + match[0].length
    const ttsStart = mapSourceOffsetToTts(displayStart, traces, false)
    const ttsEnd = mapSourceOffsetToTts(displayEnd, traces, true)
    const candidates = timing.words.filter((word) => word.textStart < ttsEnd && word.textEnd > ttsStart && word.index >= previousTtsIndex)
    if (!candidates.length) throw new BadRequestException(`Không map được từ phụ đề tại vị trí ${displayStart}.`)
    const first = candidates[0]
    const last = candidates[candidates.length - 1]
    previousTtsIndex = last.index
    return { index, text: match[0], startMs: first.startMs, endMs: last.endMs, ttsWordStart: first.index, ttsWordEnd: last.index }
  })
  return { ...timing, displayTextHashInput: displayText, displayWords: mapped, mappingSource: 'TRACE_OFFSET' }
}

/** Đọc duration từ WAV PCM chuẩn (RIFF/WAVE), không gọi ffprobe trong API request. */
export function readWavDurationMs(wav: Buffer): number {
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new BadRequestException('Audio TTS không phải WAV hợp lệ.')
  let offset = 12
  let sampleRate = 0
  let channels = 0
  let bitDepth = 0
  let dataBytes = 0
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4)
    const size = wav.readUInt32LE(offset + 4)
    const body = offset + 8
    if (body + size > wav.length) break
    if (id === 'fmt ' && size >= 16) { channels = wav.readUInt16LE(body + 2); sampleRate = wav.readUInt32LE(body + 4); bitDepth = wav.readUInt16LE(body + 14) }
    if (id === 'data') dataBytes += size
    offset = body + size + (size % 2)
  }
  const bytesPerSecond = sampleRate * channels * (bitDepth / 8)
  if (!dataBytes || !Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) throw new BadRequestException('WAV TTS thiếu thông số PCM để tính thời lượng.')
  return Math.max(1, Math.round((dataBytes / bytesPerSecond) * 1000))
}
