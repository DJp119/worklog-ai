import React from 'react'
import { usePageMeta } from '../../hooks/usePageMeta'

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
  image,
  url,
}) => {
  usePageMeta({
    title,
    description,
    ogImage: image,
    // Path extraction from url if provided
    path: url ? new URL(url, 'https://impactlyai.com').pathname : undefined,
  })

  return null // This is a head-only component
}