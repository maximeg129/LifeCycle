// ── i18n — configuration partagée ────────────────────────────────────
//
// Chantier multilangue (retour utilisateur : "le multilangue de l'app").
// Décisions actées avec l'utilisateur avant de commencer :
//   - V1 : français (existant) + anglais.
//   - La langue est une préférence EXPLICITE choisie dans Réglages
//     (users/{uid}/settings/preferences), jamais une détection automatique
//     du navigateur — voir language-card.tsx.
//   - Le contenu généré par l'IA doit aussi changer de langue (voir
//     src/ai/language.ts) — pas seulement l'UI statique.
//
// Pas de préfixe de langue dans l'URL (`/en/cycling`) : cette app est
// personnelle/authentifiée, pas un site public multi-marché — un préfixe
// forcerait à restructurer TOUTES les routes sous `src/app/[locale]/...`
// (chaque page.tsx, les redirects de next.config.ts, chaque <Link>...) pour
// un bénéfice (SEO) qui ne s'applique pas ici. La langue vit dans un cookie
// (résolu côté serveur par src/i18n/request.ts) — voir LOCALE_COOKIE.

export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
