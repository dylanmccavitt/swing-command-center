import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const alpacaKeyId =
    env.ALPACA_MARKET_DATA_API_KEY_ID || env.APCA_API_KEY_ID || ''
  const alpacaSecret =
    env.ALPACA_MARKET_DATA_SECRET_KEY || env.APCA_API_SECRET_KEY || ''
  const alpacaProxyReady = Boolean(alpacaKeyId && alpacaSecret)

  return {
    plugins: [react()],
    define: {
      __ALPACA_MARKET_DATA_PROXY_READY__: JSON.stringify(alpacaProxyReady),
    },
    server: {
      proxy: {
        '/api/market-data/alpaca': {
          target: 'https://data.alpaca.markets',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/market-data\/alpaca/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (alpacaKeyId) {
                proxyReq.setHeader('APCA-API-KEY-ID', alpacaKeyId)
              }

              if (alpacaSecret) {
                proxyReq.setHeader('APCA-API-SECRET-KEY', alpacaSecret)
              }
            })
          },
        },
      },
    },
    test: {
      exclude: [...configDefaults.exclude, '.worktrees/**'],
    },
  }
})
