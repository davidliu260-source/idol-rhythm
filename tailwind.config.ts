import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#08080f',
        card: '#0f0f1e',
        'card-border': '#1e1e36',
        primary: '#e91e8c',
        'primary-dim': 'rgba(233,30,140,0.15)',
        violet: '#8b5cf6',
        'text-base': '#f0f0ff',
        muted: '#6b6b9a',
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
