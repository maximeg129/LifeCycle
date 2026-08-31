'use client'

// ── Source-au-clic — d'où vient cette affirmation ─────────────────────────
//
// Exigence Phase 5 (UI) du cadrage : "source-au-clic pour chaque métrique
// affichée, distinction visuelle convention vs constantes sourcées."
// Petit bouton (icône Info) qui ouvre un popover listant, pour chaque
// CoachRule citée, son statut (sourcée Rxx/Sxx vs [convention]) et — pour
// une règle sourcée — la référence complète (auteurs/année/titre/revue/
// niveau de preuve). Lit directement RULES/REFERENCES (evidence/), jamais
// un texte dupliqué à la main : si une règle change de statut ou de
// référence, ce composant reflète le changement partout où il est utilisé,
// sans édition manuelle.
//
// Premier déploiement (PR 11) : les 3 tuiles où un retour utilisateur/audit
// a explicitement demandé une correction (HRV, CTL, TSB — voir
// docs/AUDIT_CYCLING.md §1). Le reste des métriques affichées suivra dans
// une PR de suivi (chantier large, hors scope d'une seule PR — voir
// CLAUDE.md/PLAN pour le reste de la Phase 5).

import { Info } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { RULES, type CoachRule } from '@/domain/cycling/evidence/rules'
import { REFERENCES } from '@/domain/cycling/evidence/references'

interface SourceCitationProps {
  /** Un ou plusieurs id de CoachRule (evidence/rules.ts) à citer. Les ids inconnus sont silencieusement ignorés plutôt que de casser l'affichage. */
  ruleIds: string[]
  className?: string
  /** Libellé accessible du bouton — par défaut générique, à préciser pour un contexte donné (ex. "Source du HRV"). */
  label?: string
}

function findRule(id: string): CoachRule | undefined {
  return RULES.find((r) => r.id === id)
}

export function SourceCitation({ ruleIds, className, label = 'Voir la source' }: SourceCitationProps) {
  const rules = ruleIds.map(findRule).filter((r): r is CoachRule => r != null)
  if (rules.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'inline-flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-foreground transition-colors',
            className
          )}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm space-y-3" align="start">
        {rules.map((rule) => (
          <div key={rule.id} className="space-y-1.5 pb-3 border-b border-border last:pb-0 last:border-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {rule.convention ? (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  convention
                </Badge>
              ) : (
                rule.refs.map((refId) => (
                  <Badge key={refId} variant="outline" className="text-[10px] font-data font-normal">
                    {refId}
                  </Badge>
                ))
              )}
            </div>
            <p className="text-xs text-foreground/90">{rule.statement}</p>
            {!rule.convention &&
              rule.refs.map((refId) => {
                const ref = REFERENCES[refId]
                if (!ref) return null
                return (
                  <p key={refId} className="text-[11px] text-muted-foreground">
                    <span className="font-data">{refId}</span> — {ref.authors}, {ref.year}. {ref.title}. {ref.source}. (niveau {ref.level})
                  </p>
                )
              })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
