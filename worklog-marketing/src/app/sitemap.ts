import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/content/blogPosts";

const SITE_URL = "https://impactlyai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const roleTemplates = [
    "software-engineer",
    "product-manager",
    "marketing-manager",
    "ui-designer",
    "qa-lead",
    "data-analyst",
    "engineering-manager",
    "devops-engineer",
  ];

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/templates/self-appraisal`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...roleTemplates.map((role) => ({
      url: `${SITE_URL}/templates/self-appraisal/${role}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...BLOG_POSTS.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.modifiedDate ?? post.publishedDate),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
