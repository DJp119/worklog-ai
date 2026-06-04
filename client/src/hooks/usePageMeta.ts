import { useEffect } from 'react'

/**
 * usePageMeta — Set per-page <title>, meta description, canonical URL,
 * Open Graph, and Twitter card meta tags for SPA routes.
 *
 * This is a stopgap for the Vite SPA while a full SSR/Next.js marketing
 * site is being built. With SSR, these would all be set at build time
 * via the page component.
 */

const SITE_NAME = 'Impactly AI'
const SITE_URL = 'https://impactlyai.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`
const DEFAULT_DESCRIPTION =
  'Stop stressing over annual appraisals. Impactly AI captures your weekly achievements, highlights your key metrics, and generates promotion-ready, structured self-evaluations automatically. 100% private and secure.'

export interface PageMetaOptions {
  title: string
  description?: string
  /** Path-only, e.g. '/privacy' → canonical becomes https://impactlyai.com/privacy */
  path?: string
  ogImage?: string
  noIndex?: boolean
}

function ensureMeta(attr: 'name' | 'property', key: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`
  )
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  return el
}

function ensureLink(rel: string): HTMLLinkElement {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  return el
}

export function usePageMeta(opts: PageMetaOptions): void {
  useEffect(() => {
    const fullTitle =
      opts.title === SITE_NAME ? SITE_NAME : `${opts.title} | ${SITE_NAME}`
    const description = opts.description ?? DEFAULT_DESCRIPTION
    const canonicalUrl = opts.path
      ? `${SITE_URL}${opts.path}`
      : SITE_URL
    const ogImage = opts.ogImage ?? DEFAULT_OG_IMAGE

    // Title
    document.title = fullTitle

    // Primary meta
    ensureMeta('name', 'description').setAttribute('content', description)
    ensureMeta('name', 'robots').setAttribute(
      'content',
      opts.noIndex ? 'noindex, nofollow' : 'index, follow'
    )

    // Canonical
    ensureLink('canonical').setAttribute('href', canonicalUrl)

    // Open Graph
    const ogTitle = fullTitle
    ensureMeta('property', 'og:title').setAttribute('content', ogTitle)
    ensureMeta('property', 'og:description').setAttribute('content', description)
    ensureMeta('property', 'og:url').setAttribute('content', canonicalUrl)
    ensureMeta('property', 'og:image').setAttribute('content', ogImage)

    // Twitter
    ensureMeta('name', 'twitter:title').setAttribute('content', ogTitle)
    ensureMeta('name', 'twitter:description').setAttribute('content', description)
    ensureMeta('name', 'twitter:image').setAttribute('content', ogImage)
  }, [opts.title, opts.description, opts.path, opts.ogImage, opts.noIndex])
}
