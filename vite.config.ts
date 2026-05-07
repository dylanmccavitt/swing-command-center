import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadRepoEnv(mode)
  const alpacaKeyId =
    env.ALPACA_MARKET_DATA_API_KEY_ID || env.APCA_API_KEY_ID || ''
  const alpacaSecret =
    env.ALPACA_MARKET_DATA_SECRET_KEY || env.APCA_API_SECRET_KEY || ''
  const alpacaProxyReady = Boolean(alpacaKeyId && alpacaSecret)

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_ALPACA_MARKET_DATA_PROXY_READY': JSON.stringify(
        alpacaProxyReady ? 'true' : 'false',
      ),
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

function loadRepoEnv(mode: string): Record<string, string> {
  const localEnvRoot = process.cwd()
  const sharedEnvRoot = getSharedEnvRoot(localEnvRoot)

  if (!sharedEnvRoot || resolve(sharedEnvRoot) === resolve(localEnvRoot)) {
    return loadEnv(mode, localEnvRoot, '')
  }

  return {
    ...loadEnv(mode, sharedEnvRoot, ''),
    ...loadEnv(mode, localEnvRoot, ''),
  }
}

function getSharedEnvRoot(localEnvRoot: string): string | null {
  try {
    const gitCommonDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      {
        cwd: localEnvRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim()
    const repoRoot = dirname(gitCommonDir)

    return existsSync(join(repoRoot, 'package.json')) ? repoRoot : null
  } catch {
    return null
  }
}
