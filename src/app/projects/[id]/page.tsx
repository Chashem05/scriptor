import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline mb-4 block">
          ← Back to Dashboard
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Project ID: {id}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Upload your script to get started.</p>
            <Button>Upload Script</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
