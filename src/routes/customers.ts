import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'

export const customersRouter = Router()

// GET / — list customers with optional filters
customersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { search, city, tag, sort, limit } = req.query
    const take = parseInt((limit as string) || '200', 10)

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } }
      ]
    }

    if (city) {
      where.city = city as string
    }

    if (tag) {
      where.tags = { has: tag as string }
    }

    let orderBy: any = { createdAt: 'desc' }
    if (sort === 'spend_desc') orderBy = { totalSpend: 'desc' }
    else if (sort === 'spend_asc') orderBy = { totalSpend: 'asc' }
    else if (sort === 'name_asc') orderBy = { name: 'asc' }
    else if (sort === 'recent') orderBy = { lastOrderAt: 'desc' }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy, take }),
      prisma.customer.count({ where })
    ])

    res.json({ customers, total })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /:id — single customer with last 5 orders
customersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    res.json(customer)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /import — upsert array of customers by email
customersRouter.post('/import', async (req: Request, res: Response) => {
  try {
    const customers: any[] = req.body

    if (!Array.isArray(customers)) {
      return res.status(400).json({ error: 'Body must be an array of customers' })
    }

    let imported = 0
    for (const c of customers) {
      await prisma.customer.upsert({
        where: { email: c.email },
        update: {
          name: c.name,
          phone: c.phone,
          city: c.city,
          tags: c.tags || [],
          totalSpend: c.totalSpend ?? 0,
          lastOrderAt: c.lastOrderAt ? new Date(c.lastOrderAt) : null
        },
        create: {
          name: c.name,
          email: c.email,
          phone: c.phone,
          city: c.city,
          tags: c.tags || [],
          totalSpend: c.totalSpend ?? 0,
          lastOrderAt: c.lastOrderAt ? new Date(c.lastOrderAt) : null
        }
      })
      imported++
    }

    res.json({ imported })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
