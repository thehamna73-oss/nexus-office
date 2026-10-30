import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import OfficeScene from './OfficeScene'
import { copy, type Destination } from './config'
import { useOfficeStore } from './store'

function useOfficeSound(enabled: boolean, walking: boolean) {
  const context = useRef<AudioContext | null>(null)
  useEffect(() => {
    if (!enabled) {
      void context.current?.suspend()
      return
    }
    const audio = new AudioContext()
    context.current = audio
    void audio.resume()
    const master = audio.createGain()
    master.gain.value = 0.1
    master.connect(audio.destination)
    const hum = audio.createOscillator()
    const humGain = audio.createGain()
    hum.type = 'sine'
    hum.frequency.value = 110
    humGain.gain.value = 0.08
    hum.connect(humGain).connect(master)
    hum.start()
    const shimmer = audio.createOscillator()
    const shimmerGain = audio.createGain()
    shimmer.type = 'sine'
    shimmer.frequency.value = 164.81
    shimmerGain.gain.value = 0.018
    shimmer.connect(shimmerGain).connect(master)
    shimmer.start()
    let footstepTimer: number | undefined
    if (walking) {
      footstepTimer = window.setInterval(() => {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(115, audio.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(65, audio.currentTime + 0.09)
        gain.gain.setValueAtTime(0.026, audio.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12)
        oscillator.connect(gain).connect(master)
        oscillator.start()
        oscillator.stop(audio.currentTime + 0.13)
      }, 520)
    }
    return () => {
      if (footstepTimer) window.clearInterval(footstepTimer)
      void audio.close()
      if (context.current === audio) context.current = null
    }
  }, [enabled, walking])
}

function VisitCard({ eyebrow, title, subtitle, children, className = '' }: {
  eyebrow: string; title: string; subtitle: string; children?: React.ReactNode; className?: string
}) {
  return <motion.section
    className={`visit-card ${className}`}
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.985 }}
    transition={{ type: 'spring', stiffness: 260, damping: 27 }}
  >
    <div className="card-eyebrow"><span className="eyebrow-dot" />{eyebrow}</div>
    <h1>{title}</h1>
    <p>{subtitle}</p>
    {children}
  </motion.section>
}

export default function App() {
  const stage = useOfficeStore((state) => state.stage)
  const destination = useOfficeStore((state) => state.destination)
  const arrived = useOfficeStore((state) => state.arrived)
  const soundOn = useOfficeStore((state) => state.soundOn)
  const toggleSound = useOfficeStore((state) => state.toggleSound)
  const guideTo = useOfficeStore((state) => state.guideTo)
  const restart = useOfficeStore((state) => state.restart)
  const finish = useOfficeStore((state) => state.finish)
  const [menuOpen, setMenuOpen] = useState(true)
  const [finaleVisible, setFinaleVisible] = useState(false)

  useOfficeSound(soundOn, stage === 'guided' && !arrived)

  useEffect(() => {
    if (stage !== 'guided' || !arrived) return
    const timer = window.setTimeout(finish, 1600)
    return () => window.clearTimeout(timer)
  }, [stage, arrived, finish])

  useEffect(() => {
    if (stage !== 'finale') {
      setFinaleVisible(false)
      return
    }
    const timer = window.setTimeout(() => setFinaleVisible(true), 1000)
    return () => window.clearTimeout(timer)
  }, [stage])

  const restartVisit = () => {
    setMenuOpen(true)
    setFinaleVisible(false)
    restart()
  }
  const handleBottomAction = () => {
    if (stage === 'reception') {
      setMenuOpen((open) => !open)
      return
    }
    restartVisit()
  }
  const selectDestination = (name: Destination) => {
    setMenuOpen(false)
    guideTo(name)
  }

  return <main className="experience">
    <OfficeScene />
    <div className="top-brand" aria-label={copy.company}>
      <span className="brand-mark">N</span>
      <span>{copy.company}</span>
      <i />
      <small>THE STUDIO</small>
    </div>
    <div className="top-status"><span className="status-dot" /> A LITTLE LOOK AROUND</div>

    <AnimatePresence mode="wait">
      {stage === 'intro' && <VisitCard key="welcome" className="welcome-card" eyebrow={copy.welcomeEyebrow} title={copy.welcomeTitle} subtitle={copy.welcomeSubtitle}>
        <div className="welcome-foot"><span className="walking-indicator"><i /><i /><i /></span><span>Take a breath. You’re right on time.</span></div>
      </VisitCard>}
      {stage === 'reception' && menuOpen && <VisitCard key="reception" className="reception-card" eyebrow={copy.receptionistEyebrow} title={copy.receptionistTitle} subtitle={copy.receptionistSubtitle}>
        <div className="room-grid">
          {copy.options.map((option) => <button key={option} className="room-option" onClick={() => selectDestination(option)}>
            <span>{option}</span><b>↗</b>
          </button>)}
        </div>
        <button className="boss-link" onClick={() => selectDestination(copy.boss)}>
          <span><strong>Meet the boss</strong><small>Knock first</small></span><b>↗</b>
        </button>
        <button className="explore-link" onClick={() => setMenuOpen(false)}>Just exploring <span>→</span></button>
        <div className="speech-tail" />
      </VisitCard>}
      {stage === 'guided' && <VisitCard key="guided" className="guided-card" eyebrow={arrived ? 'AT YOUR DESTINATION' : copy.visitEyebrow} title={destination} subtitle={arrived ? copy.arrive : `${copy.follow} ${destination}.`}>
        {!arrived && <div className="route-progress"><span className="route-line"><i /></span><small>FOLLOW ALONG</small></div>}
      </VisitCard>}
    </AnimatePresence>

    <AnimatePresence>
      {stage === 'finale' && finaleVisible && <motion.div className="finale-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.15 }}>
        <motion.div className="finale-lockup" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35, duration: 0.8 }}>
          <div className="finale-mark">N</div>
          <span>{copy.company}</span>
          <p>{copy.finaleTagline}</p>
          <div className="finale-rule" />
          <small>GOOD WORK STARTS HERE</small>
        </motion.div>
      </motion.div>}
    </AnimatePresence>

    {stage === 'reception' && !menuOpen && <button className="quiet-hint" onClick={() => setMenuOpen(true)}>Back to reception <span>↗</span></button>}
    <div className="bottom-controls">
      <button className="utility-button sound-button" onClick={toggleSound} aria-label={soundOn ? 'Mute ambience' : 'Enable ambience'}>
        <span className="sound-glyph">{soundOn ? '♫' : '♪'}</span><span>{soundOn ? 'SOUND ON' : 'SOUND OFF'}</span><i className={soundOn ? 'toggle enabled' : 'toggle'} />
      </button>
      <button className="restart-button" onClick={handleBottomAction}><span>↻</span> {stage === 'reception' ? 'Menu' : 'Restart'}</button>
      <div className="walk-hint"><span className="key-cap">W</span><span className="key-cap">A</span><span className="key-cap">S</span><span className="key-cap">D</span><span>TO EXPLORE</span></div>
    </div>
    <div className="scene-caption"><span className="caption-line" /> A PLACE TO DO GREAT WORK</div>
  </main>
}
