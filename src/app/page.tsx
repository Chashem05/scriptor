import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Scriptor</h1>
      <p className="text-muted-foreground mb-8">Theatre rehearsal with AI scene partners</p>
      <div className="flex gap-4">
        <Link href="/login"><Button variant="outline">Sign In</Button></Link>
        <Link href="/register"><Button>Get Started</Button></Link>
      </div>
    </div>
  )
}
