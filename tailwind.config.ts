import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-display)', 'Space Grotesk', 'system-ui', 'sans-serif'],
        headline: ['var(--font-display)', 'Space Grotesk', 'system-ui', 'sans-serif'],
        code: ['var(--font-mono-data)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
        data: ['var(--font-mono-data)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        'brand-strong': 'hsl(var(--brand-strong))',
        subtle: 'hsl(var(--subtle))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // LifeCycle_Pro_UI_Spec.md §2 — statut (good/warn/bad/unknown),
        // forme physiologique (fitness/fatigue/form) et zones de puissance
        // Coggan (z1-z7). Même patron bare "hsl(var(--x))" que les tokens
        // shadcn ci-dessus (pas de placeholder <alpha-value> explicite —
        // Tailwind applique déjà bg-good/10 etc. sur cette forme, comme
        // pour bg-primary/10 partout ailleurs dans l'app).
        good: {
          DEFAULT: 'hsl(var(--good))',
          soft: 'hsl(var(--good-soft))',
        },
        warn: {
          DEFAULT: 'hsl(var(--warn))',
          soft: 'hsl(var(--warn-soft))',
        },
        bad: {
          DEFAULT: 'hsl(var(--bad))',
          soft: 'hsl(var(--bad-soft))',
        },
        unknown: 'hsl(var(--unknown))',
        fitness: 'hsl(var(--fitness))',
        fatigue: 'hsl(var(--fatigue))',
        form: 'hsl(var(--form))',
        z1: 'hsl(var(--z1))',
        z2: 'hsl(var(--z2))',
        z3: 'hsl(var(--z3))',
        z4: 'hsl(var(--z4))',
        z5: 'hsl(var(--z5))',
        z6: 'hsl(var(--z6))',
        z7: 'hsl(var(--z7))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      // Pas de borderRadius custom — refonte UI/IA, restructuration
      // complète (LifeCycle_Pro_UI_Spec.md §2/§8, "Only radii 8/12/16/pill
      // are used") : cet override (lg=var(--radius)=12px, md=10px,
      // sm=8px) désaccordait l'app de sa propre convention déjà écrite en
      // commentaire dans globals.css ("rounded-lg (8px)... rounded-xl
      // (12px)... rounded-2xl (16px)") — l'échelle Tailwind PAR DÉFAUT
      // (sm=2px, md=6px, lg=8px, xl=12px, 2xl=16px, 3xl=24px) correspond
      // déjà exactement à r-sm/r-md/r-lg du brief une fois cet override
      // supprimé, sans renommer une seule classe `rounded-*` dans toute la
      // base. Voir CLAUDE.md pour l'audit des primitives shadcn
      // (button.tsx/input.tsx) qui, elles, câblaient `rounded-md` en dur
      // et ont dû être corrigées séparément pour retomber sur r-sm (8px).
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
