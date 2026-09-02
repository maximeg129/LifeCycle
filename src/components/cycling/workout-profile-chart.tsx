"use client"

// ── Mini graphique de profil de séance, façon "workout builder" ─────────
//
// Retour utilisateur, sur la bande de jours du calendrier du plan :
// "pourquoi là, on n'utilise pas à la façon intervalles la vue avec les
// zones cible, le temps... un peu comme un graphique... ça serait sûrement
// un petit peu plus visuel." Remplace la simple pastille de couleur unique
// utilisée jusqu'ici (une couleur pour toute la séance) par un profil par
// étape : chaque barre = une étape du script structuré, largeur = part de
// la durée totale, hauteur = %FTP relatif au pic de la séance, couleur =
// zone Coggan — voir workoutProfileBars (plan-calendar-types.ts) pour le
// calcul, pur et testé séparément de ce composant de rendu.

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { parseStructuredWorkoutProfile, workoutProfileBars } from './plan-calendar-types'

interface Props {
  structuredWorkout: string | undefined | null
  /** Hauteur du graphique en px — compact (bande de jours) vs détaillé (feuille de séance) appellent des tailles différentes. */
  height?: number
  className?: string
}

export function WorkoutProfileChart({ structuredWorkout, height = 16, className }: Props) {
  const bars = useMemo(
    () => workoutProfileBars(parseStructuredWorkoutProfile(structuredWorkout)),
    [structuredWorkout]
  )

  if (bars.length === 0) return null

  return (
    <div className={cn('flex items-end gap-px w-full overflow-hidden', className)} style={{ height }}>
      {bars.map((bar, i) => (
        <div
          key={i}
          className="rounded-[1px] shrink-0"
          style={{ width: `${bar.widthPct}%`, height: `${bar.heightPct}%`, backgroundColor: bar.color }}
        />
      ))}
    </div>
  )
}
