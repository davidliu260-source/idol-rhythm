import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#07070f',
        'bg-2': '#0c0c18',
        card: '#161628',
        'card-border': '#1d1d2b',
        primary: '#ff2d95',
        'primary-dim': 'rgba(255,45,149,0.15)',
        'primary-light': '#ff6bb5',
        ok: '#34d399',
        warn: '#fbbf24',
        'text-base': '#f5f5ff',
        muted: '#8b8bb0',
        'source-official': '#22c55e',
        'source-verified': '#3b82f6',
        'source-community': '#f59e0b',
        'source-unverified': '#6b7280',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans TC"',
          '"PingFang TC"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config
