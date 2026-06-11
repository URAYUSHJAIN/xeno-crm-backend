import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

import { customersRouter } from './routes/customers'
import { segmentsRouter } from './routes/segments'
import { campaignsRouter } from './routes/campaigns'
import { webhookRouter } from './routes/webhook'
import { aiRouter } from './routes/ai'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
    ]
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'xeno-crm-server', timestamp: new Date().toISOString() })
})

app.use('/api/customers', customersRouter)
app.use('/api/segments', segmentsRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/webhook', webhookRouter)
app.use('/api/ai', aiRouter)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`CRM Server running on port ${PORT}`)
  if (!process.env.GROQ_API_KEY) console.warn('WARNING: GROQ_API_KEY not set')
  if (!process.env.CHANNEL_STUB_URL) console.warn('WARNING: CHANNEL_STUB_URL not set')
  if (!process.env.DATABASE_URL) console.warn('WARNING: DATABASE_URL not set')
})