import Groq from 'groq-sdk'

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

const MODEL = 'llama-3.3-70b-versatile'

export async function callGroq(systemPrompt: string, userMessage: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    max_tokens: 1000,
    temperature: 0.7
  })

  return completion.choices[0].message.content || ''
}

export async function callGroqWithHistory(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages as any
    ],
    max_tokens: 1000,
    temperature: 0.7
  })

  return completion.choices[0].message.content || ''
}
