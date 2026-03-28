import { NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// ElevenLabs voice library - more voices with paid subscription
const VOICES: Record<string, { id: string; name: string; style: string }> = {
  // Male voices
  'adam': { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', style: 'Deep, Narration' },
  'antoni': { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', style: 'Warm, Friendly' },
  'arnold': { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', style: 'Crisp, Confident' },
  'brian': { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', style: 'Deep, Narrator' },
  'callum': { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', style: 'Intense, Hoarse' },
  'charlie': { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', style: 'Australian, Natural' },
  'clyde': { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde', style: 'War Veteran, Deep' },
  'daniel': { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', style: 'British, Deep' },
  'dave': { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave', style: 'British, Conversational' },
  'ethan': { id: 'g5CIjZEefAph4nQFvHAz', name: 'Ethan', style: 'Soft, ASMR' },
  'fin': { id: 'D38z5RcWu1voky8WS1ja', name: 'Fin', style: 'Irish, Sailor' },
  'george': { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', style: 'British, Warm' },
  'harry': { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry', style: 'British, Anxious' },
  'james': { id: 'ZQe5CZNOzWyzPSCn5a3c', name: 'James', style: 'Australian, Calm' },
  'jeremy': { id: 'bVMeCyTHy58xNoL34h3p', name: 'Jeremy', style: 'Irish, Excited' },
  'josh': { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', style: 'Young, Deep' },
  'liam': { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', style: 'Young, Articulate' },
  'marcus': { id: 'IdkH88NnEJiPkwoHoAfP', name: 'Marcus', style: 'Authoritative, Calm' },
  'michael': { id: 'flq6f7yk4E4fJM5XTYuZ', name: 'Michael', style: 'Old, Raspy' },
  'patrick': { id: 'ODq5zmih8GrVes37Dizd', name: 'Patrick', style: 'Shouty, Warrior' },
  'sam': { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', style: 'Raspy, Young' },
  'thomas': { id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas', style: 'American, Calm' },
  
  // Female voices
  'alice': { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', style: 'British, Confident' },
  'aria': { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', style: 'American, Expressive' },
  'bella': { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', style: 'Soft, Young' },
  'charlotte': { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', style: 'Swedish, Seductive' },
  'domi': { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', style: 'Strong, Assertive' },
  'dorothy': { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', style: 'British, Pleasant' },
  'elli': { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', style: 'Emotional, Young' },
  'emily': { id: 'LcfcDJNUP1GQjkzn1xUU', name: 'Emily', style: 'American, Calm' },
  'freya': { id: 'jsCqWAovK2LkecY7zXl4', name: 'Freya', style: 'American, Expressive' },
  'gigi': { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', style: 'Childish, Animated' },
  'glinda': { id: 'z9fAnlkpzviPz146aGWa', name: 'Glinda', style: 'Witch, Fierce' },
  'grace': { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace', style: 'Southern, Gentle' },
  'jessie': { id: 't0jbNlBVZ17f02VDIeMI', name: 'Jessie', style: 'Raspy, Fast' },
  'lily': { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', style: 'British, Warm' },
  'matilda': { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', style: 'Warm, Friendly' },
  'mimi': { id: 'zrHiDhphv9ZnVXBqCLjz', name: 'Mimi', style: 'Swedish, Childish' },
  'nicole': { id: 'piTKgcLEGmPE4e6mEKli', name: 'Nicole', style: 'Soft, Whisper' },
  'rachel': { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', style: 'Calm, Narration' },
  'serena': { id: 'pMsXgVXv3BLzUgSXRplE', name: 'Serena', style: 'Soft, Pleasant' },
}

export async function POST(req: Request) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'NO_API_KEY' }, { status: 500 })
    }

    const { 
      text, 
      voice = 'josh',
      stability = 0.5,
      similarity = 0.75,
      style = 0.0,
      speed = 1.0,
    } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const voiceData = VOICES[voice] || VOICES['josh']

    const response = await fetch(`https://api.us.elevenlabs.io/v1/text-to-speech/${voiceData.id}`, {
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
          stability: Math.max(0, Math.min(1, stability)),
          similarity_boost: Math.max(0, Math.min(1, similarity)),
          style: Math.max(0, Math.min(1, style)),
          use_speaker_boost: true,
          speed: Math.max(0.7, Math.min(1.2, speed)),
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs error:', response.status, errorText)
      return NextResponse.json({ error: 'ELEVENLABS_ERROR', details: errorText }, { status: 500 })
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (error) {
    console.error('TTS error:', error)
    return NextResponse.json({ error: 'TTS_ERROR', message: String(error) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    configured: !!ELEVENLABS_API_KEY,
    voices: Object.entries(VOICES).map(([id, v]) => ({ id, name: v.name, style: v.style }))
  })
}
