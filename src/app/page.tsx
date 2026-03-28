import Link from 'next/link'
import { Button } from '../components/ui/button'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Scriptor</h1>
          <div className="flex gap-2">
            <Link href="/login"><Button variant="outline">Sign In</Button></Link>
            <Link href="/register"><Button>Get Started</Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-5xl font-bold mb-4">Rehearse with AI Scene Partners</h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
          Upload your script, assign voices to characters, and practice your lines with text-to-speech powered rehearsals.
        </p>
        <div className="flex gap-4">
          <Link href="/register"><Button size="lg">Start Free</Button></Link>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl">
          <div className="p-6 border rounded-lg">
            <div className="text-3xl mb-2">📝</div>
            <h3 className="font-bold mb-2">1. Upload Script</h3>
            <p className="text-muted-foreground text-sm">Paste your script and we'll automatically detect characters and dialogue.</p>
          </div>
          <div className="p-6 border rounded-lg">
            <div className="text-3xl mb-2">🎭</div>
            <h3 className="font-bold mb-2">2. Assign Voices</h3>
            <p className="text-muted-foreground text-sm">Choose different voices for each character in your scene.</p>
          </div>
          <div className="p-6 border rounded-lg">
            <div className="text-3xl mb-2">🎧</div>
            <h3 className="font-bold mb-2">3. Rehearse</h3>
            <p className="text-muted-foreground text-sm">Play your scene, mute your role, and practice your lines with AI scene partners.</p>
          </div>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-muted-foreground">
        Scriptor - Theatre Rehearsal App
      </footer>
    </div>
  )
}
