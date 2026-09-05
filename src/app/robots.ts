import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/update-password'] },
    ],
    sitemap: 'https://www.slotta.it/sitemap.xml',
    host: 'https://www.slotta.it',
  }
}
