export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#0070f3' }}>🚀 Next.js on SpinForge</h1>
      <p>This Next.js app was deployed using the SpinForge API!</p>
      <p>Time: {new Date().toISOString()}</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Features:</h2>
        <ul>
          <li>✅ Server-side rendering</li>
          <li>✅ API routes</li>
          <li>✅ Dynamic routing</li>
          <li>✅ Automatic optimization</li>
        </ul>
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <a href="/api/hello" style={{ color: '#0070f3', textDecoration: 'underline' }}>
          Test API Route →
        </a>
      </div>
    </main>
  )
}