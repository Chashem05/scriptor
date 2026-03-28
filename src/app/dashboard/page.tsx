'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'

type Project = {
  id: string
  title: string
  description: string | null
  status: string
  createdAt: string
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setProjects(data)
        setLoading(false)
      })
  }, [])

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SCRIPT_UPLOADED: 'bg-blue-100 text-blue-700',
    PARSED: 'bg-green-100 text-green-700',
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Manage your rehearsal projects</p>
          </div>
          <Link href="/projects/new">
            <Button>+ New Project</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Projects</CardTitle>
            <CardDescription>{projects.length} projects</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : projects.length === 0 ? (
              <p className="text-muted-foreground">No projects yet. Create your first project to get started.</p>
            ) : (
              <div className="space-y-3">
                {projects.map(project => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="flex items-center justify-between p-4 border rounded hover:bg-gray-50 cursor-pointer">
                      <div>
                        <div className="font-medium">{project.title}</div>
                        {project.description && (
                          <div className="text-sm text-muted-foreground">{project.description}</div>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[project.status] || 'bg-gray-100'}`}>
                        {project.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
