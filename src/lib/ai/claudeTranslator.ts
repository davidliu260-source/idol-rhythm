import 'server-only'
import { TranslatorApiError, TranslatorConfigError } from './autoTranslate'
import { generateChineseDisplayWithClaude, type ChineseDisplayInput } from './generateChineseDisplay'

export async function claudeTranslator(input: ChineseDisplayInput) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new TranslatorConfigError('ANTHROPIC_API_KEY 未設定（請至 Vercel env vars 補上）')
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TranslatorApiError('AI 呼叫逾時')), 45_000)
    })
    return await Promise.race([generateChineseDisplayWithClaude(input), timeout])
  } catch (error) {
    if (error instanceof TranslatorApiError) throw error
    // SDK and JSON parser messages can include request or response content.
    const message = error instanceof Error ? error.message : String(error)
    if (message.startsWith('AI 回傳格式錯誤：')) throw new Error('AI 回傳格式錯誤')
    if (/^輸入內容過長（上限 \d+ 字，目前 \d+）$/.test(message) ||
        message === 'AI 未產生可寫入的繁中欄位') throw new Error(message)
    if (/\b(?:401|403)\b|authentication_error|permission_error|credit balance|billing/i.test(message)) {
      throw new TranslatorConfigError('AI 驗證、權限或帳務設定有誤')
    }
    const status = /^(?:AI 呼叫失敗：)?(?:HTTP\s+)?([45]\d{2})\b/i.exec(message)?.[1]
    const errorType = /\b(overloaded_error|rate_limit_error|api_error|invalid_request_error|not_found_error|request_too_large)\b/i.exec(message)?.[1]
    const summary = status ? `HTTP ${status}` : errorType?.toLowerCase()
    throw new TranslatorApiError(summary ? `AI 呼叫失敗（${summary}）` : 'AI 呼叫失敗')
  } finally {
    clearTimeout(timer)
  }
}
