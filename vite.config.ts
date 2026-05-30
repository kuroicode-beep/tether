import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const SW_SOURCE = resolve('public/firebase-messaging-sw.js')

// SW 파일의 __VITE_FIREBASE_*__ 플레이스홀더를 env 값으로 치환한다
function injectSwEnv(content: string, env: Record<string, string>): string {
  return content
    .replaceAll('__VITE_FIREBASE_API_KEY__', env.VITE_FIREBASE_API_KEY ?? '')
    .replaceAll('__VITE_FIREBASE_AUTH_DOMAIN__', env.VITE_FIREBASE_AUTH_DOMAIN ?? '')
    .replaceAll('__VITE_FIREBASE_PROJECT_ID__', env.VITE_FIREBASE_PROJECT_ID ?? '')
    .replaceAll('__VITE_FIREBASE_STORAGE_BUCKET__', env.VITE_FIREBASE_STORAGE_BUCKET ?? '')
    .replaceAll('__VITE_FIREBASE_MESSAGING_SENDER_ID__', env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '')
    .replaceAll('__VITE_FIREBASE_APP_ID__', env.VITE_FIREBASE_APP_ID ?? '')
}

// 빌드·개발 서버 모두에서 FCM SW에 Firebase 설정을 주입한다
function injectSwEnvPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    name: 'inject-sw-env',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/firebase-messaging-sw.js') {
          next()
          return
        }
        try {
          const raw = readFileSync(SW_SOURCE, 'utf-8')
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.end(injectSwEnv(raw, env))
        } catch (error) {
          next(error)
        }
      })
    },
    closeBundle() {
      const swPath = resolve('dist/firebase-messaging-sw.js')
      if (!existsSync(swPath)) return
      const sw = readFileSync(swPath, 'utf-8')
      writeFileSync(swPath, injectSwEnv(sw, env))
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png', 'firebase-messaging-sw.js'],
      manifest: {
        name: 'Tether',
        short_name: 'Tether',
        description: '우리만의 공간',
        start_url: '/',
        display: 'standalone',
        background_color: '#EEE9DC',
        theme_color: '#4A7B5F',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // FCM background handler를 PWA SW(/sw.js)에 통합 — 별도 scope 충돌 방지 (#22 Codex)
        importScripts: ['firebase-messaging-sw.js'],
      }
    }),
    injectSwEnvPlugin(mode),
  ],
}))
