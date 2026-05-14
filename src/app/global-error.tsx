'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-TW">
      <body
        style={{
          backgroundColor: '#08080f',
          color: '#f0f0ff',
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        <div>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</p>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            應用程式發生錯誤
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#6b6b9a', marginBottom: '1.5rem' }}>
            {error.message || '請重新整理頁面'}
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: '#e91e8c',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.625rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重新整理
          </button>
        </div>
      </body>
    </html>
  )
}
