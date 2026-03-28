import { NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// ElevenLabs voice IDs
const VOICES: Record<string, string> = {
  'rachel': '21m00Tcm4TlvDq8ikWAM',
  'domi': 'AZnzlk1XvdvUeBnXmlld',
  'bella': 'EXAVITQu4vr4xnSDxMaL',
  'antoni': 'ErXwobaYiN019PkySvjV',
  'josh': 'TxGEqnHWrfWFTfGW9XjX',
  'arnold': 'VR6AewLTigWG4xSOukaG',
  'adam': 'pNInz6obpgDQGcFmaJgB',
  'sam': 'yoZ06aMxZJJ28mfd3POQ',
}

export async function POST(req: Request) {
  try {
    if (!ELEVENLABS_API_KEY) {
      console.log('No ElevenLabs API key found')
      return NextResponse.json({ error: 'NO_API_KEY' }, { status: 500 })
    }

    const { text, voice = 'josh' } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const voiceId = VOICES[voice] || VOICES['josh']

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', response.status, errorText)
      return NextResponse.json({ error: 'ELEVENLABS_ERROR', details: errorText }, { status: 500 })
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    })
  } catch (error) {
    console.error('TTS error:', error)
    return NextResponse.json({ error: 'TTS_ERROR', message: String(error) }, { status: 500 })
  }
}

export async function GET() {
  const hasKey = !!ELEVENLABS_API_KEY
  return NextResponse.json({
    configured: hasKey,
    voices: Object.keys(VOICES).map(id => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1)
    }))
  })
}
