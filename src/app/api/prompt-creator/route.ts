import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

const SYSTEM_PROMPT = `You rewrite AI image-generation prompts for a new job.

You will be given an ORIGINAL PROMPT that was built for a previous theme/background/character, along with a NEW THEME, NEW CHARACTER IDEA, and/or a VISION description for the next job. The vision is the user explaining, in their own words, what they're going for — treat it as the strongest signal of intent and let it drive the theme/character/background choices when it's given, filling in specifics the theme/character fields didn't spell out.

YOUR TASK:
- Keep the original prompt's structure, section headers, formatting, technical/style rules (color constraints, shading rules, skin tone rules, framing rules, etc.) EXACTLY as they are.
- Remove or replace only the parts of the prompt that reference the OLD theme, OLD location/background, and/or OLD character concept.
- Weave in the NEW THEME, NEW CHARACTER IDEA, and/or VISION in their place, matching the tone, level of detail, and level of strictness ("mandatory", "non-negotiable" language, etc.) of the original.
- If the original prompt references a specific place/background (e.g. a city skyline, a landmark), replace it consistently everywhere it's mentioned with a background that fits the new theme/vision, unless nothing calls for a background change — in that case keep the original background.
- Do not add commentary, explanations, headers like "Rewritten prompt:", or extra formatting — output ONLY the rewritten prompt text, ready to use as-is.`

const REFINE_SYSTEM_PROMPT = `You make a targeted revision to an AI image-generation prompt based on feedback from a test run.

You will be given the CURRENT PROMPT and GUIDANCE describing what the user saw when they tested it and what they want adjusted.

YOUR TASK:
- Apply ONLY the change(s) described in the guidance.
- Keep everything else in the prompt exactly the same — same structure, section headers, formatting, wording, and rules — except for the specific adjustment requested.
- Do not re-imagine or rewrite unrelated parts of the prompt.
- Do not add commentary, explanations, headers like "Revised prompt:", or extra formatting — output ONLY the revised prompt text, ready to use as-is.`

async function rewritePrompt(basePrompt: string, theme: string, character: string, vision: string): Promise<string> {
  if (!openai) throw new Error('OpenAI API key not configured')

  let userMessage = `ORIGINAL PROMPT:\n"""\n${basePrompt.trim()}\n"""\n\n`
  if (theme && theme.trim()) userMessage += `NEW THEME: ${theme.trim()}\n`
  if (character && character.trim()) userMessage += `NEW CHARACTER IDEA: ${character.trim()}\n`
  if (vision && vision.trim()) userMessage += `VISION (user's own description of what they want): ${vision.trim()}\n`
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

async function refinePrompt(currentPrompt: string, guidance: string): Promise<string> {
  if (!openai) throw new Error('OpenAI API key not configured')

  const userMessage = `CURRENT PROMPT:\n"""\n${currentPrompt.trim()}\n"""\n\nGUIDANCE: ${guidance.trim()}\n\nApply this guidance now, following the rules above.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: REFINE_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.5,
  })

  const revised = completion.choices[0]?.message?.content?.trim()
  if (!revised) throw new Error('No response from OpenAI')
  return revised
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode } = body

    if (mode === 'refine') {
      const { currentPrompt1, currentPrompt2, guidance } = body

      if (!currentPrompt1?.trim() && !currentPrompt2?.trim()) {
        return NextResponse.json({ error: 'Nothing to refine yet' }, { status: 400 })
      }
      if (!guidance?.trim()) {
        return NextResponse.json({ error: 'Enter guidance describing what to adjust' }, { status: 400 })
      }
      if (!openai) {
        return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
      }

      const [prompt1, prompt2] = await Promise.all([
        currentPrompt1?.trim() ? refinePrompt(currentPrompt1, guidance) : Promise.resolve(''),
        currentPrompt2?.trim() ? refinePrompt(currentPrompt2, guidance) : Promise.resolve(''),
      ])

      return NextResponse.json({ prompt1, prompt2 })
    }

    const { basePrompt1, basePrompt2, theme, character, vision } = body

    if (!basePrompt1?.trim() && !basePrompt2?.trim()) {
      return NextResponse.json({ error: 'At least one base prompt is required' }, { status: 400 })
    }
    if (!theme?.trim() && !character?.trim() && !vision?.trim()) {
      return NextResponse.json({ error: 'Provide a new theme, character idea, and/or vision' }, { status: 400 })
    }

    if (!openai) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const [prompt1, prompt2] = await Promise.all([
      basePrompt1?.trim() ? rewritePrompt(basePrompt1, theme, character, vision) : Promise.resolve(''),
      basePrompt2?.trim() ? rewritePrompt(basePrompt2, theme, character, vision) : Promise.resolve(''),
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
