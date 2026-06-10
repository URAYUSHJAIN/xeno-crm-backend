import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

export const webhookRouter = Router()

const statusRank: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  failed: 5
}

// POST /receipt — receive delivery event from channel stub
webhookRouter.post('/receipt', async (req: Request, res: Response) => {
  try {
    const { communicationId, event, timestamp } = req.body

    const comm = await prisma.communication.findUnique({
      where: { id: communicationId }
    })

    if (!comm) {
      return res.status(404).json({ error: 'Communication not found' })
    }

    // Create log entry
    await prisma.communicationLog.create({
      data: {
        communicationId: comm.id,
        event,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      }
    })

    // Update status only if incoming rank is higher than current rank
    const incomingRank = statusRank[event] ?? -1
    const currentRank = statusRank[comm.status] ?? -1

    if (incomingRank > currentRank) {
      await prisma.communication.update({
        where: { id: comm.id },
        data: { status: event }
      })
    }

    res.json({ received: true })
  } catch (err: any) {
    console.error('[webhook] Error processing receipt:', err.message)
    res.json({ received: false })
  }
})
