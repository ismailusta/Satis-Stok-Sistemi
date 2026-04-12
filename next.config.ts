import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

/** Telefondan aynı Wi‑Fi ile test: bilgisayarınızın yerel IP’si (ör. http://192.168.1.5:3000) .env.local içinde LAN_DEV_ORIGIN olarak tanımlayın. */
const lanDevOrigins = process.env.LAN_DEV_ORIGIN
  ? [process.env.LAN_DEV_ORIGIN]
  : []

const nextConfig: NextConfig = {
  // iyzipay dinamik require(fs.readdirSync) kullanır; paketi dışarıda tut.
  serverExternalPackages: ['iyzipay'],
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...lanDevOrigins,
  ],
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
