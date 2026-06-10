import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3002
const CRM_URL = process.env.CRM_URL || 'http://localhost:3001'

app.use(cors())
app.use(express.json())

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function sendWebhook(communicationId: string, event: string) {
  try {
    await axios.post(
      `${CRM_URL}/api/webhook/receipt`,
      {
        communicationId,
        event,
        timestamp: new Date().toISOString()
      },
      { timeout: 5000 }
    )
    console.log(`[stub] ✓ ${event.padEnd(10)} → ${communicationId}`)
  } catch (err: any) {
    console.error(`[stub] ✗ ${event} failed for ${communicationId}: ${err.message}`)
  }
}

async function simulateDelivery(communicationId: string, channel: string, recipient: string) {
  // Step 1: sent
  await delay(randomBetween(300, 1200))
  await sendWebhook(communicationId, 'sent')

  // Step 2: delivery outcome
  const deliveryRoll = randomBetween(1, 100)
  if (deliveryRoll <= 10) {
    await delay(randomBetween(500, 1500))
    await sendWebhook(communicationId, 'failed')
    return
  }

  await delay(randomBetween(800, 2500))
  await sendWebhook(communicationId, 'delivered')

  // Step 3: engagement
  const openRoll = randomBetween(1, 100)
  if (openRoll > 25) return

  await delay(randomBetween(1000, 4000))
  await sendWebhook(communicationId, 'opened')

  const clickRoll = randomBetween(1, 100)
  if (clickRoll <= 60) {
    await delay(randomBetween(500, 2000))
    await sendWebhook(communicationId, 'clicked')
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'xeno-channel-stub', timestamp: new Date().toISOString() })
})

app.post('/send', (req, res) => {
  const { communicationId, recipient, channel, message } = req.body

  if (!communicationId) {
    return res.status(400).json({ error: 'communicationId required' })
  }

  res.json({ status: 'queued', communicationId, channel })

  console.log(`[stub] Queued ${channel?.toUpperCase().padEnd(10)} → ${recipient} (${communicationId})`)

  simulateDelivery(communicationId, channel, recipient).catch(err =>
    console.error(`[stub] Simulation crashed for ${communicationId}:`, err.message)
  )
})

app.listen(PORT, () => {
  console.log(`Channel Stub running on port ${PORT}`)
  console.log(`Callbacks → ${CRM_URL}`)
})
