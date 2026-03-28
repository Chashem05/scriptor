import { NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

const VOICES: Record<string, string> = {
  'adam': 'pNInz6obpgDQGcFmaJgB',
  'antoni': 'ErXwobaYiN019PkySvjV',
  'arnold': 'VR6AewLTigWG4xSOukaG',
  'brian': 'nPczCjzI2devNBz1zQrb',
  'callum': 'N2lVS1w4EtoT3dr4eOWO',
  'charlie': 'IKne3meq5aSn9XLyUdCD',
  'clyde': '2EiwWnXFnvU5JabPnv8n',
  'daniel': 'onwK4e9ZLuTAKqWW03F9',
  'dave': 'CYw3kZ02Hs0563khs1Fj',
  'ethan': 'g5CIjZEefAph4nQFvHAz',
  'fin': 'D38z5RcWu1voky8WS1ja',
  'george': 'JBFqnCBsd6RMkjVDRZzb',
  'harry': 'SOYHLrjzK2X1ezoPC6cr',
  'james': 'ZQe5CZNOzWyzPSCn5a3c',
  'jeremy': 'bVMeCyTHy58xNoL34h3p',
  'josh': 'TxGEqnHWrfWFTfGW9XjX',
  'liam': 'TX3LPaxmHKxFdv7VOQHJ',
  'marcus': 'IdkH88NnEJiPkwoHoAfP',
  'michael': 'flq6f7yk4E4fJM5XTYuZ',
  'patrick': 'ODq5zmih8GrVes37Dizd',
  'sam': 'yoZ06aMxZJJ28mfd3POQ',
  'thomas': 'GBv7mTt0atIp3Br8iCZE',
  'alice': 'Xb7hH8MSUJpSbSDYk0k2',
  'aria': '9BWtsMINqrJLrRacOk9x',
  'bella': 'EXAVITQu4vr4xnSDxMaL',
  'charlotte': 'XB0fDUnXU5powFXDhCwa',
  'domi': 'AZnzlk1XvdvUeBnXmlld',
  'dorothy': 'ThT5KcBeYPX3keUQqHPh',
  'elli': 'MF3mGyEYCl7XYWbV9V6O',
  'emily': 'LcfcDJNUP1GQjkzn1xUU',
  'freya': 'jsCqWAovK2LkecY7zXl4',
  'gigi': 'jBpfuIE2acCO8z3wKNLl',
  'glinda': 'z9fAnlkpzviPz146aGWa',
  'grace': 'oWAxZDx7w5VEj9dCyTzz',
  'jessie': 't0jbNlBVZ17f02VDIeMI',
  'lily': 'pFZP5JQG7iQjIQuC4Bku',
  'matilda': 'XrExE9yKIg1WjnnlVkGX',
  'mimi': 'zrHiDhphv9ZnVXBqCLjz',
  'nicole': 'piTKgcLEGmPE4e6mEKli',
  'rachel': '21m00Tcm4TlvDq8ikWAM',
  'serena': 'pMsXgVXv3BLzUgSXRplE',
}

type LineData = {
  content: string
  type: string
  characterId: string | null
  voice: string
  isMuted: boolean
  settings: {
    stability: number
    similarity: number
    style: number
    speed: number
  }
}

// Estimate speech duration based on word count
// Average speaking rate is ~150 words per minute = 2.5 words per second
// Add some buffer for pauses
function estimateDurationMs(text: string, speed: number = 1.0): number {
  const words = text.trim().split(/\s+/).length
  const baseMs = (words / 2.5) * 1000 // 2.5 words per second
  const adjusted = baseMs / speed // faster speed = shorter duration
  return Math.max(500, Math.round(adjusted)) // minimum 500ms
}

// Generate silent MP3 frame data for a given duration
// This creates a minimal valid MP3 with silence
function generateSilence(durationMs: number): Uint8Array {
  // MP3 frame at 128kbps, 44100Hz is ~26ms per frame
  // Each frame is 417 bytes for 128kbps
  const msPerFrame = 26
  const frameCount = Math.ceil(durationMs / msPerFrame)
  
  // Minimal MP3 silent frame (128kbps, 44100Hz, stereo)
  // This is a valid MP3 frame header + silent audio data
  const silentFrame = new Uint8Array([
    0xFF, 0xFB, 0x90, 0x00, // MP3 frame header (MPEG1 Layer3, 128kbps, 44100Hz)
    // Followed by zeros for silence (simplified - actual frame is larger)
    ...new Array(413).fill(0)
  ])
  
  // Concatenate frames
  const totalBytes = frameCount * silentFrame.length
  const result = new Uint8Array(totalBytes)
  for (let i = 0; i < frameCount; i++) {
    result.set(silentFrame, i * silentFrame.length)
  }
  
  return result
}

export async function POST(req: Request) {
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: 'NO_API_KEY' }, { status: 500 })
  }

  try {
    const { lines } = await req.json() as { lines: LineData[] }

    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: 'No lines provided' }, { status: 400 })
    }

    const audioChunks: Uint8Array[] = []

    for (const line of lines) {
      // Skip stage directions (brief pause)
      if (line.type === 'direction') {
        audioChunks.push(generateSilence(500))
        continue
      }

      // If muted, generate silence based on estimated duration
      if (line.isMuted) {
        const speed = line.settings?.speed || 1.0
        const silenceDuration = estimateDurationMs(line.content, speed)
        audioChunks.push(generateSilence(silenceDuration))
        continue
      }

      // Generate actual audio for unmuted lines
      const voiceId = VOICES[line.voice] || VOICES['josh']
      const settings = line.settings || { stability: 0.5, similarity: 0.75, style: 0, speed: 1 }

      const response = await fetch(`https://api.us.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: line.content,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: Math.max(0, Math.min(1, settings.stability)),
            similarity_boost: Math.max(0, Math.min(1, settings.similarity)),
            style: Math.max(0, Math.min(1, settings.style)),
            use_speaker_boost: true,
            speed: Math.max(0.7, Math.min(1.2, settings.speed)),
          },
        }),
      })

      if (!response.ok) {
        console.error('ElevenLabs error for line:', line.content.substring(0, 50))
        // Add silence as fallback
        audioChunks.push(generateSilence(estimateDurationMs(line.content)))
        continue
      }

      const audioBuffer = await response.arrayBuffer()
      audioChunks.push(new Uint8Array(audioBuffer))
      
      // Small pause between lines
      audioChunks.push(generateSilence(200))
    }

    if (audioChunks.length === 0) {
      return NextResponse.json({ error: 'No audio generated' }, { status: 400 })
    }

    // Combine all audio chunks
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of audioChunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    return new NextResponse(combined, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="rehearsal-export.mp3"',
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'EXPORT_ERROR', message: String(error) }, { status: 500 })
  }
}
