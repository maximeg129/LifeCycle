import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE } from './config';

/**
 * Resolves the locale for each server render from a plain cookie — never
 * from the URL (see config.ts for why) and never from the Firestore-stored
 * user preference directly (Firestore is only ever read client-side in this
 * app, see CLAUDE.md "Authentification" — there is no server-side Firebase
 * Admin access to read it during SSR). `<LocaleSync>` (locale-sync.tsx) is
 * what keeps this cookie in step with the Firestore preference once the
 * user is signed in and on every device they sign into.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieValue) ? cookieValue : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
