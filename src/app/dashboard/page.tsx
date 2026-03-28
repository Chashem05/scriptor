import Link from 'next/link'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'

export default function DashboardPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Link href="/projects/new">
            <Button>New Project</Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Your Projects</CardTitle>
            <CardDescription>Manage your rehearsal projects</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No projects yet. Create your first project to get started.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
