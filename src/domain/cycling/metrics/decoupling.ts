// ── Découplage interne/externe — ratio ΔFC / Δpuissance (R06) ─────────────
//
// Maunder et al. (2021, R06), article fondateur du concept de durabilité :
// propose le ratio variation de FC / variation d'allure (ici puissance)
// comme indice de découplage exploitable sur le terrain. Convention
// "Pw:HR decoupling" : facteur d'efficience (puissance/FC) calculé sur
// chaque moitié d'un effort, le découplage % est la perte d'efficience
// entre la première et la seconde moitié — une dérive positive signale que
// la FC a augmenté relativement à la puissance (dérive cardiaque). Doit
// être contextualisé à la lecture (hypovolémie, chaleur — voir la règle
// ride-analysis-3-decoupling-context dans evidence/rules.ts) : ce module
// calcule le nombre, il ne l'interprète pas.

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export interface DecouplingResult {
  efficiencyFirstHalf: number
  efficiencySecondHalf: number
  /** % de perte d'efficience (puissance/FC) entre les deux moitiés — positif = dérive cardiaque, négatif = amélioration. */
  decouplingPct: number
}

/**
 * Découplage sur un effort à partir de flux puissance/FC de même longueur
 * (typiquement 1Hz), scindé en deux moitiés égales. `null` si les séries
 * n'ont pas la même longueur, sont trop courtes pour former deux moitiés,
 * ou si la FC moyenne d'une moitié est nulle (division par zéro évitée
 * plutôt que masquée par un résultat `Infinity`/`NaN`).
 */
export function computeDecoupling(wattsSeries: number[], heartrateSeries: number[]): DecouplingResult | null {
  if (wattsSeries.length !== heartrateSeries.length) return null
  if (wattsSeries.length < 2) return null

  const mid = Math.floor(wattsSeries.length / 2)
  const avgHrFirst = average(heartrateSeries.slice(0, mid))
  const avgHrSecond = average(heartrateSeries.slice(mid))
  if (avgHrFirst === 0 || avgHrSecond === 0) return null

  const efficiencyFirstHalf = average(wattsSeries.slice(0, mid)) / avgHrFirst
  const efficiencySecondHalf = average(wattsSeries.slice(mid)) / avgHrSecond
  if (efficiencyFirstHalf === 0) return null

  const decouplingPct = ((efficiencyFirstHalf - efficiencySecondHalf) / efficiencyFirstHalf) * 100
  return { efficiencyFirstHalf, efficiencySecondHalf, decouplingPct }
}
