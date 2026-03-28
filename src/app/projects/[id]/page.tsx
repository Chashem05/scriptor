'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Character = { id: string; name: string; voice: string; color: string; _count?: { lines: number } }
type Line = { id: string; lineNumber: number; type: string; content: string; character: Character | null }

const VOICES = [
  { id: 'josh', name: 'Josh', style: 'Male, Deep' },
  { id: 'adam', name: 'Adam', style: 'Male, Deep' },
  { id: 'antoni', name: 'Antoni', style: 'Male, Warm' },
  { id: 'arnold', name: 'Arnold', style: 'Male, Crisp' },
  { id: 'sam', name: 'Sam', style: 'Male, Raspy' },
  { id: 'rachel', name: 'Rachel', style: 'Female, Calm' },
  { id: 'domi', name: 'Domi', style: 'Female, Strong' },
  { id: 'bella', name: 'Bella', style: 'Female, Soft' },
]

export default function ProjectPage() {
  const { id } = useParams() as { id: string }
  const [tab, setTab] = useState<'upload' | 'parse' | 'voices' | 'mixer'>('upload')
  const [script, setScript] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [myRole, setMyRole] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentLine, setCurrentLine] = useState(-1)
  const [muted, setMuted] = useState<Set<string>>(new Set())
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [ttsReady, setTtsReady] = useState(false)
  const playingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => { loadData(); checkTTS() }, [id])

  async function checkTTS() {
    try {
      const res = await fetch('/api/tts')
      const data = await res.json()
      setTtsReady(data.configured)
    } catch { setTtsReady(false) }
  }

  async function loadData() {
    const [scriptRes, charRes, linesRes] = await Promise.all([
      fetch(`/api/projects/${id}/script`),
      fetch(`/api/projects/${id}/characters`),
      fetch(`/api/projects/${id}/lines`)
    ])
    const scriptData = await scriptRes.json()
    const charData = await charRes.json()
    const linesData = await linesRes.json()
    
    if (scriptData?.content) setScript(scriptData.content)
    if (Array.isArray(charData)) {
      setCharacters(charData)
      setVolumes(Object.fromEntries(charData.map((c: Character) => [c.id, 80])))
    }
    if (Array.isArray(linesData)) setLines(linesData)
  }

  async function saveScript() {
    setLoading(true)
    await fetch(`/api/projects/${id}/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: script })
    })
    setLoading(false)
    setTab('parse')
  }

  async function parseScript() {
    setLoading(true)
    await fetch(`/api/projects/${id}/parse`, { method: 'POST' })
    await loadData()
    setLoading(false)
    setTab('voices')
  }

  async function setVoice(charId: string, voice: string) {
    await fetch(`/api/projects/${id}/characters`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: charId, voice })
    })
    setCharacters(c => c.map(x => x.id === charId ? { ...x, voice } : x))
  }

  function getVoice(v?: string) {
    return VOICES.find(x => x.id === v)?.id || 'josh'
  }

  async function speak(text: string, voice: string, volume: number): Promise<boolean> {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: getVoice(voice) })
      })
      
      if (!res.ok) {
        const err = await res.json()
        setMessage(`TTS Error: ${err.error}`)
        return false
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.volume = volume / 100
      audioRef.current = audio
      
      return new Promise(resolve => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(true) }
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(false) }
        audio.play().catch(() => resolve(false))
      })
    } catch (e) {
      console.error(e)
      return false
    }
  }

  async function play() {
    if (!ttsReady || lines.length === 0) {
      setMessage('ElevenLabs not configured. Add ELEVENLABS_API_KEY in Render.')
      return
    }
    setIsPlaying(true)
    setMessage('')
    playingRef.current = true

    for (let i = 0; i < lines.length; i++) {
      if (!playingRef.current) break
      setCurrentLine(i)
      const line = lines[i]
      const charId = line.character?.id

      if (line.type === 'direction' || (charId && (muted.has(charId) || charId === myRole))) {
        await new Promise(r => setTimeout(r, 500))
        continue
      }

      const char = characters.find(c => c.id === charId)
      await speak(line.content, char?.voice || 'josh', volumes[charId || ''] || 80)
      await new Promise(r => setTimeout(r, 200))
    }

    setIsPlaying(false)
    setCurrentLine(-1)
    playingRef.current = false
  }

  function stop() {
    playingRef.current = false
    setIsPlaying(false)
    setCurrentLine(-1)
    audioRef.current?.pause()
  }

  async function testVoice() {
    setMessage('Testing ElevenLabs...')
    const success = await speak("Hello! This is a test of ElevenLabs voice.", 'josh', 80)
    setMessage(success ? '✓ ElevenLabs working!' : '✗ ElevenLabs failed')
  }

  const dialogueCount = lines.filter(l => l.type === 'dialogue').length
  const directionCount = lines.filter(l => l.type === 'direction').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">← Back</Link>
        <h1 className="text-2xl font-bold mt-2">Scriptor Rehearsal</h1>
        <p className="text-sm text-gray-500 mt-1">
          {ttsReady ? '✓ ElevenLabs connected' : '⚠️ Add ELEVENLABS_API_KEY in Render'}
        </p>
        <div className="flex gap-8 mt-4 text-center">
          <div><div className="text-xs text-gray-500">Characters</div><div className="text-2xl font-bold">{characters.length}</div></div>
          <div><div className="text-xs text-gray-500">Dialogue</div><div className="text-2xl font-bold">{dialogueCount}</div></div>
          <div><div className="text-xs text-gray-500">Directions</div><div className="text-2xl font-bold">{directionCount}</div></div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b flex">
        {(['upload', 'parse', 'voices', 'mixer'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-6 py-3 text-sm capitalize ${tab === t ? 'border-b-2 border-gray-800 font-medium' : 'text-gray-500'}`}>
            {t === 'voices' ? 'Voice Assignment' : t}
          </button>
        ))}
      </nav>

      {/* Message */}
      {message && (
        <div className={`max-w-6xl mx-auto mt-4 px-4`}>
          <div className={`p-3 rounded ${message.includes('✗') || message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-6">
        {/* Upload */}
        {tab === 'upload' && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Upload Script</h2>
            <p className="text-sm text-gray-500 mb-4">Format: CHARACTER: Dialogue</p>
            <textarea value={script} onChange={e => setScript(e.target.value)} placeholder="ROMEO: But soft, what light..." className="w-full h-72 p-4 border rounded font-mono text-sm" />
            <button onClick={saveScript} disabled={loading || !script.trim()} className="mt-4 px-6 py-2 bg-gray-800 text-white rounded disabled:opacity-50">
              Save & Continue
            </button>
          </div>
        )}

        {/* Parse */}
        {tab === 'parse' && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Parse Script</h2>
            <pre className="bg-gray-50 p-4 rounded text-sm max-h-60 overflow-auto mb-4">{script || 'No script yet'}</pre>
            <button onClick={parseScript} disabled={loading || !script} className="px-6 py-2 bg-gray-800 text-white rounded disabled:opacity-50">
              {loading ? 'Parsing...' : 'Parse Script'}
            </button>
          </div>
        )}

        {/* Voices */}
        {tab === 'voices' && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Voice Assignment (ElevenLabs)</h2>
            {characters.map(c => (
              <div key={c.id} className="flex items-center gap-4 p-4 border-b">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                <div className="flex-1 font-medium">{c.name}</div>
                <select value={getVoice(c.voice)} onChange={e => setVoice(c.id, e.target.value)} className="border rounded px-3 py-2">
                  {VOICES.map(v => <option key={v.id} value={v.id}>{v.name} - {v.style}</option>)}
                </select>
              </div>
            ))}
            <button onClick={() => setTab('mixer')} className="mt-4 px-6 py-2 bg-gray-800 text-white rounded">Continue</button>
          </div>
        )}

        {/* Mixer */}
        {tab === 'mixer' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Player */}
            <div className="col-span-2 bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Rehearsal Player</h3>
                <select value={myRole} onChange={e => setMyRole(e.target.value)} className="border rounded px-2 py-1 text-sm">
                  <option value="">My Role: None</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mb-4">
                <button onClick={testVoice} className="px-4 py-2 border rounded text-sm">🔊 Test</button>
                <button onClick={play} disabled={!ttsReady || isPlaying} className="px-4 py-2 bg-gray-800 text-white rounded text-sm disabled:opacity-50">▶ Play</button>
                <button onClick={stop} className="px-4 py-2 border rounded text-sm">Stop</button>
              </div>
              <div className="space-y-2 max-h-96 overflow-auto">
                {lines.map((line, i) => (
                  <div key={line.id} className={`p-3 rounded ${i === currentLine ? 'bg-blue-900 text-white' : 'bg-gray-50'} ${line.character && (muted.has(line.character.id) || line.character.id === myRole) ? 'opacity-40' : ''}`}>
                    {line.character && <span className="text-xs px-2 py-0.5 rounded text-white mr-2" style={{ backgroundColor: line.character.color }}>{line.character.name}</span>}
                    <span className={line.type === 'direction' ? 'italic text-gray-500' : ''}>{line.content}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mixer */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold mb-4">Mixer</h3>
              {characters.map(c => (
                <div key={c.id} className="mb-4 pb-4 border-b">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{c.name}</span>
                    <button onClick={() => setMuted(m => { const n = new Set(m); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })} className={`px-2 py-1 rounded text-xs ${muted.has(c.id) ? 'bg-red-500 text-white' : 'bg-gray-100'}`}>
                      {muted.has(c.id) ? 'Muted' : 'Mute'}
                    </button>
                  </div>
                  <input type="range" min="0" max="100" value={volumes[c.id] || 80} onChange={e => setVolumes(v => ({ ...v, [c.id]: +e.target.value }))} className="w-full" />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
