import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

const SYSTEM_PROMPT = `You rewrite AI image-generation prompts for a new job.

You will be given an ORIGINAL PROMPT that was built for a previous theme/background/character, along with a NEW THEME and/or NEW CHARACTER IDEA for the next job.

YOUR TASK:
- Keep the original prompt's structure, section headers, formatting, technical/style rules (color constraints, shading rules, skin tone rules, framing rules, etc.) EXACTLY as they are.
- Remove or replace only the parts of the prompt that reference the OLD theme, OLD location/background, and/or OLD character concept.
- Weave in the NEW THEME and/or NEW CHARACTER IDEA in their place, matching the tone, level of detail, and level of strictness ("mandatory", "non-negotiable" language, etc.) of the original.
- If the original prompt references a specific place/background (e.g. a city skyline, a landmark), replace it consistently everywhere it's mentioned with a background that fits the new theme, unless the new theme doesn't call for a background change — in that case keep the original background.
- Do not add commentary, explanations, headers like "Rewritten prompt:", or extra formatting — output ONLY the rewritten prompt text, ready to use as-is.`

async function rewritePrompt(basePrompt: string, theme: string, character: string): Promise<string> {
  if (!openai) throw new Error('OpenAI API key not configured')

  let userMessage = `ORIGINAL PROMPT:\n"""\n${basePrompt.trim()}\n"""\n\n`
  if (theme && theme.trim()) userMessage += `NEW THEME: ${theme.trim()}\n`
  if (character && character.trim()) userMessage += `NEW CHARACTER IDEA: ${character.trim()}\n`
  userMessage += `\nRewrite the prompt now, following the rules above.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.8,
  })

  const newPrompt = completion.choices[0]?.message?.content?.trim()
  if (!newPrompt) throw new Error('No response from OpenAI')
  return newPrompt
}

export async function POST(request: NextRequest) {
  try {
    const { basePrompt1, basePrompt2, theme, character } = await request.json()

    if (!basePrompt1?.trim() && !basePrompt2?.trim()) {
      return NextResponse.json({ error: 'At least one base prompt is required' }, { status: 400 })
    }
    if (!theme?.trim() && !character?.trim()) {
      return NextResponse.json({ error: 'Provide a new theme and/or character idea' }, { status: 400 })
    }

    if (!openai) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const [prompt1, prompt2] = await Promise.all([
      basePrompt1?.trim() ? rewritePrompt(basePrompt1, theme, character) : Promise.resolve(''),
      basePrompt2?.trim() ? rewritePrompt(basePrompt2, theme, character) : Promise.resolve(''),
    ])

    return NextResponse.json({ prompt1, prompt2 })
  } catch (error) {
    console.error('Prompt creator error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate prompt' },
      { status: 500 }
    )
  }
}
