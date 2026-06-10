import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { callGrok, callGrokWithHistory } from '../lib/grok'

export const aiRouter = Router()

// POST /parse-segment — natural language to segment rules
aiRouter.post('/parse-segment', async (req: Request, res: Response) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: 'text is required' })
    }

    const systemPrompt =
      'Extract CRM segment rules from natural language for an Indian fashion brand. Return ONLY a JSON object with optional fields: lastOrderDays (30, 60, 90, or 180), minSpend (500, 1000, 2000, 5000, or 10000), city (Mumbai, Delhi, Bangalore, Chennai, or Hyderabad), tag (VIP, churned, new, or loyal). No explanation. No markdown. Just JSON.'

    const raw = await callGrok(systemPrompt, text)

    try {
      const rules = JSON.parse(raw.trim())
      res.json({ rules })
    } catch {
      res.status(422).json({ error: 'Could not parse rules' })
    }
  } catch (err: any) {
    res.status(422).json({ error: 'Could not parse rules' })
  }
})

// POST /draft-message — generate message variants for a campaign
aiRouter.post('/draft-message', async (req: Request, res: Response) => {
  try {
    const { segmentName, channel, tone } = req.body

    const systemPrompt =
      'You write marketing messages for Indian D2C fashion brands. Return ONLY this JSON: { "variants": [{"id":"1","text":"..."},{"id":"2","text":"..."},{"id":"3","text":"..."}] }. Use [Name] as placeholder. Under 160 chars each. Clear CTA. No markdown.'

    const userMessage = `Write 3 ${channel || 'WhatsApp'} messages for segment: "${segmentName || 'customers'}". Tone: ${tone || 'friendly'}. Brand: StyleX Fashion.`

    try {
      const raw = await callGrok(systemPrompt, userMessage)
      const parsed = JSON.parse(raw.trim())
      res.json(parsed)
    } catch {
      // Hardcoded fallback variants
      res.json({
        variants: [
          { id: '1', text: 'Hi [Name]! 🛍️ Exclusive StyleX picks just for you. Shop now and get 20% off. Limited time only!' },
          { id: '2', text: 'Hey [Name], your StyleX faves are waiting! Don\'t miss our latest collection. Tap to explore.' },
          { id: '3', text: '[Name], we\'ve curated the perfect looks for you at StyleX. Grab them before they\'re gone! 🔥' }
        ]
      })
    }
  } catch (err: any) {
    res.json({
      variants: [
        { id: '1', text: 'Hi [Name]! 🛍️ Exclusive StyleX picks just for you. Shop now and get 20% off. Limited time only!' },
        { id: '2', text: 'Hey [Name], your StyleX faves are waiting! Don\'t miss our latest collection. Tap to explore.' },
        { id: '3', text: '[Name], we\'ve curated the perfect looks for you at StyleX. Grab them before they\'re gone! 🔥' }
      ]
    })
  }
})

// POST /chat — AI marketing assistant chat
aiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' })
    }

    const systemPrompt =
      'You are an AI marketing assistant for StyleX Fashion India. Respond ONLY with JSON: { "reply": "string", "action": { "type": "create_campaign", "segment": { "name": "string", "count": number }, "channel": "whatsapp|sms|email|rcs", "message": "string" } }. Omit action for questions. Max 3 sentences in reply.'

    try {
      const raw = await callGrokWithHistory(systemPrompt, messages)
      const parsed = JSON.parse(raw.trim())
      res.json(parsed)
    } catch {
      res.json({ reply: "I can help with that. What audience do you want to reach?" })
    }
  } catch (err: any) {
    res.json({ reply: "I can help with that. What audience do you want to reach?" })
  }
})

// GET /dashboard-insight — insight based on recent campaigns
aiRouter.get('/dashboard-insight', async (_req: Request, res: Response) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { _count: { select: { communications: true } } }
    })

    if (campaigns.length === 0) {
      return res.json({ insight: 'Send your first campaign to unlock AI-powered insights.' })
    }

    const systemPrompt =
      'One sentence insight + one recommended action from campaign data. Under 35 words. Plain text only.'

    const userMessage = `Recent campaigns: ${campaigns.map(c => `${c.name} (${c.status}, ${c._count.communications} recipients)`).join(', ')}`

    try {
      const raw = await callGrok(systemPrompt, userMessage)
      res.json({ insight: raw.trim() })
    } catch {
      res.json({ insight: 'Keep sending campaigns to unlock deeper AI insights.' })
    }
  } catch (err: any) {
    res.json({ insight: 'Keep sending campaigns to unlock deeper AI insights.' })
  }
})

// GET /campaign-insight/:id — insight for specific campaign
aiRouter.get('/campaign-insight/:id', async (req: Request, res: Response) => {
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

    const statsText = `Campaign: ${campaign.name}. Total: ${total}. Sent: ${counts['sent'] || 0}. Delivered: ${counts['delivered'] || 0}. Opened: ${counts['opened'] || 0}. Clicked: ${counts['clicked'] || 0}. Failed: ${counts['failed'] || 0}.`

    const systemPrompt =
      '1-2 sentences on campaign performance with numbers and one next action. Plain text only.'

    try {
      const raw = await callGrok(systemPrompt, statsText)
      res.json({ insight: raw.trim() })
    } catch {
      res.json({ insight: 'Insights will appear as delivery data comes in.' })
    }
  } catch (err: any) {
    res.json({ insight: 'Insights will appear as delivery data comes in.' })
  }
})
