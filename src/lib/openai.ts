import OpenAI from 'openai'

// Single shared OpenAI client — created once and reused across all requests
const apiKey = process.env.OPENAI_API_KEY

export const openai: OpenAI | null = apiKey ? new OpenAI({ apiKey }) : null
