import React, { useEffect } from 'react'

interface SEOHeadProps {
  title: string
  description: string
  image?: string
  url?: string
  type?: 'article' | 'website'
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  image = '/og-default.png',
  url = typeof window !== 'undefined' ? window.location.href : '',
  type = 'website',
}) => {
  useEffect(() => {
    // Update document title
    document.title = `${title} | ImpactlyAI`

    // Helper to set or create meta tags
    const setMeta = (name: string, content: string, property = false) => {
      let tag: HTMLMetaElement | null = document.querySelector(property
        ? `meta[property="${name}"]`
        : `meta[name="${name}"]`)

      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute(property ? 'property' : 'name', name)
        document.head.appendChild(tag)
      }

      tag.setAttribute('content', content)
    }

    // Basic SEO meta
    setMeta('title', `${title} | ImpactlyAI`)
    setMeta('description', description)

    // Open Graph / Facebook
    setMeta('og:title', title, true)
    setMeta('og:description', description, true)
    setMeta('og:image', image, true)
    setMeta('og:url', url, true)
    setMeta('og:type', type, true)
    setMeta('og:site_name', 'ImpactlyAI', true)

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)
    setMeta('twitter:image', image)

    // Cleanup on unmount
    return () => {
      // Optional: Clean up meta tags if needed
    }
  }, [title, description, image, url, type])

  return null // This is a head-only component
}