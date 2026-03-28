'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Script from 'next/script'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { Label } from '../../../components/ui/label'

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
  _count?: { lines: number }
}

type Line = {
  id: string
  lineNumber: number
  type: string
  content: string
  character: Character | null
}

// Puter.js voices (Amazon Polly voices)
const VOICES = [
  { id: 'Matthew', name: 'Matthew (Male, US)' },
  { id: 'Joanna', name: 'Joanna (Female, US)' },
  { id: 'Joey', name: 'Joey (Male, US)' },
  { id: 'Salli', name: 'Salli (Female, US)' },
  { id: 'Ivy', name: 'Ivy (Female, Child)' },
  { id: 'Justin', name: 'Justin (Male, Child)' },
  { id: 'Brian', name: 'Brian (Male, UK)' },
  { id: 'Amy', name: 'Amy (Female, UK)' },
  { id: 'Emma', name: 'Emma (Female, UK)' },
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
  const [currentLine, setCurrentLine] = useState(-1)
  const [mutedChars, setMutedChars] = useState<Set<string>>(new Set())
  const [puterReady, setPuterReady] = useState(false)
  const playingRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

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

  async function speakWithPuter(text: string, voice: string): Promise<boolean> {
    if (!window.puter) {
      console.error('Puter not loaded')
      return false
    }
    
    try {
      const audio = await window.puter.ai.txt2speech(text, {
        voice: voice,
        engine: 'neural'
      })
      
      currentAudioRef.current = audio
      
      return new Promise((resolve) => {
        audio.onended = () => resolve(true)
        audio.onerror = () => resolve(false)
        audio.play().catch(() => resolve(false))
      })
    } catch (error) {
      console.error('Puter TTS error:', error)
      return false
    }
  }

  async function handlePlay() {
    if (lines.length === 0) return
    if (!puterReady) {
      setMessage('Voice engine loading, please wait...')
      return
    }
    
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    
    setIsPlaying(true)
    setMessage('')
    playingRef.current = true
    
    for (let i = 0; i < lines.length; i++) {
      if (!playingRef.current) break
      
      setCurrentLine(i)
      const line = lines[i]
      const charId = line.character?.id
      
      if (charId && (mutedChars.has(charId) || charId === myRole)) {
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
      
      if (line.type === 'direction') {
        await new Promise(r => setTimeout(r, 500))
        continue
      }
      
      const char = characters.find(c => c.id === charId)
      const voice = char?.voice || 'Matthew'
      
      await speakWithPuter(line.content, voice)
      await new Promise(r => setTimeout(r, 300))
    }
    
    setIsPlaying(false)
    setCurrentLine(-1)
    playingRef.current = false
  }

  function handleStop() {
    playingRef.current = false
    setIsPlaying(false)
    setCurrentLine(-1)
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
  }

  async function testVoice() {
    if (!puterReady) {
      setMessage('Voice engine loading...')
      return
    }
    setMessage('Testing voice...')
    const success = await speakWithPuter("Hello! This is a test of the AI voice system. It sounds great, right?", 'Matthew')
    if (success) {
      setMessage('✓ Voice test complete!')
    } else {
      setMessage('✗ Voice test failed')
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <Script 
        src="https://js.puter.com/v2/" 
        onLoad={() => setPuterReady(true)}
      />
      
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline mb-4 block">
          ← Back to Dashboard
        </Link>

        <div className="flex gap-2 mb-6">
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
          <div className={`mb-4 p-3 rounded ${message.includes('✗') || message.includes('fail') || message.includes('error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {tab === 'script' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Script</CardTitle>
              <CardDescription>Format: CHARACTER NAME: Dialogue text</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={`JULIET: O Romeo, Romeo! Wherefore art thou Romeo?\n\nROMEO: Shall I hear more, or shall I speak at this?\n\n[Stage direction in brackets]`}
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
              <CardDescription>Assign AI voices to each character (Free, powered by Puter.js)</CardDescription>
            </CardHeader>
            <CardContent>
              {characters.length === 0 ? (
                <p className="text-muted-foreground">No characters yet. Parse your script first.</p>
              ) : (
                <div className="space-y-4">
                  {characters.map((char) => (
                    <div key={char.id} className="flex items-center gap-4 p-3 border rounded">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: char.color }} />
                      <div className="flex-1">
                        <div className="font-medium">{char.name}</div>
                        <div className="text-sm text-muted-foreground">{char._count?.lines || 0} lines</div>
                      </div>
                      <select
                        value={char.voice || 'Matthew'}
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
                <CardTitle>Rehearsal Controls</CardTitle>
                <CardDescription>
                  {puterReady 
                    ? '✓ AI voices ready (Free, unlimited)' 
                    : '⏳ Loading voice engine...'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                        className={`px-3 py-1 rounded text-sm border ${mutedChars.has(c.id) ? 'bg-gray-300 line-through' : 'bg-white'}`}
                        style={{ borderLeftWidth: 4, borderLeftColor: c.color }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button onClick={testVoice} variant="outline" disabled={!puterReady}>
                    🔊 Test Voice
                  </Button>
                  {!isPlaying ? (
                    <Button onClick={handlePlay} disabled={!puterReady}>
                      ▶ Start Rehearsal
                    </Button>
                  ) : (
                    <Button onClick={handleStop} variant="destructive">
                      ■ Stop
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Script ({lines.length} lines)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {lines.map((line, i) => {
                    const isCurrent = i === currentLine
                    const isMuted = line.character && (mutedChars.has(line.character.id) || line.character.id === myRole)
                    
                    return (
                      <div
                        key={line.id}
                        className={`p-3 rounded transition-all ${isCurrent ? 'bg-yellow-100 ring-2 ring-yellow-400 scale-[1.02]' : 'bg-gray-50'} ${isMuted ? 'opacity-40' : ''}`}
                        style={{ borderLeft: `4px solid ${line.character?.color || '#ccc'}` }}
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
                        {isMuted && <span className="ml-2 text-xs text-gray-400">(your line)</span>}
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
