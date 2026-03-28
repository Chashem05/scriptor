'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Character = { 
  id: string
  name: string
  voice: string
  color: string
  stability?: number
  similarity?: number
  style?: number
  speed?: number
  _count?: { lines: number } 
}
type Line = { id: string; lineNumber: number; type: string; content: string; character: Character | null }
type Voice = { id: string; name: string; style: string }

export default function ProjectPage() {
  const { id } = useParams() as { id: string }
  const [tab, setTab] = useState<'upload' | 'parse' | 'voices' | 'mixer'>('upload')
  const [script, setScript] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [myRole, setMyRole] = useState('')
  const [hideMyLines, setHideMyLines] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [currentLine, setCurrentLine] = useState(-1)
  const [muted, setMuted] = useState<Set<string>>(new Set())
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [charSettings, setCharSettings] = useState<Record<string, { stability: number; similarity: number; style: number; speed: number }>>({})
  const [ttsReady, setTtsReady] = useState(false)
  const playingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { loadData(); loadVoices() }, [id])

  useEffect(() => {
    if (currentLine >= 0 && lines[currentLine]) {
      const lineEl = lineRefs.current[lines[currentLine].id]
      const container = scrollContainerRef.current
      if (lineEl && container) {
        const containerRect = container.getBoundingClientRect()
        const lineRect = lineEl.getBoundingClientRect()
        const offset = lineRect.top - containerRect.top - containerRect.height / 3
        container.scrollBy({ top: offset, behavior: 'smooth' })
      }
    }
  }, [currentLine, lines])

  async function loadVoices() {
    try {
      const res = await fetch('/api/tts')
      const data = await res.json()
      setTtsReady(data.configured)
      if (data.voices) setVoices(data.voices)
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
      const settings: Record<string, { stability: number; similarity: number; style: number; speed: number }> = {}
      charData.forEach((c: Character) => {
        settings[c.id] = {
          stability: c.stability ?? 0.5,
          similarity: c.similarity ?? 0.75,
          style: c.style ?? 0.0,
          speed: c.speed ?? 1.0
        }
      })
      setCharSettings(settings)
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

  function updateCharSetting(charId: string, key: string, value: number) {
    setCharSettings(prev => ({
      ...prev,
      [charId]: { ...prev[charId], [key]: value }
    }))
  }

  async function speak(text: string, voice: string, charId: string, volume: number): Promise<boolean> {
    const settings = charSettings[charId] || { stability: 0.5, similarity: 0.75, style: 0, speed: 1 }
    
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          voice,
          stability: settings.stability,
          similarity: settings.similarity,
          style: settings.style,
          speed: settings.speed,
        })
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

  async function playFromLine(startIndex: number) {
    if (!ttsReady || lines.length === 0) {
      setMessage('ElevenLabs not configured. Add ELEVENLABS_API_KEY in Render.')
      return
    }
    setIsPlaying(true)
    setMessage('')
    playingRef.current = true

    for (let i = startIndex; i < lines.length; i++) {
      if (!playingRef.current) break
      setCurrentLine(i)
      const line = lines[i]
      const charId = line.character?.id

      if (line.type === 'direction') {
        await new Promise(r => setTimeout(r, 800))
        continue
      }

      const char = characters.find(c => c.id === charId)
      const isMuted = charId && (muted.has(charId) || charId === myRole)
      const effectiveVolume = isMuted ? 0 : (volumes[charId || ''] || 80)
      
      await speak(line.content, char?.voice || 'josh', charId || '', effectiveVolume)
      await new Promise(r => setTimeout(r, 200))
    }

    setIsPlaying(false)
    setCurrentLine(-1)
    playingRef.current = false
  }

  function play() {
    playFromLine(currentLine >= 0 ? currentLine : 0)
  }

  function stop() {
    playingRef.current = false
    setIsPlaying(false)
    audioRef.current?.pause()
  }

  function stepBackward() {
    stop()
    setCurrentLine(prev => Math.max(0, prev - 1))
  }

  function stepForward() {
    stop()
    setCurrentLine(prev => Math.min(lines.length - 1, prev + 1))
  }

  async function exportMP3() {
    if (!ttsReady || lines.length === 0) {
      setMessage('Cannot export - no lines or ElevenLabs not configured')
      return
    }

    setIsExporting(true)
    setExportProgress('Preparing export...')

    const exportLines = lines.map(l => {
      const charId = l.character?.id
      const char = characters.find(c => c.id === charId)
      const isMuted = charId ? (muted.has(charId) || charId === myRole) : false
      const settings = charSettings[charId || ''] || { stability: 0.5, similarity: 0.75, style: 0, speed: 1 }
      
      return {
        content: l.content,
        type: l.type,
        characterId: charId || null,
        voice: char?.voice || 'josh',
        isMuted,
        settings
      }
    })

    const spokenLines = exportLines.filter(l => l.type === 'dialogue' && !l.isMuted).length
    const silentLines = exportLines.filter(l => l.type === 'dialogue' && l.isMuted).length
    setExportProgress(`Generating ${spokenLines} spoken + ${silentLines} silent lines...`)

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: exportLines })
      })

      if (!res.ok) {
        const err = await res.json()
        setMessage(`Export failed: ${err.error}`)
        setIsExporting(false)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = 'rehearsal-export.mp3'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setMessage(`✓ MP3 exported! ${spokenLines} voiced lines, ${silentLines} silent cues for your lines`)
    } catch (e) {
      console.error(e)
      setMessage('Export failed - check console')
    }

    setIsExporting(false)
    setExportProgress('')
  }

  async function testVoice(charId: string) {
    const char = characters.find(c => c.id === charId)
    if (!char) return
    setMessage(`Testing ${char.name}...`)
    const success = await speak("Hello! This is a test of my voice.", char.voice || 'josh', charId, 80)
    setMessage(success ? `✓ ${char.name} sounds great!` : '✗ Voice test failed')
  }

  const dialogueCount = lines.filter(l => l.type === 'dialogue').length
  const directionCount = lines.filter(l => l.type === 'direction').length
  const mutedCount = lines.filter(l => {
    if (l.type !== 'dialogue') return false
    const charId = l.character?.id
    if (!charId) return false
    return muted.has(charId) || charId === myRole
  }).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">← Back</Link>
        <h1 className="text-2xl font-bold mt-2">Scriptor Rehearsal</h1>
        <p className="text-sm text-gray-500 mt-1">
          {ttsReady ? '✓ ElevenLabs connected (Paid)' : '⚠️ Add ELEVENLABS_API_KEY in Render'}
        </p>
        <div className="flex gap-8 mt-4 text-center">
          <div><div className="text-xs text-gray-500">Characters</div><div className="text-2xl font-bold">{characters.length}</div></div>
          <div><div className="text-xs text-gray-500">Dialogue</div><div className="text-2xl font-bold">{dialogueCount}</div></div>
          <div><div className="text-xs text-gray-500">Directions</div><div className="text-2xl font-bold">{directionCount}</div></div>
          <div><div className="text-xs text-gray-500">Voices</div><div className="text-2xl font-bold">{voices.length}</div></div>
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
        <div className="max-w-6xl mx-auto mt-4 px-4">
          <div className={`p-3 rounded ${message.includes('✗') || message.includes('Error') || message.includes('failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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
            <h2 className="text-lg font-semibold mb-2">Voice Assignment</h2>
            <p className="text-sm text-gray-500 mb-4">Choose a voice and fine-tune the settings for each character</p>
            
            {characters.map(c => {
              const settings = charSettings[c.id] || { stability: 0.5, similarity: 0.75, style: 0, speed: 1 }
              return (
                <div key={c.id} className="p-4 border rounded-lg mb-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} />
                    <div className="flex-1 font-semibold text-lg">{c.name}</div>
                    <button onClick={() => testVoice(c.id)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
                      🔊 Test
                    </button>
                  </div>
                  
                  <div className="mb-4">
                    <label className="text-sm text-gray-600 block mb-1">Voice</label>
                    <select 
                      value={c.voice || 'josh'} 
                      onChange={e => setVoice(c.id, e.target.value)} 
                      className="w-full border rounded px-3 py-2"
                    >
                      <optgroup label="Male Voices">
                        {voices.filter(v => ['adam','antoni','arnold','brian','callum','charlie','clyde','daniel','dave','ethan','fin','george','harry','james','jeremy','josh','liam','marcus','michael','patrick','sam','thomas'].includes(v.id)).map(v => (
                          <option key={v.id} value={v.id}>{v.name} - {v.style}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Female Voices">
                        {voices.filter(v => ['alice','aria','bella','charlotte','domi','dorothy','elli','emily','freya','gigi','glinda','grace','jessie','lily','matilda','mimi','nicole','rachel','serena'].includes(v.id)).map(v => (
                          <option key={v.id} value={v.id}>{v.name} - {v.style}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 flex justify-between">
                        <span>Stability</span>
                        <span className="text-gray-400">{Math.round(settings.stability * 100)}%</span>
                      </label>
                      <input 
                        type="range" min="0" max="100" 
                        value={settings.stability * 100} 
                        onChange={e => updateCharSetting(c.id, 'stability', +e.target.value / 100)}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-400">Lower = more emotional, Higher = more consistent</p>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-600 flex justify-between">
                        <span>Clarity + Similarity</span>
                        <span className="text-gray-400">{Math.round(settings.similarity * 100)}%</span>
                      </label>
                      <input 
                        type="range" min="0" max="100" 
                        value={settings.similarity * 100} 
                        onChange={e => updateCharSetting(c.id, 'similarity', +e.target.value / 100)}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-400">How closely to match original voice</p>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-600 flex justify-between">
                        <span>Style Exaggeration</span>
                        <span className="text-gray-400">{Math.round(settings.style * 100)}%</span>
                      </label>
                      <input 
                        type="range" min="0" max="100" 
                        value={settings.style * 100} 
                        onChange={e => updateCharSetting(c.id, 'style', +e.target.value / 100)}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-400">Amplify the speaker's style</p>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-600 flex justify-between">
                        <span>Speed</span>
                        <span className="text-gray-400">{settings.speed.toFixed(1)}x</span>
                      </label>
                      <input 
                        type="range" min="70" max="120" 
                        value={settings.speed * 100} 
                        onChange={e => updateCharSetting(c.id, 'speed', +e.target.value / 100)}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-400">0.7x (slow) to 1.2x (fast)</p>
                    </div>
                  </div>
                </div>
              )
            })}
            
            <button onClick={() => setTab('mixer')} className="mt-4 px-6 py-2 bg-gray-800 text-white rounded">
              Continue to Mixer
            </button>
          </div>
        )}

        {/* Mixer */}
        {tab === 'mixer' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Player */}
            <div className="col-span-2 bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Rehearsal Player</h3>
                <div className="flex items-center gap-2">
                  <select value={myRole} onChange={e => setMyRole(e.target.value)} className="border rounded px-2 py-1 text-sm">
                    <option value="">My Role: None</option>
                    {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button
                    onClick={() => setHideMyLines(!hideMyLines)}
                    disabled={!myRole}
                    className={`px-3 py-1 rounded text-sm ${hideMyLines ? 'bg-purple-600 text-white' : 'bg-gray-100'} ${!myRole ? 'opacity-50' : ''}`}
                  >
                    {hideMyLines ? '👁️ Show Lines' : '🙈 Hide My Lines'}
                  </button>
                </div>
              </div>
              
              {/* Playback Controls */}
              <div className="flex gap-2 mb-4 flex-wrap items-center">
                <button 
                  onClick={stepBackward} 
                  disabled={currentLine <= 0}
                  className="px-3 py-2 border rounded text-sm disabled:opacity-30 hover:bg-gray-50"
                  title="Step Backward"
                >
                  ⏮️ ←
                </button>
                <button onClick={play} disabled={!ttsReady || isPlaying} className="px-4 py-2 bg-gray-800 text-white rounded text-sm disabled:opacity-50">
                  ▶ Play
                </button>
                <button onClick={stop} disabled={!isPlaying} className="px-4 py-2 border rounded text-sm disabled:opacity-30">
                  ⏹ Stop
                </button>
                <button 
                  onClick={stepForward} 
                  disabled={currentLine >= lines.length - 1}
                  className="px-3 py-2 border rounded text-sm disabled:opacity-30 hover:bg-gray-50"
                  title="Step Forward"
                >
                  → ⏭️
                </button>
                <span className="text-sm text-gray-500 ml-2">
                  Line {currentLine >= 0 ? currentLine + 1 : '-'} / {lines.length}
                </span>
              </div>

              {/* Export Controls */}
              <div className="flex gap-2 mb-4 flex-wrap items-center">
                <button 
                  onClick={exportMP3} 
                  disabled={!ttsReady || isExporting || lines.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                >
                  {isExporting ? '⏳ Exporting...' : '💾 Export MP3'}
                </button>
                {exportProgress && <span className="text-sm text-gray-500">{exportProgress}</span>}
              </div>
              
              <p className="text-xs text-gray-500 mb-2">
                Export: {dialogueCount - mutedCount} voiced + {mutedCount} silent pauses
              </p>
              
              <div 
                ref={scrollContainerRef}
                className="space-y-2 max-h-[500px] overflow-auto scroll-smooth"
              >
                {lines.map((line, i) => {
                  const isMyLine = line.character?.id === myRole
                  const isMuted = line.character && (muted.has(line.character.id) || isMyLine)
                  const shouldHideText = isMyLine && hideMyLines && line.type === 'dialogue'
                  
                  return (
                    <div 
                      key={line.id} 
                      ref={el => { lineRefs.current[line.id] = el }}
                      onClick={() => { stop(); setCurrentLine(i) }}
                      className={`p-3 rounded transition-all duration-300 cursor-pointer hover:ring-1 hover:ring-gray-300 ${
                        i === currentLine 
                          ? 'bg-yellow-100 ring-2 ring-yellow-400 scale-[1.01]' 
                          : 'bg-gray-50'
                      } ${isMuted ? 'border-l-4 border-orange-400' : ''} ${isMyLine ? 'bg-orange-50' : ''}`}
                    >
                      {line.character && (
                        <span className="text-xs px-2 py-0.5 rounded text-white mr-2" style={{ backgroundColor: line.character.color }}>
                          {line.character.name}
                        </span>
                      )}
                      {shouldHideText ? (
                        <span className="text-gray-400 italic">[ Your line - hidden ]</span>
                      ) : (
                        <span className={line.type === 'direction' ? 'italic text-gray-500' : ''}>
                          {line.content}
                        </span>
                      )}
                      {isMyLine && !shouldHideText && <span className="ml-2 text-xs text-orange-600">(your cue)</span>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mixer */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold mb-1">Mixer</h3>
              <p className="text-xs text-gray-500 mb-4">Muted = silent pause (keeps timing)</p>
              {characters.map(c => {
                const isMuted = muted.has(c.id) || c.id === myRole
                return (
                  <div key={c.id} className="mb-4 pb-4 border-b">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{voices.find(v => v.id === c.voice)?.name || 'Josh'}</span>
                      </div>
                      <button 
                        onClick={() => setMuted(m => { const n = new Set(m); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })} 
                        className={`px-2 py-1 rounded text-xs ${muted.has(c.id) ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
                      >
                        {muted.has(c.id) ? 'Muted' : 'Mute'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{isMuted ? '🔇' : '🔊'}</span>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={isMuted ? 0 : (volumes[c.id] || 80)} 
                        onChange={e => setVolumes(v => ({ ...v, [c.id]: +e.target.value }))} 
                        disabled={isMuted}
                        className="flex-1" 
                      />
                      <span className="text-xs w-8">{isMuted ? '0' : (volumes[c.id] || 80)}%</span>
                    </div>
                    {c.id === myRole && <p className="text-xs text-orange-600 mt-1">Your role</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
