import { Router, Request, Response } from 'express'
import axios from 'axios'
import prisma from '../lib/prisma'
import { buildWhereFromRules } from './segments'

export const campaignsRouter = Router()

// GET / — list campaigns with segment name + communication count
campaignsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        segment: { select: { name: true } },
        _count: { select: { communications: true } }
      }
    })
    res.json(campaigns)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /:id — single campaign
campaignsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        segment: true,
        _count: { select: { communications: true } }
      }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    res.json(campaign)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST / — create draft campaign
campaignsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, segmentId, channel, messageTemplate, scheduledAt } = req.body

    if (!name || !segmentId || !channel || !messageTemplate) {
      return res.status(400).json({ error: 'name, segmentId, channel, and messageTemplate are required' })
    }

    const segment = await prisma.segment.findUnique({ where: { id: segmentId } })
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found. Please select a valid segment.' })
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        segmentId,
        channel,
        messageTemplate,
        status: 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null
      }
    })

    res.status(201).json(campaign)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /:id/send — send campaign to all segment customers
campaignsRouter.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: { segment: true }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    const where = buildWhereFromRules(campaign.segment.rules)
    const customers = await prisma.customer.findMany({ where })

    // Create communications individually to get IDs back
    const comms = []
    for (const customer of customers) {
      const message = campaign.messageTemplate.replace(/\[Name\]/g, customer.name)
      const comm = await prisma.communication.create({
        data: {
          campaignId: campaign.id,
          customerId: customer.id,
          message,
          channel: campaign.channel,
          status: 'queued'
        }
      })
      comms.push({ comm, customer })
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'sending', sentAt: new Date() }
    })

    // Return immediately, fire stub calls concurrently
    res.json({ campaignId: campaign.id, queued: comms.length })

    const stubUrl = process.env.CHANNEL_STUB_URL || 'http://localhost:3002'
    Promise.allSettled(
      comms.map(({ comm, customer }) =>
        axios.post(
          `${stubUrl}/send`,
          {
            communicationId: comm.id,
            recipient: customer.phone || customer.email,
            channel: campaign.channel,
            message: comm.message
          },
          { timeout: 10000 }
        )
      )
    ).then(results => {
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed > 0) {
        console.warn(`[campaigns] ${failed}/${comms.length} stub calls failed for campaign ${campaign.id}`)
      }
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /:id/stats — aggregated delivery stats
campaignsRouter.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id }
    })

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    const grouped = await prisma.communication.groupBy({
      by: ['status'],
      where: { campaignId: req.params.id },
      _count: { status: true }
    })

    const counts: Record<string, number> = {}
    for (const g of grouped) {
      counts[g.status] = g._count.status
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0)

    res.json({
      campaignId: campaign.id,
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      total,
      sent: counts['sent'] || 0,
      delivered: counts['delivered'] || 0,
      opened: counts['opened'] || 0,
      clicked: counts['clicked'] || 0,
      failed: counts['failed'] || 0,
      pending: counts['queued'] || 0
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /:id/communications — first 50 comms with customer name + latest log
campaignsRouter.get('/:id/communications', async (req: Request, res: Response) => {
  try {
    const communications = await prisma.communication.findMany({
      where: { campaignId: req.params.id },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, email: true } },
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    })

    res.json(communications)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
