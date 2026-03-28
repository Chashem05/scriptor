import { NextResponse } from 'next/server'

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY

// Google Cloud TTS voices
const VOICES: Record<string, { name: string; ssmlGender: string }> = {
  'male-1': { name: 'en-US-Casual-K', ssmlGender: 'MALE' },
  'male-2': { name: 'en-US-Neural2-D', ssmlGender: 'MALE' },
  'male-3': { name: 'en-US-Neural2-J', ssmlGender: 'MALE' },
  'female-1': { name: 'en-US-Neural2-C', ssmlGender: 'FEMALE' },
  'female-2': { name: 'en-US-Neural2-E', ssmlGender: 'FEMALE' },
  'female-3': { name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
  'neutral': { name: 'en-US-Neural2-A', ssmlGender: 'NEUTRAL' },
}

export async function POST(req: Request) {
  try {
    if (!GOOGLE_API_KEY) {
      console.log('No Google Cloud API key found')
      return NextResponse.json({ error: 'NO_API_KEY' }, { status: 500 })
    }

    const { text, voice = 'male-1' } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const voiceConfig = VOICES[voice] || VOICES['male-1']

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'en-US',
            name: voiceConfig.name,
            ssmlGender: voiceConfig.ssmlGender,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google TTS API error:', response.status, errorText)
      return NextResponse.json({ error: 'GOOGLE_TTS_ERROR', details: errorText }, { status: 500 })
    }

    const data = await response.json()
    
    // Google returns base64 encoded audio
    const audioBuffer = Buffer.from(data.audioContent, 'base64')
    
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
  const hasKey = !!GOOGLE_API_KEY
  return NextResponse.json({
    configured: hasKey,
    voices: Object.keys(VOICES).map(id => ({
      id,
      name: id.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())
    }))
  })
}
