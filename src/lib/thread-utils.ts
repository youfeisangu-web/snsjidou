const THREADS_LIMIT = 500

/**
 * 500文字を超えるノードを段落→改行→句読点の順で自然な区切りに再分割する。
 * カット（途中切り）は絶対にしない。
 */
function splitLongNode(text: string): string[] {
  if (text.length <= THREADS_LIMIT) return [text]

  const result: string[] = []
  let remaining = text

  while (remaining.length > THREADS_LIMIT) {
    const window = remaining.slice(0, THREADS_LIMIT)

    // 1. 段落区切り（\n\n）
    let idx = window.lastIndexOf('\n\n')

    // 2. 単一改行
    if (idx < 50) idx = window.lastIndexOf('\n')

    // 3. 日本語・英語の句読点
    if (idx < 50) {
      const m = [...window.matchAll(/[。！？!?]/g)]
      if (m.length > 0) idx = m[m.length - 1].index! + 1
    }

    // 4. 空白
    if (idx < 50) idx = window.lastIndexOf(' ')

    // 区切りが見つからなければ単語単位で分割できないのでそのまま1件として確定
    if (idx < 50) {
      result.push(remaining)
      return result
    }

    result.push(remaining.slice(0, idx).trim())
    remaining = remaining.slice(idx).trim()
  }

  if (remaining) result.push(remaining)
  return result
}

/**
 * content を |||THREAD||| で分割し、500文字超のノードをさらに再分割して返す。
 */
export function toThreadNodes(content: string): string[] {
  const raw = content.split(/\|\|\|THREAD\|\|\|/).map(s => s.trim()).filter(Boolean)
  return raw.flatMap(node => splitLongNode(node))
}
