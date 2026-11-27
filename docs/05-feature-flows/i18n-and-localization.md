# Feature Flow: i18n & Localization

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. What does this feature do?

Provides full internationalization: UI translation via i18next with dynamic backend (fetches translations from API), email translation via Google Translate, RTL language support, and per-user language preference persistence.

---

## 2. User interaction trace

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser
    participant F as Frontend (i18n/index.ts, useAutoLocale.ts)
    participant A as API (translateRoutes)
    participant D as Database (translation_cache, user_profiles)
    participant G as Google Translate

    %% APP START
    B->>F: Loads main.tsx → import './i18n'
    F->>F: i18n.init({ lng: detectInitialLanguage() })
    F->>F: detectInitialLanguage() → localStorage.impactly_language || navigator.language || 'en'
    F->>F: Sets document.documentElement.lang + dir (RTL check)

    %% LOAD TRANSLATIONS (on demand)
    alt English (en)
        F->>F: Uses bundled en/base.json (no network)
    else Other language
        F->>F: Checks localStorage.impactly_i18n_v3_{lang}
        alt Cache hit
            F->>F: Parses cached JSON
        else Cache miss
            F->>A: GET /api/translate/{lang}
            A->>D: SELECT * FROM translation_cache WHERE language = {lang}
            alt Cache hit in DB
                D-->>A: Returns translations JSON
            else Cache miss in DB
                A->>G: POST translate.googleapis.com (if GOOGLE_TRANSLATE_API_KEY)
                G-->>A: Translations
                A->>D: INSERT translation_cache
                A-->>F: Returns translations
            end
        end
        F->>F: Merges over English base
    end

    %% LANGUAGE SWITCH
    U->>F: Clicks LanguageSwitcher.tsx → selects "es"
    F->>F: i18n.changeLanguage('es')
    F->>F: Triggers DynamicBackend.read('es') → same flow as above
    F->>F: Saves to localStorage.impactly_language = 'es'
    F->>F: Updates document.documentElement.lang + dir

    %% ONBOARDING / PROFILE SAVE
    U->>F: Completes onboarding → selects language
    F->>A: PUT /api/users/profile { preferredLanguage: 'es' }
    A->>A: requireAuth
    A->>D: UPDATE user_profiles SET preferred_language = 'es' WHERE id = req.userId
    A->>D: UPSERT user_profiles (id, email, preferred_language)
    A-->>F: 200 { success: true, data: UserProfile }
    F->>F: AuthContext.refreshProfile() → applies language on next login

    %% EMAIL TRANSLATION (server-side)
    participant E as email.ts
    participant J as reminderJob
    J->>E: sendWeeklyReminder(user.email, user.name, weekStartDate)
    E->>E: translateStatic('Weekly reminder', user.preferredLanguage)
    E->>E: Checks SUPPORTED_EMAIL_LANGS (20 langs)
    E->>E: If supported + GOOGLE_TRANSLATE_API_KEY → Google Translate API
    E->>E: Memoizes per-process (Map: 'lang:text' → translation)
    E->>E: Falls back to English if unsupported/failed
    E->>E: Sends via Brevo with translated HTML/text
```

---

## 3. Files involved

| File | Responsibility |
|---|---|
| `client/src/i18n/index.ts` | i18next config, DynamicBackend, RTL, detectInitialLanguage |
| `client/src/i18n/useAutoLocale.ts` | Hook: applies detected locale on mount |
| `client/src/components/LanguageSwitcher.tsx` | Dropdown: flag + name, calls i18n.changeLanguage |
| `client/src/lib/api.ts` | `apiRequest` for `/api/translate/:lang` |
| `server/src/routes/translate.ts` | 2 handlers: GET /languages, GET /:languageCode |
| `server/src/lib/email.ts` | `translateStatic` (Google Translate + memoization) |
| `server/src/lib/userLanguage.ts` | `languageFromAcceptHeader` (Accept-Language parsing) |
| `server/src/lib/database.ts` | `supabase` client for translation_cache |
| `server/src/middleware/auth.ts` | `optionalAuth` for `/api/translate/:lang` |
| `client/src/context/AuthContext.tsx` | Persists language on login/hydration |
| `client/src/locales/en/base.json` | Bundled English translations |

---

## 4. Functions involved (in execution order)

### Client i18n init
1. `main.tsx` → `import './i18n'` (side effect)
2. `i18n/index.ts` → `i18n.use(DynamicBackend).use(initReactI18next).init({ lng: detectInitialLanguage(), fallbackLng: 'en', ... })`
3. `detectInitialLanguage()` → `localStorage.impactly_language` || `navigator.language` || `'en'`
4. `DynamicBackend.read(lang)` → if `lang !== 'en'`: check cache → fetch `/api/translate/{lang}` → merge over English

### Language switch
1. `LanguageSwitcher.tsx` → `i18n.changeLanguage(newLang)`
2. Triggers `DynamicBackend.read(newLang)` → same as above
5. `localStorage.setItem('impactly_language', newLang)`

### Server translation API
1. `translateRoutes.get('/languages')` → returns supported langs list
2. `translateRoutes.get('/:languageCode')` → `server/src/routes/translate.ts:71`
3. `supabase.from('translation_cache').select('translations').eq('language', lang).maybeSingle()`
4. Returns `{ translations: Record<string, string> }`

### Email translation
1. `email.sendWeeklyReminder` → `translateStatic('Weekly reminder', userLang)`
2. `translateStatic` → `lib/email.ts:44`
3. `emailTranslationCache.get('lang:text')` → if hit, return
4. If `GOOGLE_TRANSLATE_API_KEY` and supported lang:
   - `fetch('https://translation.googleapis.com/language/translate/v2', { key, q: [text], target: lang })`
   - Cache result → return
5. Fallback: return English text

### AuthContext language persistence
1. `AuthContext.loadAuthState()` → on successful `/api/users/profile`
2. `data.data.preferredLanguage` → `localStorage.setItem('impactly_language', preferred)`
3. On next visit, `detectInitialLanguage()` picks it up

---

## 5. Data transformation

| Stage | Data shape |
|---|---|
| DynamicBackend request | `GET /api/translate/es` |
| Server DB query | `SELECT translations FROM translation_cache WHERE language = 'es'` |
| Server response | `{ translations: { "key": "valor", ... } }` |
| Client merge | `{ ...enBase, ...esTranslations }` |
| Email translate request | `translateStatic('Weekly reminder', 'es')` |
| Google Translate response | `{ data: { translations: [{ translatedText: 'Recordatorio semanal' }] } }` |
| Cache key | `'es:Weekly reminder'` → `'Recordatorio semanal'` |
| Supported email langs | `en, es, fr, de, pt, it, nl, pl, ru, tr, ar, he, hi, bn, id, vi, th, ja, ko, zh` |

---

## 6. Failure scenarios

| Failure point | Behavior |
|---|---|
| Translation API 404/500 | Falls back to English base |
| Google Translate key missing | Returns English; logs warning |
| Unsupported language | Returns English; logs warning |
| Cache corrupted (JSON parse) | Falls back to network fetch |
| RTL language (ar, he, etc.) | `document.documentElement.dir = 'rtl'` |
| User has no preference | `detectInitialLanguage()` → browser language → English |

---

## 7. Simple story

Imagine the app as a **multilingual receptionist**:

1. **You walk in** (app loads) → receptionist checks your ID badge (`localStorage.impactly_language`) or asks your language (`navigator.language`)
2. **If English** → speaks English immediately (bundled)
3. **If Spanish** → checks her notebook (`localStorage.impactly_i18n_v3_es`) → if empty, calls headquarters (`/api/translate/es`) → HQ checks archive (`translation_cache`) → if missing, calls Google Translate → saves in archive → sends back
4. **You switch to French** → receptionist updates your badge, fetches French translations
5. **Email arrives** → receptionist translates it using Google Translate (memoized so she doesn't ask twice)
6. **RTL languages** → receptionist flips the room layout (`dir=rtl`)

**Cache versioning**: `TRANSLATION_VERSION = 3` in cache key → bump to invalidate all.

---

## Related documents

- [Translation endpoints](../06-api-reference/endpoint-reference-platform-misc.md)
- [Email translation](../09-integrations/external-services.md#7-google-translate)
- [Auth context](../04-function-documentation/frontend-hooks-context-lib.md)
- [Client i18n](../03-codebase-structure/file-by-file-client.md)

## Verification notes

Paths traced from `client/src/i18n/index.ts`, `client/src/i18n/useAutoLocale.ts`,
`client/src/components/LanguageSwitcher.tsx`, `server/src/routes/translate.ts`,
`server/src/lib/email.ts`, `server/src/lib/userLanguage.ts`,
`client/src/context/AuthContext.tsx` at commit `7567207`.
Not verified at runtime: Google Translate API behavior, cache invalidation on version bump, RTL rendering completeness.