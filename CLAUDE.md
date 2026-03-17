# CLAUDE.md — LifeHub Project Instructions

## Project overview

LifeHub is a personal life management PWA built with React + Vite + TypeScript + Firebase.
It manages 10 modules: cycling training, bike gear, recipes, weather advisor, tire pressure,
plants, pantry, finance, tasks, and health tracking.

This is a migration from an existing "Bike Vault" Firebase app into a full-featured personal hub.

## Tech stack

- **Frontend**: React 18+ with Vite, TypeScript strict mode
- **Styling**: Tailwind CSS v4 (using @tailwindcss/vite plugin)
- **State**: Zustand (one store per module + auth store + UI store)
- **Routing**: React Router v6 with lazy loading per module
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **UI primitives**: Radix UI (Dialog, DropdownMenu, Tabs, Toast, Tooltip)
- **Dates**: date-fns
- **Backend**: Firebase (Auth, Firestore, Cloud Functions, Hosting, Cloud Messaging)
- **Region**: europe-west1

## Architecture rules

### File structure

```
src/
  config/          → firebase.ts, routes.ts, constants.ts
  hooks/           → shared React hooks (useAuth, useFirestore, useCollection, useWeather)
  stores/          → Zustand stores (authStore, uiStore, moduleStores/)
  services/
    firestore/     → base.ts (generic CRUD) + one file per module
    weather.ts     → Open-Meteo API
    clothingAdvisor.ts
    tirePressure.ts
    trainingMetrics.ts
    barcodeScanner.ts
  components/
    ui/            → Design system: Button, Card, Input, Select, Modal, Toast, Badge,
                     EmptyState, LoadingState, ErrorState, StatCard, ChartWrapper, ConfirmDialog
    layout/        → AppShell, Sidebar, BottomNav, TopBar, CommandPalette
    shared/        → WeatherWidget, QuickAddFAB, DatePicker, PhotoUpload
  modules/         → Feature modules, each lazy loaded
    dashboard/
    training/
    bikes/
    recipes/
    weather-advisor/
    tire-pressure/
    plants/
    pantry/
    finance/
    tasks/
    health/
  types/           → TypeScript interfaces (index.ts, firestore.ts, weather.ts)
  utils/           → Pure functions (dateUtils, formatters, tirePressureCalc, trainingCalc, clothingAlgo)
functions/
  src/
    index.ts
    triggers/      → onActivityCreate, onExpenseCreate, onPlantLogCreate
    scheduled/     → dailyNotifications, pantryExpiryUpdate, recurringTasks
    utils/         → notifications helper
```

### Naming conventions

- Components: PascalCase files and exports (`BikeDetail.tsx`)
- Hooks: camelCase with `use` prefix (`useCollection.ts`)
- Utils/services: camelCase (`tirePressureCalc.ts`)
- Firestore collections/fields: snake_case in English (`total_distance_km`)
- UI labels and user-facing text: French
- Code comments: English
- CSS: Tailwind utility classes only, no CSS modules

### Firestore structure

ALL data lives in subcollections under `users/{uid}/`. Never use root-level collections.

Collections: activities, bikes, components, maintenance_logs, recipes, cycling_clothes,
plants, plant_logs, pantry_items, expenses, budgets, tasks, health_logs, tire_setups

Each document MUST have a `createdAt: Timestamp` field set on creation.

### Generic Firestore service pattern

Use `src/services/firestore/base.ts` — a factory that creates typed CRUD services:

```typescript
export function createFirestoreService<T>(getPath: (uid: string) => string) {
  return { getAll, getById, create, update, remove, subscribe };
}
```

Each module service is a one-liner:
```typescript
export const activityService = createFirestoreService<Activity>(
  (uid) => `users/${uid}/activities`
);
```

### Component patterns

- Every module has at minimum: ListPage, DetailView, Form (create/edit)
- Use Radix UI for accessible primitives, styled with Tailwind
- Forms use React Hook Form + Zod schema
- Loading states use skeleton screens, never spinners
- Empty states show an illustration message + CTA button
- All module pages are lazy loaded via React.lazy()

### State management

- `authStore`: user object, loading state, login/logout actions
- `uiStore`: theme (dark/light), sidebar state, active module, command palette open
- Each module has its own store in `stores/moduleStores/` if needed
- Prefer Firestore real-time listeners over local state for data

## Design system

### Theme: "Dark Utility"

Dark mode by default. CSS variables in `src/index.css`:

```
--bg-primary: #0A0A0F
--bg-surface-1: #13131A
--bg-surface-2: #1C1C26
--bg-surface-3: #252532
--border: #2A2A3C
--text-primary: #EEEEF0
--text-secondary: #8B8BA3
--text-muted: #52526B
```

Light mode via `[data-theme="light"]` override.

### Module accent colors

| Module | Color | Hex | Lucide icon |
|--------|-------|-----|-------------|
| Training | Blue | #3B82F6 | activity |
| Bikes | Orange | #F59E0B | wrench |
| Recipes | Lime | #84CC16 | chef-hat |
| Weather | Cyan | #06B6D4 | cloud-sun |
| Pressure | Indigo | #6366F1 | gauge |
| Plants | Emerald | #10B981 | leaf |
| Pantry | Orange | #F97316 | package |
| Finance | Purple | #A855F7 | wallet |
| Tasks | Pink | #EC4899 | check-square |
| Health | Teal | #14B8A6 | heart-pulse |

### Typography

- Display/headings: `Instrument Sans` (Google Fonts) — weights 500, 600, 700
- Body: `DM Sans` (Google Fonts) — weights 400, 500
- Mono/data: `JetBrains Mono` (Google Fonts) — weight 400

### Navigation

- Desktop (>1024px): Collapsible sidebar (icons / icons+labels)
- Tablet (768-1024px): Icon-only sidebar
- Mobile (<768px): Bottom tab bar with 5 slots (Dashboard, Training, Recipes, Pantry, More)
- Command Palette: Cmd+K / Ctrl+K for quick search and actions

## Firebase configuration

### Auth
- Google Sign-In only (for now)
- Protected routes: redirect to /login if not authenticated
- Store user profile in `users/{uid}` on first login

### Firestore rules (single user for now)
```
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
  match /{subcollection}/{docId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
}
```

### Cloud Functions (TypeScript, europe-west1)

Triggers:
- `onActivityCreate`: increment bike.totalDistance_km + update active components distance/wear
- `onExpenseCreate`: update budget.categories[cat].spent + budget.totalSpent
- `onPlantLogCreate` (action=water): update plant.lastWatered + plant.nextWater

Scheduled:
- `dailyNotifications` (08:00 Europe/Amsterdam): check plants needing water, expiring pantry, due tasks → send FCM
- `pantryExpiryUpdate` (02:00): recalculate daysUntilExpiry on all pantry items
- `recurringTasks` (01:00): create new task instances from recurring templates

### Weather API
- Open-Meteo (free, no API key): `https://api.open-meteo.com/v1/forecast`
- Default location: Amsterdam (lat 52.3676, lng 4.9041)
- Fetch hourly: temperature_2m, apparent_temperature, windspeed_10m, precipitation_probability, weathercode

## PWA configuration

- `manifest.json` with name "LifeHub", dark theme color (#0A0A0F), standalone display
- Service worker: cache-first for assets, stale-while-revalidate for API, network-first for navigation
- Firestore offline persistence enabled
- Custom install prompt

## Key algorithms

### Tire pressure calculation
```
Base = (weight_on_wheel × 0.7) / tire_width_mm
Adjustments: tubeless −5%, cobbles −10%, wet −5%
Weight distribution: 45% front / 55% rear
Clamp: min 2.0 bar (wide) or 3.5 bar (narrow), max 7.0-8.5 bar
```

### Training metrics
```
TSS = (duration_seconds × NP × IF) / (FTP × 3600) × 100
IF = NP / FTP
CTL = exponential moving avg of TSS, 42-day time constant
ATL = exponential moving avg of TSS, 7-day time constant
TSB = CTL − ATL
```

### Clothing recommendation
Match wardrobe items by: tempMin ≤ effective_temp ≤ tempMax
Priority layers: base (< 10°C) → jersey → outer (rain/wind) → lower body → accessories
Score by tighter temp range (more specific = better match)

## Build commands

```bash
npm run dev          # Vite dev server
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
firebase deploy      # Deploy everything
firebase deploy --only hosting          # Deploy frontend only
firebase deploy --only functions        # Deploy Cloud Functions only
firebase deploy --only firestore:rules  # Deploy Firestore rules only
```

## Implementation order

Phase 0 (foundations): Vite setup → Firebase config → Auth → Design system → Layout → Routing → Generic Firestore service → PWA config

Phase 1 (quick wins): Bikes module (migrate existing) → Tire pressure → Plants → Tasks → Finance → Health

Phase 2 (core): Training (+ GPX import + CTL/ATL/TSB) → Recipes (+ search + scaling) → Pantry (+ barcode scanner) → Weather advisor (+ clothing algo + SVG silhouette)

Phase 3 (polish): Dashboard → Notifications → Cross-module features → Command palette → Light mode → Offline polish → Performance audit

## Important notes

- NEVER use `any` type — always define proper interfaces in `src/types/`
- NEVER use inline styles — use Tailwind classes
- NEVER hardcode Firebase config — use environment variables (VITE_FIREBASE_*)
- ALWAYS add error handling on Firestore operations
- ALWAYS use Timestamp.now() for createdAt/updatedAt, never new Date()
- ALWAYS make components responsive (mobile-first with Tailwind breakpoints)
- French for all user-facing strings, English for code
- When creating a new module, follow the exact same pattern as existing modules
