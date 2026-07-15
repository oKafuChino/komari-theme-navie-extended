import { normalizePublicUrl } from '@/utils/themeSettings'

export interface MarkdownToken {
  type: 'text' | 'bold' | 'italic' | 'link' | 'image' | 'code' | 'br'
  content?: string
  url?: string
  alt?: string
}

function safeUrl(value: string): string | null {
  const normalized = normalizePublicUrl(value, '')
  return normalized || null
}

export function parseMarkdown(text: string): MarkdownToken[] {
  if (!text)
    return []

  const tokens: MarkdownToken[] = []
  let remaining = text

  while (remaining.length > 0) {
    const imageMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imageMatch) {
      const url = safeUrl(imageMatch[2]!)
      if (url)
        tokens.push({ type: 'image', alt: imageMatch[1], url })
      remaining = remaining.slice(imageMatch[0].length)
      continue
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      const url = safeUrl(linkMatch[2]!)
      tokens.push(url ? { type: 'link', content: linkMatch[1], url } : { type: 'text', content: linkMatch[1] })
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/) || remaining.match(/^__([^_]+)__/)
    if (boldMatch) {
      tokens.push({ type: 'bold', content: boldMatch[1] })
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(/^\*([^*]+)\*/) || remaining.match(/^_([^_]+)_/)
    if (italicMatch) {
      tokens.push({ type: 'italic', content: italicMatch[1] })
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      tokens.push({ type: 'code', content: codeMatch[1] })
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    if (remaining[0] === '\n') {
      tokens.push({ type: 'br' })
      remaining = remaining.slice(1)
      continue
    }

    const nextSpecial = remaining.search(/[![*_`\n]/)
    if (nextSpecial === -1) {
      tokens.push({ type: 'text', content: remaining })
      break
    }
    if (nextSpecial === 0) {
      tokens.push({ type: 'text', content: remaining[0] })
      remaining = remaining.slice(1)
      continue
    }
    tokens.push({ type: 'text', content: remaining.slice(0, nextSpecial) })
    remaining = remaining.slice(nextSpecial)
  }

  return tokens
}
