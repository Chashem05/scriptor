'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { Label } from '../../../components/ui/label'

type Character = {
  id: string
  name: string
  voice: string
  color: string
  _count?: { lines: number }
}

type Line = {
  id: string
  lineNumber: number
  type: string
  content: string
  character: Character | null
}

const VOICES = [
  { id: 'male-1', name: 'Adam (Deep Male)' },
  { id: 'male-2', name: 'Arnold (Strong Male)' },
  { id: 'female-1', name: 'Bella (Warm Female)' },
  { id: 'female-2', name: 'Gigi (Bright Female)' },
  { id: 'neutral', name: 'Daniel (Neutral)' },
]

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string
  
  const [tab, setTab] = useState<'script' | 'characters' | 'rehearse'>('script')
  const [script, setScript] = useState('')
  const [savedScript, setSavedScript] = useState<string | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [myRole, setMyRole] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentLine, setCurrentLine] = useState(0)
  const [mutedChars, setMutedChars] = useState<Set<string>>(new Set())
  const [useElevenLabs, setUseElevenLabs] = useState(true)
  const [ttsStatus, setTtsStatus] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    const scriptRes = await fetch(`/api/projects/${id}/script`)
    const scriptData = await scriptRes.json()
    if (scriptData?.content) {
      setSavedScript(scriptData.content)
      setScript(scriptData.content)
    }

    const charRes = await fetch(`/api/projects/${id}/characters`)
    const charData = await charRes.json()
    if (Array.isArray(charData)) setCharacters(charData)

    const linesRes = await fetch(`/api/projects/${id}/lines`)
    const linesData = await linesRes.json()
    if (Array.isArray(linesData)) setLines(linesData)
  }

  async function handleSaveScript() {
    setLoading(true)
    setMessage('')
    const res = await fetch(`/api/projects/${id}/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: script })
    })
    if (res.ok) {
      setSavedScript(script)
      setMessage('Script saved!')
    }
    setLoading(false)
  }

  async function handleParse() {
    setLoading(true)
    setMessage('')
    const res = await fetch(`/api/projects/${id}/parse`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setMessage(`Parsed! Found ${data.characters} characters and ${data.lines} lines.`)
      loadData()
    } else {
      setMessage('Parse failed: ' + data.error)
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

  function toggleMute(charId: string) {
    setMutedChars(prev => {
      const next = new Set(prev)
      if (next.has(charId)) next.delete(charId)
      else next.add(charId)
      return next
    })
  }

  async function handlePlay() {
    if (lines.length === 0) return
    abortRef.current = false
    setIsPlaying(true)
    setCurrentLine(0)
    await playLine(0)
  }

  async function playLine(index: number) {
    if (abortRef.current || index >= lines.length) {
      setIsPlaying(false)
      setTtsStatus('')
      return
    }
    
    setCurrentLine(index)
    const line = lines[index]
    
    // Skip if muted, direction, or my role
    const charId = line.character?.id
    if (line.type !== 'dialogue' || !line.character || (charId && (mutedChars.has(charId) || charId === myRole))) {
      setTimeout(() => playLine(index + 1), 300)
      return
    }

    if (useElevenLabs) {
      try {
        setTtsStatus(`Generating: ${line.character.name}...`)
        
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: line.content, 
            voice: line.character.voice 
          })
        })

        if (!res.ok) {
          // Fallback to browser TTS
          console.log('ElevenLabs failed, using browser TTS')
          await playWithBrowserTTS(line, index)
          return
        }

        const audioBlob = await res.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        
        if (audioRef.current) {
          audioRef.current.pause()
        }
        
        const audio = new Audio(audioUrl)
        audioRef.current = audio
        setTtsStatus(`Playing: ${line.character.name}`)
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          if (!abortRef.current) playLine(index + 1)
        }
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          if (!abortRef.current) playLine(index + 1)
        }
        
        await audio.play()
      } catch (error) {
        console.error('TTS error:', error)
        await playWithBrowserTTS(line, index)
      }
    } else {
      await playWithBrowserTTS(line, index)
    }
  }

  async function playWithBrowserTTS(line: Line, index: number) {
    return new Promise<void>((resolve) => {
      if ('speechSynthesis' in window && line.character) {
        setTtsStatus(`Speaking: ${line.character.name}`)
        const utterance = new SpeechSynthesisUtterance(line.content)
        utterance.rate = 0.9
        utterance.onend = () => {
          if (!abortRef.current) playLine(index + 1)
          resolve()
        }
        utterance.onerror = () => {
          if (!abortRef.current) playLine(index + 1)
          resolve()
        }
        speechSynthesis.speak(utterance)
      } else {
        setTimeout(() => {
          if (!abortRef.current) playLine(index + 1)
          resolve()
        }, 1000)
      }
    })
  }

  function handleStop() {
    abortRef.current = true
    setIsPlaying(false)
    setTtsStatus('')
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    speechSynthesis?.cancel()
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline mb-4 block">
          ← Back to Dashboard
        </Link>

        <div className="flex gap-2 mb-6 flex-wrap">
          <Button variant={tab === 'script' ? 'default' : 'outline'} onClick={() => setTab('script')}>
            1. Script
          </Button>
          <Button variant={tab === 'characters' ? 'default' : 'outline'} onClick={() => setTab('characters')} disabled={!savedScript}>
            2. Characters
          </Button>
          <Button variant={tab === 'rehearse' ? 'default' : 'outline'} onClick={() => setTab('rehearse')} disabled={lines.length === 0}>
            3. Rehearse
          </Button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded ${message.includes('fail') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {tab === 'script' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Script</CardTitle>
              <CardDescription>Use format: CHARACTER NAME: Dialogue text</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={`Example:\n\nJULIET: O Romeo, Romeo! Wherefore art thou Romeo?\n\nROMEO: Shall I hear more, or shall I speak at this?\n\n[Stage direction]`}
                className="w-full h-80 p-3 border rounded-md font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveScript} disabled={loading || !script.trim()}>
                  Save Script
                </Button>
                {savedScript && (
                  <Button onClick={handleParse} disabled={loading} variant="outline">
                    Parse Script
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'characters' && (
          <Card>
            <CardHeader>
              <CardTitle>Characters & Voices</CardTitle>
              <CardDescription>Assign ElevenLabs voices to each character</CardDescription>
            </CardHeader>
            <CardContent>
              {characters.length === 0 ? (
                <p className="text-muted-foreground">Parse your script first.</p>
              ) : (
                <div className="space-y-4">
                  {characters.map(char => (
                    <div key={char.id} className="flex items-center gap-4 p-3 border rounded">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: char.color }} />
                      <div className="flex-1">
                        <div className="font-medium">{char.name}</div>
                        <div className="text-sm text-muted-foreground">{char._count?.lines || 0} lines</div>
                      </div>
                      <select
                        value={char.voice}
                        onChange={(e) => handleVoiceChange(char.id, e.target.value)}
                        className="border rounded p-2"
                      >
                        {VOICES.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'rehearse' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Rehearsal Mode</CardTitle>
                <CardDescription>Select your role and start rehearsing with AI voices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useElevenLabs}
                      onChange={(e) => setUseElevenLabs(e.target.checked)}
                      className="rounded"
                    />
                    <span>Use ElevenLabs AI Voices</span>
                  </label>
                  {!useElevenLabs && <span className="text-sm text-muted-foreground">(Using browser TTS)</span>}
                </div>

                <div>
                  <Label>Your Role (will be silent)</Label>
                  <select
                    value={myRole || ''}
                    onChange={(e) => setMyRole(e.target.value || null)}
                    className="w-full border rounded p-2 mt-1"
                  >
                    <option value="">None - hear all characters</option>
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Mute Characters</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {characters.map(c => (
                      <button
                        key={c.id}
                        onClick={() => toggleMute(c.id)}
                        className={`px-3 py-1 rounded text-sm ${mutedChars.has(c.id) ? 'bg-gray-300 line-through' : 'bg-gray-100'}`}
                        style={{ borderLeft: `4px solid ${c.color}` }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  {!isPlaying ? (
                    <Button onClick={handlePlay} size="lg">▶ Start Rehearsal</Button>
                  ) : (
                    <Button onClick={handleStop} variant="destructive" size="lg">■ Stop</Button>
                  )}
                  {ttsStatus && <span className="text-sm text-muted-foreground">{ttsStatus}</span>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Script</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {lines.map((line, i) => {
                    const isCurrent = isPlaying && i === currentLine
                    const isMuted = line.character && (mutedChars.has(line.character.id) || line.character.id === myRole)
                    
                    return (
                      <div
                        key={line.id}
                        className={`p-3 rounded transition-all ${isCurrent ? 'bg-yellow-100 ring-2 ring-yellow-400 scale-[1.01]' : ''} ${isMuted ? 'opacity-40' : ''}`}
                        style={{ borderLeft: line.character ? `4px solid ${line.character.color}` : '4px solid #ccc' }}
                      >
                        {line.character && (
                          <span className="font-bold text-sm mr-2" style={{ color: line.character.color }}>
                            {line.character.name}:
                          </span>
                        )}
                        {line.type === 'direction' ? (
                          <span className="italic text-gray-500">{line.content}</span>
                        ) : (
                          <span>{line.content}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
