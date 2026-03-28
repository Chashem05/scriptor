import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const characters = await prisma.character.findMany({
      where: { projectId: id },
      include: { _count: { select: { lines: true } } },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(characters)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch characters' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { characterId, voice } = await req.json()

    const character = await prisma.character.update({
      where: { id: characterId },
      data: { voice }
    })

    return NextResponse.json(character)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update character' }, { status: 500 })
  }
}
