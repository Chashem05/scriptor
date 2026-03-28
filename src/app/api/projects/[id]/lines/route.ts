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

    const lines = await prisma.line.findMany({
      where: { projectId: id },
      include: { character: true },
      orderBy: { lineNumber: 'asc' }
    })

    return NextResponse.json(lines)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch lines' }, { status: 500 })
  }
}
