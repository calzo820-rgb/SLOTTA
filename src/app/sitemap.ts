import type { MetadataRoute } from 'next'

const publicRoutes = ['', '/tester', '/privacy', '/terms', '/contact']

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return publicRoutes.map(route => ({
    url: `https://www.slotta.it${route}`,
    lastModified,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.6,
  }))
}
