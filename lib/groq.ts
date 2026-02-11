type GroqMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function getGroqReply(messages: GroqMessage[]) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.4,
        max_tokens: 400
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    return typeof content === 'string' ? content.trim() : null
  } catch {
    return null
  }
}
