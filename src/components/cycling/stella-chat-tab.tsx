"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Send, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCoachChat } from './use-coach-chat'
import { isSendableChatMessage } from './coach-chat-types'
import { EmptyState } from '@/components/ui/empty-state'

const SUGGESTIONS = [
  'Qu\'est-ce que je fais aujourd\'hui ?',
  'Comment se passe ma récupération en ce moment ?',
  'Je suis fatigué, je lève le pied ou pas ?',
]

export function StellaChatTab() {
  const { messages, isLoadingHistory, isSending, sendMessage, clearHistory } = useCoachChat()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const handleSend = async (text?: string) => {
    const toSend = text ?? draft
    if (!isSendableChatMessage(toSend) || isSending) return
    setDraft('')
    await sendMessage(toSend)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card/40 border-border">
        <CardContent className="p-0 flex flex-col h-[600px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">Stella</p>
                <p className="text-[10px] text-muted-foreground">Votre coach IA</p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory} className="gap-1.5 text-muted-foreground text-xs">
                <Trash2 className="w-3.5 h-3.5" /> Effacer
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingHistory ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="h-12 w-1/2 ml-auto" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-6">
                <EmptyState
                  size="compact"
                  icon={Sparkles}
                  title="Discutez avec Stella"
                  description="Elle connaît vos objectifs, votre forme et votre historique — posez-lui une question."
                />
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => handleSend(s)} className="rounded-full text-xs">
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                        m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-4 py-2.5 bg-secondary">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="p-3 border-t border-border flex gap-2 items-end">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrivez à Stella…"
              rows={1}
              className="min-h-0 resize-none"
              disabled={isSending}
            />
            <Button onClick={() => handleSend()} disabled={isSending || !isSendableChatMessage(draft)} size="icon" className="shrink-0">
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
