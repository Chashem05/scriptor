'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { Label } from '../../../components/ui/label'

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string
  
  const [script, setScript] = useState<string>('')
  const [savedScript, setSavedScript] = useState<string | null>(null)
  const [filename, setFilename] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Fetch existing script
    fetch(`/api/projects/${id}/script`)
      .then(res => res.json())
      .then(data => {
        if (data?.content) {
          setSavedScript(data.content)
          setScript(data.content)
          setFilename(data.filename || '')
        }
      })
      .catch(() => {})
  }, [id])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    setScript(text)
    setFilename(file.name)
  }

  async function handleSave() {
    setLoading(true)
    setMessage('')

    const res = await fetch(`/api/projects/${id}/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: script, filename })
    })

    if (res.ok) {
      setSavedScript(script)
      setMessage('Script saved successfully!')
    } else {
      setMessage('Failed to save script')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline mb-4 block">
          ← Back to Dashboard
        </Link>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload Script</CardTitle>
            <CardDescription>Paste your script or upload a text file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="file">Upload .txt file</Label>
              <input
                id="file"
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white file:cursor-pointer"
              />
            </div>
            
            <div>
              <Label htmlFor="script">Or paste script here</Label>
              <textarea
                id="script"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Paste your script here..."
                className="mt-2 w-full h-64 p-3 border rounded-md font-mono text-sm"
              />
            </div>

            {message && (
              <p className={message.includes('success') ? 'text-green-600' : 'text-red-600'}>
                {message}
              </p>
            )}

            <Button onClick={handleSave} disabled={loading || !script.trim()}>
              {loading ? 'Saving...' : 'Save Script'}
            </Button>
          </CardContent>
        </Card>

        {savedScript && (
          <Card>
            <CardHeader>
              <CardTitle>Saved Script</CardTitle>
              {filename && <CardDescription>{filename}</CardDescription>}
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded max-h-96 overflow-auto">
                {savedScript}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
