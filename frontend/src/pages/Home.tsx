import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AnalyticsSummary } from '../api/types'
import { pct } from '../lib/format'
import { StatTile } from '../components/StatTile'

const SLIDES = ['/image1.jpg', '/image2.jpg']
const INTERVAL = 5000

function greeting(d: Date = new Date()): string {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Home() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [hello, setHello] = useState(greeting())
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.analytics().then(setSummary).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setInterval(() => setHello(greeting()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Auto-advance carousel
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length)
    }, INTERVAL)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function goTo(idx: number) {
    setCurrent(idx)
    // Reset timer so it doesn't fire immediately after manual navigation
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length)
    }, INTERVAL)
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div>
      {/* Banner hero — carousel */}
      <section
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', minHeight: 360,
          display: 'flex', alignItems: 'center',
          boxShadow: '0 24px 60px -30px rgba(0,0,0,0.9)',
        }}
      >
        {/* Carousel images — crossfade */}
        {SLIDES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center 35%',
              filter: 'contrast(1.04) saturate(1.06)',
              opacity: i === current ? 1 : 0,
              transition: 'opacity 1s ease',
            }}
          />
        ))}

        {/* legibility gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(9,12,20,0.86) 0%, rgba(9,12,20,0.60) 44%, rgba(9,12,20,0.22) 72%, rgba(9,12,20,0) 100%)',
        }} />
        {/* accent tint */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(120deg, rgba(57,135,229,0.20), transparent 45%)',
          mixBlendMode: 'screen',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', padding: '32px 40px', maxWidth: 620 }}>
          <div className="label-caps" style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'rgba(255,255,255,0.85)' }}>
            <span className="dot" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--good)', boxShadow: '0 0 8px var(--good)' }} />
            {today}
          </div>
          <h1 style={{ margin: '12px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, color: '#fff' }}>
            {hello} — welcome to <span className="spark-logo" style={{ fontSize: 32, letterSpacing: '-0.01em' }}>SPARK</span>
          </h1>
          <div style={{ margin: '7px 0 0', fontSize: 13, fontWeight: 500, letterSpacing: '.02em', color: 'rgba(255,255,255,0.72)' }}>
            Smart Platform for Automotive Repair Knowledge
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, maxWidth: 480, color: 'rgba(255,255,255,0.88)' }}>
            Every warranty claim, decided with evidence.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 34, flexWrap: 'wrap' }}>
            <Link to="/claims" className="btn btn-primary" style={{ padding: '11px 20px', fontSize: 14, textDecoration: 'none' }}>
              Review claims →
            </Link>
            <Link to="/analytics" className="btn" style={{ padding: '11px 20px', fontSize: 14, textDecoration: 'none' }}>
              View analytics
            </Link>
          </div>
        </div>

        {/* Dot indicators */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 8,
        }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === current ? 22 : 8,
                height: 8, borderRadius: 999, border: 'none', padding: 0,
                background: i === current ? '#fff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </section>

      {/* At-a-glance */}
      <div style={{ marginTop: 24 }}>
        <div className="label-caps" style={{ marginBottom: 12 }}>At a glance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <StatTile label="Total claims" value={summary ? summary.totals.claims : '—'} hint="all-time submitted" />
          <StatTile label="Needs review" value={summary ? summary.open_reviews : '—'} hint="awaiting a human" accent="var(--warning)" />
          <StatTile label="Auto-approval rate" value={summary ? pct(summary.auto_approval_rate) : '—'} hint="decided without a human" accent="var(--good)" />
          <StatTile label="Anomalies flagged" value={summary ? summary.anomaly_count : '—'} hint="data inconsistencies" accent="var(--serious)" />
        </div>
      </div>
    </div>
  )
}
