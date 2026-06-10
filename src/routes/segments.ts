import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

export const segmentsRouter = Router()

export function buildWhereFromRules(rules: any) {
  const where: any = {}

  if (rules.lastOrderDays) {
    where.lastOrderAt = { lt: new Date(Date.now() - rules.lastOrderDays * 864e5) }
  }

  if (rules.minSpend) {
    where.totalSpend = { gte: rules.minSpend }
  }

  if (rules.city) {
    where.city = rules.city
  }

  if (rules.tag) {
    where.tags = { has: rules.tag }
  }

  return where
}

// GET / — all segments descending
segmentsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const segments = await prisma.segment.findMany({
      orderBy: { createdAt: 'desc' }
    })
    res.json(segments)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST / — create segment with calculated customerCount
segmentsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, rules } = req.body

    if (!name || !rules) {
      return res.status(400).json({ error: 'name and rules are required' })
    }

    const where = buildWhereFromRules(rules)
    const customerCount = await prisma.customer.count({ where })

    const segment = await prisma.segment.create({
      data: { name, rules, customerCount }
    })

    res.status(201).json(segment)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /preview — preview customer count and sample for given rules
segmentsRouter.post('/preview', async (req: Request, res: Response) => {
  try {
    const { rules } = req.body

    if (!rules) {
      return res.status(400).json({ error: 'rules are required' })
    }

    const where = buildWhereFromRules(rules)

    const [count, sample] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({ where, take: 3 })
    ])

    res.json({ count, sample })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /:id — delete segment
segmentsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.segment.delete({ where: { id: req.params.id } })
    res.json({ deleted: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
