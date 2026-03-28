import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { content, filename } = await req.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Script content is required' }, { status: 400 })
    }

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id, userId: (session.user as any).id }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create or update script
    const script = await prisma.script.upsert({
      where: { projectId: id },
      update: { content, filename },
      create: { projectId: id, content, filename }
    })

    // Update project status
    await prisma.project.update({
      where: { id },
      data: { status: 'SCRIPT_UPLOADED' }
    })

    return NextResponse.json(script)
  } catch (error) {
    console.error('Script upload error:', error)
    return NextResponse.json({ error: 'Failed to save script' }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await prisma.project.findFirst({
      where: { id, userId: (session.user as any).id },
      include: { script: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project.script)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch script' }, { status: 500 })
  }
}
