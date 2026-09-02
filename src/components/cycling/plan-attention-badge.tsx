"use client"

// ── Badge compact "points de vigilance" du plan ──────────────────────────
//
// Retour utilisateur : "tu as fait à chaque fois sur un plan d'entraînement
// des box de warning... ça prend quand même pas mal de place sur la page
// et ça rallonge [la page]... je me demande s'il ne serait pas plus user
// friendly de simplement avoir des pastilles ou des petits points
// d'exclamation, un, deux, trois selon le nombre de warnings et qu'après
// l'utilisateur clique sur ce warning pour le voir." Remplace les trois
// blocs toujours dépliés (bannière de verdict, warnings[], contrôle de
// progression de charge — voir plan-attention-types.ts pour leur
// consolidation) par un seul déclencheur compact.
//
// Sévérité honnête préservée (retour utilisateur : "si on a des box
// rouges, s'il y a vraiment un point de vigilance et que l'athlète ne
// devrait pas s'entraîner") — rouge pour 'block', ambre pour 'warn', à la
// fois sur le déclencheur (couleur globale, la pire des deux) et sur
// chaque item déplié individuellement.

import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SourceCitation } from '@/components/coach/source-citation'
import { cn } from '@/lib/utils'
import { attentionOverallSeverity, type AttentionItem } from './plan-attention-types'

interface Props {
  items: AttentionItem[]
}

export function PlanAttentionBadge({ items }: Props) {
  const overall = attentionOverallSeverity(items)
  if (!overall) return null

  const isBlock = overall === 'block'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5 h-7 text-xs',
            isBlock ? 'text-destructive border-destructive/30 hover:text-destructive' : 'text-yellow-600 border-yellow-500/30 hover:text-yellow-600'
          )}
        >
          {isBlock ? <ShieldAlert className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {items.length} point{items.length > 1 ? 's' : ''} de vigilance
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" align="start">
        {items.map((item, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2 p-2.5 rounded-lg border text-sm',
              item.severity === 'block' ? 'bg-destructive/5 border-destructive/20' : 'bg-yellow-500/5 border-yellow-500/20'
            )}
          >
            {item.severity === 'block' ? (
              <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{item.text}</span>
            {item.ruleIds && <SourceCitation ruleIds={item.ruleIds} label="Voir la règle citée" className="shrink-0 mt-0.5" />}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
