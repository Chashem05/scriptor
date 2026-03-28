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

    const project = await prisma.project.findFirst({
      where: { id, userId: (session.user as any).id },
      include: { script: true }
    })

    if (!project || !project.script) {
      return NextResponse.json({ error: 'No script found' }, { status: 404 })
    }

    // Delete existing parsed data
    await prisma.line.deleteMany({ where: { projectId: id } })
    await prisma.character.deleteMany({ where: { projectId: id } })

    // Parse script - detect CHARACTER: dialogue pattern
    const lines = project.script.content.split('\n')
    const characterNames = new Set<string>()
    const parsedLines: { character: string | null; content: string; type: string }[] = []

    const characterPattern = /^([A-Z][A-Z\s]{1,30})[:.](.*)$/
    const stageDirectionPattern = /^\s*\[.*\]\s*$|^\s*\(.*\)\s*$/

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (stageDirectionPattern.test(trimmed)) {
        parsedLines.push({ character: null, content: trimmed, type: 'direction' })
      } else {
        const match = trimmed.match(characterPattern)
        if (match) {
          const charName = match[1].trim()
          const dialogue = match[2].trim()
          characterNames.add(charName)
          parsedLines.push({ character: charName, content: dialogue || '...', type: 'dialogue' })
        } else {
          // Continuation of previous dialogue or narration
          if (parsedLines.length > 0 && parsedLines[parsedLines.length - 1].type === 'dialogue') {
            parsedLines[parsedLines.length - 1].content += ' ' + trimmed
          } else {
            parsedLines.push({ character: null, content: trimmed, type: 'narration' })
          }
        }
      }
    }

    // Create characters
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']
    const characters: Record<string, string> = {}
    let colorIndex = 0

    for (const name of Array.from(characterNames)) {
      const char = await prisma.character.create({
        data: {
          projectId: id,
          name,
          color: colors[colorIndex % colors.length]
        }
      })
      characters[name] = char.id
      colorIndex++
    }

    // Create lines
    for (let i = 0; i < parsedLines.length; i++) {
      const pl = parsedLines[i]
      await prisma.line.create({
        data: {
          projectId: id,
          characterId: pl.character ? characters[pl.character] : null,
          lineNumber: i + 1,
          type: pl.type,
          content: pl.content
        }
      })
    }

    // Update project status
    await prisma.project.update({
      where: { id },
      data: { status: 'PARSED' }
    })

    return NextResponse.json({ 
      characters: characterNames.size,
      lines: parsedLines.length 
    })
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({ error: 'Failed to parse script' }, { status: 500 })
  }
}
