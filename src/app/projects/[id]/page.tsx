'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Script from 'next/script'

declare global {
  interface Window {
    puter: {
      ai: {
        txt2speech: (text: string, options?: { voice?: string; engine?: string }) => Promise<HTMLAudioElement>
      }
    }
  }
}

type Character = { id: string; name: string; voice: string; color: string; _count?: { lines: number } }
type Line = { id: string; lineNumber: number; type: string; content: string; character: Character | null }

const VOICES = [
  { id: 'Matthew', name: 'Matthew', style: 'Warm Narrator' },
  { id: 'Joanna', name: 'Joanna', style: 'Friendly' },
  { id: 'Joey', name: 'Joey', style: 'Casual' },
  { id: 'Salli', name: 'Salli', style: 'Professional' },
  { id: 'Brian', name: 'Brian', style: 'British' },
  { id: 'Amy', name: 'Amy', style: 'British Female' },
  { id: 'Stephen', name: 'Stephen', style: 'Sharp' },
  { id: 'Gregory', name: 'Gregory', style: 'Dry Comic' },
]

export default function ProjectPage() {
  const { id } = useParams() as { id: string }
  const [tab, setTab] = useState<'upload' | 'parse' | 'voices' | 'mixer'>('upload')
  const [script, setScript] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(false)
  const [myRole, setMyRole] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentLine, setCurrentLine] = useState(-1)
  const [muted, setMuted] = useState<Set<string>>(new Set())
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [puterReady, setPuterReady] = useState(false)
  const playingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => { loadData() }, [id])

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
    return VOICES.find(x => x.id === v)?.id || 'Matthew'
  }

  async function speak(text: string, voice: string, volume: number): Promise<void> {
    if (!window.puter) return
    try {
      const audio = await window.puter.ai.txt2speech(text, { voice: getVoice(voice), engine: 'neural' })
      audio.volume = volume / 100
      audioRef.current = audio
      await new Promise<void>(r => { audio.onended = () => r(); audio.play() })
    } catch (e) { console.error(e) }
  }

  async function play() {
    if (!puterReady || lines.length === 0) return
    setIsPlaying(true)
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
      await speak(line.content, char?.voice || 'Matthew', volumes[charId || ''] || 80)
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

  const dialogueCount = lines.filter(l => l.type === 'dialogue').length
  const directionCount = lines.filter(l => l.type === 'direction').length

  return (
    <div className="min-h-screen bg-gray-50">
      <Script src="https://js.puter.com/v2/" onLoad={() => setPuterReady(true)} />

      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">← Back</Link>
        <h1 className="text-2xl font-bold mt-2">Scriptor Rehearsal</h1>
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
            <h2 className="text-lg font-semibold mb-4">Voice Assignment</h2>
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
                <button onClick={play} disabled={!puterReady || isPlaying} className="px-4 py-2 bg-gray-800 text-white rounded text-sm disabled:opacity-50">▶ Play</button>
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
