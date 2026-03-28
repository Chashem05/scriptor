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

type Character = {
  id: string
  name: string
  voice: string
  color: string
  voiceStyle?: string
  volume?: number
  _count?: { lines: number }
}

type Line = {
  id: string
  lineNumber: number
  type: string
  content: string
  scene?: number
  character: Character | null
}

type Scene = {
  number: number
  lines: Line[]
}

// Valid Amazon Polly voices for Puter.js (FREE)
const VOICES = [
  { id: 'Matthew', name: 'Matthew', style: 'Warm Narrator' },
  { id: 'Joanna', name: 'Joanna', style: 'Friendly Female' },
  { id: 'Joey', name: 'Joey', style: 'Casual Male' },
  { id: 'Salli', name: 'Salli', style: 'Professional Female' },
  { id: 'Kendra', name: 'Kendra', style: 'Confident Female' },
  { id: 'Kimberly', name: 'Kimberly', style: 'Energetic Female' },
  { id: 'Kevin', name: 'Kevin', style: 'Young Male' },
  { id: 'Ivy', name: 'Ivy', style: 'Young Female' },
  { id: 'Brian', name: 'Brian', style: 'British Male' },
  { id: 'Amy', name: 'Amy', style: 'British Female' },
  { id: 'Emma', name: 'Emma', style: 'British Warm' },
  { id: 'Arthur', name: 'Arthur', style: 'British Authoritative' },
  { id: 'Stephen', name: 'Stephen', style: 'Sharp Leading Man' },
  { id: 'Ruth', name: 'Ruth', style: 'Mature Female' },
  { id: 'Gregory', name: 'Gregory', style: 'Dry Comic' },
]

const DEFAULT_VOICE = 'Matthew'

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string
  
  const [tab, setTab] = useState<'upload' | 'parse' | 'voices' | 'mixer'>('upload')
  const [script, setScript] = useState('')
  const [savedScript, setSavedScript] = useState<string | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [selectedScene, setSelectedScene] = useState(1)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [myRole, setMyRole] = useState<string>('')
  const [mode, setMode] = useState<'full' | 'solo'>('full')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentLineIndex, setCurrentLineIndex] = useState(-1)
  const [mutedChars, setMutedChars] = useState<Set<string>>(new Set())
  const [soloChars, setSoloChars] = useState<Set<string>>(new Set())
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [puterReady, setPuterReady] = useState(false)
  const [projectTitle, setProjectTitle] = useState('My Rehearsal Project')
  const playingRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    // Group lines into scenes
    const sceneMap: Record<number, Line[]> = {}
    lines.forEach(line => {
      const sceneNum = line.scene || 1
      if (!sceneMap[sceneNum]) sceneMap[sceneNum] = []
      sceneMap[sceneNum].push(line)
    })
    const scenesArr = Object.entries(sceneMap).map(([num, lines]) => ({
      number: parseInt(num),
      lines
    })).sort((a, b) => a.number - b.number)
    setScenes(scenesArr)
  }, [lines])

  async function loadData() {
    const scriptRes = await fetch(`/api/projects/${id}/script`)
    const scriptData = await scriptRes.json()
    if (scriptData?.content) {
      setSavedScript(scriptData.content)
      setScript(scriptData.content)
    }

    const charRes = await fetch(`/api/projects/${id}/characters`)
    const charData = await charRes.json()
    if (Array.isArray(charData)) {
      setCharacters(charData)
      const vols: Record<string, number> = {}
      charData.forEach((c: Character) => vols[c.id] = c.volume || 80)
      setVolumes(vols)
    }

    const linesRes = await fetch(`/api/projects/${id}/lines`)
    const linesData = await linesRes.json()
    if (Array.isArray(linesData)) setLines(linesData)
  }

  async function handleSaveScript() {
    setLoading(true)
    const res = await fetch(`/api/projects/${id}/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: script })
    })
    if (res.ok) {
      setSavedScript(script)
      setMessage('Script saved!')
      setTab('parse')
    }
    setLoading(false)
  }

  async function handleParse() {
    setLoading(true)
    const res = await fetch(`/api/projects/${id}/parse`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setMessage(`Parsed! Found ${data.characters} characters and ${data.lines} lines.`)
      loadData()
      setTab('voices')
    }
    setLoading(false)
  }

  async function handleVoiceChange(charId: string, voice: string) {
    await fetch(`/api/projects/${id}/characters`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: charId, voice })
    })
    setCharacters(chars => chars.map(c => c.id === charId ? { ...c, voice } : c))
  }

  function getValidVoice(voice: string | undefined): string {
    if (!voice) return DEFAULT_VOICE
    const validVoice = VOICES.find(v => v.id === voice)
    return validVoice ? voice : DEFAULT_VOICE
  }

  function getVoiceStyle(voice: string): string {
    const v = VOICES.find(x => x.id === voice)
    return v?.style || 'Default'
  }

  function toggleMute(charId: string) {
    setMutedChars(prev => {
      const next = new Set(prev)
      if (next.has(charId)) next.delete(charId)
      else next.add(charId)
      return next
    })
  }

  function toggleSolo(charId: string) {
    setSoloChars(prev => {
      const next = new Set(prev)
      if (next.has(charId)) next.delete(charId)
      else next.add(charId)
      return next
    })
  }

  async function speakWithPuter(text: string, voice: string, volume: number = 80): Promise<boolean> {
    if (!window.puter) return false
    
    try {
      const validVoice = getValidVoice(voice)
      const audio = await window.puter.ai.txt2speech(text, {
        voice: validVoice,
        engine: 'neural'
      })
      
      audio.volume = volume / 100
      currentAudioRef.current = audio
      
      return new Promise((resolve) => {
        audio.onended = () => resolve(true)
        audio.onerror = () => resolve(false)
        audio.play().catch(() => resolve(false))
      })
    } catch (error) {
      console.error('TTS error:', error)
      return false
    }
  }

  function getCurrentSceneLines(): Line[] {
    const scene = scenes.find(s => s.number === selectedScene)
    return scene?.lines || []
  }

  function getAudibleCharacters(): string {
    const sceneLines = getCurrentSceneLines()
    const charNames = new Set<string>()
    sceneLines.forEach(l => {
      if (l.character && !mutedChars.has(l.character.id)) {
        charNames.add(l.character.name)
      }
    })
    return Array.from(charNames).join(', ')
  }

  async function handlePlay() {
    const sceneLines = getCurrentSceneLines()
    if (sceneLines.length === 0 || !puterReady) return
    
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
    }
    
    setIsPlaying(true)
    playingRef.current = true
    
    for (let i = 0; i < sceneLines.length; i++) {
      if (!playingRef.current) break
      
      setCurrentLineIndex(i)
      const line = sceneLines[i]
      const charId = line.character?.id
      
      // Skip if muted or solo mode active and not in solo
      const isMuted = charId && mutedChars.has(charId)
      const isSoloActive = soloChars.size > 0
      const isInSolo = charId && soloChars.has(charId)
      const isMyRole = charId === myRole
      
      if (isMuted || (isSoloActive && !isInSolo) || isMyRole) {
        await new Promise(r => setTimeout(r, 800))
        continue
      }
      
      if (line.type === 'direction') {
        await new Promise(r => setTimeout(r, 600))
        continue
      }
      
      const char = characters.find(c => c.id === charId)
      const voice = getValidVoice(char?.voice)
      const volume = volumes[charId || ''] || 80
      
      await speakWithPuter(line.content, voice, volume)
      await new Promise(r => setTimeout(r, 200))
    }
    
    setIsPlaying(false)
    setCurrentLineIndex(-1)
    playingRef.current = false
  }

  function handleStop() {
    playingRef.current = false
    setIsPlaying(false)
    setCurrentLineIndex(-1)
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
    }
  }

  function handlePrevLine() {
    const sceneLines = getCurrentSceneLines()
    if (currentLineIndex > 0) {
      setCurrentLineIndex(currentLineIndex - 1)
    }
  }

  function handleNextLine() {
    const sceneLines = getCurrentSceneLines()
    if (currentLineIndex < sceneLines.length - 1) {
      setCurrentLineIndex(currentLineIndex + 1)
    }
  }

  const dialogueLines = lines.filter(l => l.type === 'dialogue').length
  const directionLines = lines.filter(l => l.type === 'direction').length

  return (
    <div className="min-h-screen bg-gray-50">
      <Script 
        src="https://js.puter.com/v2/" 
        onLoad={() => setPuterReady(true)}
      />
      
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
            ← Back to Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <span className="w-5 h-5 bg-gray-800 rounded flex items-center justify-center text-white text-xs">S</span>
                Scriptor Rehearsal
              </div>
              <h1 className="text-2xl font-bold mt-1">Script upload to character stems MVP</h1>
              <p className="text-gray-500 text-sm mt-1">
                Upload a script, parse characters, assign voices, and rehearse with mute and solo controls.
              </p>
              
              {/* Stats */}
              <div className="flex gap-8 mt-4">
                <div className="text-center">
                  <div className="text-xs text-gray-500">Characters</div>
                  <div className="text-2xl font-semibold">{characters.length}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Scenes</div>
                  <div className="text-2xl font-semibold">{scenes.length || 1}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Dialogue Lines</div>
                  <div className="text-2xl font-semibold">{dialogueLines}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Directions</div>
                  <div className="text-2xl font-semibold">{directionLines}</div>
                </div>
              </div>
            </div>
            
            {/* Workflow Panel */}
            <div className="bg-gray-50 rounded-lg p-4 w-64">
              <div className="text-sm font-medium mb-2">Workflow</div>
              <div className="text-xs text-gray-500 mb-3">Step through the MVP flow.</div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setTab('upload')}
                  className={`px-3 py-2 rounded text-sm ${tab === 'upload' ? 'bg-gray-800 text-white' : 'bg-white border'}`}
                >
                  Upload
                </button>
                <button 
                  onClick={() => setTab('parse')}
                  className={`px-3 py-2 rounded text-sm ${tab === 'parse' ? 'bg-gray-800 text-white' : 'bg-white border'}`}
                >
                  Parse
                </button>
                <button 
                  onClick={() => setTab('voices')}
                  className={`px-3 py-2 rounded text-sm ${tab === 'voices' ? 'bg-gray-800 text-white' : 'bg-white border'}`}
                >
                  Voices
                </button>
                <button 
                  onClick={() => setTab('mixer')}
                  className={`px-3 py-2 rounded text-sm ${tab === 'mixer' ? 'bg-gray-800 text-white' : 'bg-white border'}`}
                >
                  Mixer
                </button>
              </div>
              <div className="mt-4 text-xs text-gray-600">
                <div>Project: {projectTitle}</div>
                <div>Selected role: {characters.find(c => c.id === myRole)?.name || 'None'}</div>
                <div>Mode: {mode} cast</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto flex">
          {['Upload', 'Parse Review', 'Voice Assignment', 'Mixer'].map((t, i) => {
            const tabKey = ['upload', 'parse', 'voices', 'mixer'][i]
            return (
              <button
                key={t}
                onClick={() => setTab(tabKey as typeof tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${tab === tabKey ? 'border-gray-800 text-gray-800' : 'border-transparent text-gray-500'}`}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Upload Tab */}
        {tab === 'upload' && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Upload Script</h2>
            <p className="text-sm text-gray-500 mb-4">Format: CHARACTER NAME: Dialogue text</p>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`SCENE 1\n\nOSCAR: All right, who's winning?\n\nFELIX: I can't believe you live like this.\n\n[Oscar shrugs]\n\nSCENE 2\n\nOSCAR: That is not the point of the evening.`}
              className="w-full h-80 p-4 border rounded-lg font-mono text-sm"
            />
            <button 
              onClick={handleSaveScript}
              disabled={loading || !script.trim()}
              className="mt-4 px-6 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50"
            >
              Save & Continue
            </button>
          </div>
        )}

        {/* Parse Tab */}
        {tab === 'parse' && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Parse Script</h2>
            <p className="text-sm text-gray-500 mb-4">Click below to detect characters and dialogue lines.</p>
            {savedScript ? (
              <div>
                <pre className="bg-gray-50 p-4 rounded-lg text-sm max-h-60 overflow-auto mb-4">
                  {savedScript}
                </pre>
                <button 
                  onClick={handleParse}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Parsing...' : 'Parse Script'}
                </button>
              </div>
            ) : (
              <p className="text-gray-500">No script uploaded yet. Go to Upload tab first.</p>
            )}
          </div>
        )}

        {/* Voices Tab */}
        {tab === 'voices' && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Voice Assignment</h2>
            <p className="text-sm text-gray-500 mb-4">Assign a voice to each character.</p>
            {characters.length === 0 ? (
              <p className="text-gray-500">No characters found. Parse your script first.</p>
            ) : (
              <div className="space-y-4">
                {characters.map(char => (
                  <div key={char.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: char.color }} />
                    <div className="flex-1">
                      <div className="font-medium">{char.name}</div>
                      <div className="text-sm text-gray-500">{char._count?.lines || 0} lines</div>
                    </div>
                    <select
                      value={getValidVoice(char.voice)}
                      onChange={(e) => handleVoiceChange(char.id, e.target.value)}
                      className="border rounded-lg px-3 py-2"
                    >
                      {VOICES.map(v => (
                        <option key={v.id} value={v.id}>{v.name} - {v.style}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <button 
                  onClick={() => setTab('mixer')}
                  className="px-6 py-2 bg-gray-800 text-white rounded-lg"
                >
                  Continue to Mixer
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mixer Tab */}
        {tab === 'mixer' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Scenes Panel */}
            <div className="col-span-2">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold mb-1">Scenes</h3>
                <p className="text-xs text-gray-500 mb-3">Choose a scene to rehearse.</p>
                <div className="space-y-2">
                  {(scenes.length > 0 ? scenes : [{ number: 1, lines }]).map(scene => (
                    <button
                      key={scene.number}
                      onClick={() => setSelectedScene(scene.number)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedScene === scene.number ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}
                    >
                      <div className="font-medium">SCENE {scene.number}</div>
                      <div className="text-xs opacity-70">{scene.lines.length} lines</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rehearsal Player */}
            <div className="col-span-6">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Rehearsal Player</h3>
                    <div className="text-xs text-gray-500">SCENE {selectedScene}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as 'full' | 'solo')}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="full">Full Cast</option>
                      <option value="solo">Solo Mode</option>
                    </select>
                    <select
                      value={myRole}
                      onChange={(e) => setMyRole(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="">Select Role</option>
                      {characters.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 mb-4">
                  <button 
                    onClick={handlePlay}
                    disabled={!puterReady || isPlaying}
                    className="flex items-center gap-1 px-4 py-2 bg-gray-800 text-white rounded text-sm disabled:opacity-50"
                  >
                    <span>▶</span> Play
                  </button>
                  <button 
                    onClick={handleStop}
                    className="px-4 py-2 border rounded text-sm"
                  >
                    Stop
                  </button>
                  <button 
                    onClick={handlePrevLine}
                    className="px-4 py-2 border rounded text-sm"
                  >
                    Prev Line
                  </button>
                  <button 
                    onClick={handleNextLine}
                    className="px-4 py-2 border rounded text-sm"
                  >
                    Next Line
                  </button>
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  Audible now: {getAudibleCharacters() || 'None'}
                </div>

                {/* Lines */}
                <div className="space-y-3 max-h-96 overflow-auto">
                  {getCurrentSceneLines().map((line, i) => {
                    const isCurrent = i === currentLineIndex
                    const isMuted = line.character && mutedChars.has(line.character.id)
                    const isMyLine = line.character?.id === myRole
                    
                    return (
                      <div
                        key={line.id}
                        className={`p-3 rounded-lg transition-all ${
                          isCurrent ? 'bg-blue-900 text-white' : 
                          line.type === 'direction' ? 'bg-gray-50 text-gray-600 italic' : 'bg-gray-50'
                        } ${isMuted || isMyLine ? 'opacity-50' : ''}`}
                      >
                        {line.character && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-gray-800 text-white px-2 py-0.5 rounded">
                              SCENE {selectedScene}
                            </span>
                            <span 
                              className="text-xs px-2 py-0.5 rounded text-white"
                              style={{ backgroundColor: line.character.color }}
                            >
                              {line.character.name}
                            </span>
                          </div>
                        )}
                        <div className={line.type === 'direction' ? 'text-sm' : ''}>
                          {line.content}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Mixer Panel */}
            <div className="col-span-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold mb-1">Mixer</h3>
                <p className="text-xs text-gray-500 mb-4">Mute, solo, and balance each role.</p>
                
                <div className="space-y-4">
                  {characters.map(char => (
                    <div key={char.id} className="border-b pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium">{char.name}</div>
                          <div className="text-xs text-gray-500">{getVoiceStyle(getValidVoice(char.voice))}</div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleMute(char.id)}
                            className={`w-8 h-8 rounded text-sm font-medium ${mutedChars.has(char.id) ? 'bg-red-500 text-white' : 'bg-gray-100'}`}
                          >
                            M
                          </button>
                          <button
                            onClick={() => toggleSolo(char.id)}
                            className={`w-8 h-8 rounded text-sm font-medium ${soloChars.has(char.id) ? 'bg-yellow-500 text-white' : 'bg-gray-100'}`}
                          >
                            S
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">🔊 Volume</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={volumes[char.id] || 80}
                          onChange={(e) => setVolumes(v => ({ ...v, [char.id]: parseInt(e.target.value) }))}
                          className="flex-1 accent-blue-600"
                        />
                        <span className="text-xs text-gray-500 w-8">{volumes[char.id] || 80}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="mt-4 w-full px-4 py-2 border rounded-lg text-sm flex items-center justify-center gap-2">
                  <span>💾</span> Save Preset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
