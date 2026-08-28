import { describe, it, expect } from 'vitest'
import { trimChatHistoryForPrompt, isSendableChatMessage, type ChatMessageLike } from './coach-chat-types'

function msg(i: number): ChatMessageLike {
  return { role: i % 2 === 0 ? 'user' : 'assistant', content: `message ${i}` }
}

describe('trimChatHistoryForPrompt', () => {
  it('returns the history unchanged when within the limit', () => {
    const history = [msg(1), msg(2), msg(3)]
    expect(trimChatHistoryForPrompt(history, 20)).toEqual(history)
  })

  it('keeps only the trailing N messages when over the limit', () => {
    const history = Array.from({ length: 25 }, (_, i) => msg(i))
    const trimmed = trimChatHistoryForPrompt(history, 20)
    expect(trimmed).toHaveLength(20)
    expect(trimmed[0]).toEqual(msg(5))
    expect(trimmed[19]).toEqual(msg(24))
  })

  it('preserves oldest-first order', () => {
    const history = Array.from({ length: 22 }, (_, i) => msg(i))
    const trimmed = trimChatHistoryForPrompt(history, 20)
    const indices = trimmed.map((m) => Number(m.content.replace('message ', '')))
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })

  it('uses the default limit when none is given', () => {
    const history = Array.from({ length: 30 }, (_, i) => msg(i))
    expect(trimChatHistoryForPrompt(history)).toHaveLength(20)
  })

  it('handles an empty history', () => {
    expect(trimChatHistoryForPrompt([])).toEqual([])
  })
})

describe('isSendableChatMessage', () => {
  it('accepts non-empty text', () => {
    expect(isSendableChatMessage('Salut Stella')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isSendableChatMessage('')).toBe(false)
  })

  it('rejects whitespace-only text', () => {
    expect(isSendableChatMessage('   \n\t')).toBe(false)
  })
})
