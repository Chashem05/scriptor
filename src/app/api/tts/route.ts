import { NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// ElevenLabs voice IDs
const VOICES: Record<string, string> = {
  'rachel': '21m00Tcm4TlvDq8ikWAM',      // Female, calm
  'domi': 'AZnzlk1XvdvUeBnXmlld',        // Female, strong  
  'bella': 'EXAVITQu4vr4xnSDxMaL',       // Female, soft
  'antoni': 'ErXwobaYiN019PkySvjV',      // Male, warm
  'josh': 'TxGEqnHWrfWFTfGW9XjX',        // Male, deep
  'arnold': 'VR6AewLTigWG4xSOukaG',      // Male, crisp
  'adam': 'pNInz6obpgDQGcFmaJgB',        // Male, deep
  'sam': 'yoZ06aMxZJJ28mfd3POQ',         // Male, raspy
}

export async function POST(req: Request) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 })
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
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('ElevenLabs error:', error)
      return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 })
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    })
  } catch (error) {
    console.error('TTS error:', error)
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 })
  }
}

export async function GET() {
  // Return available voices
  return NextResponse.json({
    voices: Object.keys(VOICES).map(id => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1)
    }))
  })
}
