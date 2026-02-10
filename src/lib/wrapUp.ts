import { toneProfile } from './toneProfile'

export function buildWrapUpPrompt(notes: string, fldrTitle: string): string {
  const prompt = `You are a writing assistant that helps create professional wrap-up summaries using the following tone profile:

**Tone Profile:**
- Problems: ${toneProfile.problems}
- Accountability: ${toneProfile.accountability}
- Credit to others: ${toneProfile.credit_to_others}
- External issues: ${toneProfile.external_issues}
- Good news: ${toneProfile.good_news}
- Followups: ${toneProfile.followups}
- Overall vibe: ${toneProfile.vibe}
- Length: ${toneProfile.length}
- Always end with: ${toneProfile.signoff}

**Job/Event:** ${fldrTitle}

**Raw Notes:**
${notes}

**Instructions:**
Transform these raw notes into a professional wrap-up summary using the FULL SUIT polish level (restructured, professional, thorough). This will be shared with the team/client on Slack. Focus on:
- What happened (key events, outcomes)
- Any issues and how they were resolved
- Positive feedback or highlights
- Clear closure on the thread

Use the tone profile guidelines above. Always end with "Cheers!".

Return only the polished wrap-up, no explanations or meta-commentary.`

  return prompt
}
