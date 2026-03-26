'use strict'

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3.1:free'
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'models/gemini-1.5-pro-latest'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY

const FALLBACK_RESPONSE = `GoHype Media builds immersive 3D sites, bold motion design, and ultra-fast marketing experiences.

- 3D Website Development
- Immersive UI/UX & Micro-interactions
- Web Performance + CRO

Contact us at info@gohypemedia.com or +91 98108 10034 for a custom quote.`

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch (error) {
    console.error('Failed to parse body', error)
    return res.status(400).send('Invalid JSON payload.')
  }

  const history = Array.isArray(body?.history) ? body.history : null
  if (!history || history.length === 0) {
    return res.status(400).send('Chat history is required.')
  }

  try {
    const reply =
      (OPENAI_API_KEY && (await callOpenAI(history))) ||
      (OPENROUTER_API_KEY && (await callOpenRouter(history))) ||
      (GOOGLE_API_KEY && (await callGemini(history))) ||
      buildFallback(history)

    return res.status(200).send(reply)
  } catch (error) {
    console.error('/api/chat error', error)
    return res.status(500).send(`Error processing your request: ${error.message}`)
  }
}

async function readJsonBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body
  }
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function formatMessages(history) {
  return history.map((message) => ({
    role: message.sender === 'user' ? 'user' : 'assistant',
    content: String(message.content || ''),
  }))
}

async function callOpenAI(history) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are GoHype Bot, a concise assistant for GoHype Media. Answer in 2-3 short paragraphs max.',
          },
          ...formatMessages(history),
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    })

    if (!response.ok) {
      console.error('OpenAI error', await response.text())
      return null
    }

    const data = await response.json()
    return (
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      null
    )
  } catch (error) {
    console.error('OpenAI request failed', error)
    return null
  }
}

async function callOpenRouter(history) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are GoHype Bot, a concise assistant for GoHype Media. Keep answers brief and actionable.',
          },
          ...formatMessages(history),
        ],
      }),
    })

    if (!response.ok) {
      console.error('OpenRouter error', await response.text())
      return null
    }

    const data = await response.json()
    return (
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      null
    )
  } catch (error) {
    console.error('OpenRouter request failed', error)
    return null
  }
}

async function callGemini(history) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: history.map((message) => ({
            role: message.sender === 'user' ? 'user' : 'model',
            parts: [{ text: String(message.content || '') }],
          })),
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
          ],
        }),
      },
    )

    if (!response.ok) {
      console.error('Gemini error', await response.text())
      return null
    }

    const data = await response.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch (error) {
    console.error('Gemini request failed', error)
    return null
  }
}

function buildFallback(history) {
  const last = history[history.length - 1]
  const lastText = String(last?.content || '').toLowerCase()
  if (/contact|phone|email|address/.test(lastText)) {
    return `You can reach GoHype Media at info@gohypemedia.com or +91 98108 10034 (Mon–Sat, 10 AM – 6:30 PM IST).\nAddress: D-6/1, Pocket D, Okhla Phase II, New Delhi 110020.`
  }
  if (/service|offer|what do you do|help/.test(lastText)) {
    return `GoHype Media specializes in:\n• 3D & immersive website development\n• Motion-rich UI/UX design\n• Performance-focused marketing sites and landing pages\nLet me know what you need and I can share next steps.`
  }
  return FALLBACK_RESPONSE
}
