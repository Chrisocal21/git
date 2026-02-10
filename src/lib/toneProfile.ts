export const toneProfile = {
  problems: "Soften delivery, explain what happened + how it was resolved",
  accountability: "Own mistakes with reflection - 'In hindsight, I should have...' - not self-deprecation",
  credit_to_others: "Simple and direct - don't over-explain why someone was good",
  external_issues: "Acknowledge without blame, give context without over-saturating",
  good_news: "Let it breathe - share positive feedback with warmth",
  followups: "Add closure - show the thread is handed off, not dangling",
  
  vibe: "Thorough and considerate - reader feels you thought it through",
  length: "Always give substance, even on smooth jobs",
  signoff: "Cheers!",
  
  polish_levels: {
    light: "Grammar + clarity, stays close to original, maintains Chris's voice",
    full_suit: "Restructured, professional, thorough - polished but still Chris"
  }
}

export function buildPolishPrompt(draft: string, originalMessage: string | null, polishLevel: 'light' | 'full_suit'): string {
  const levelDescription = toneProfile.polish_levels[polishLevel]
  
  let prompt = `You are a writing assistant that helps polish messages using the following tone profile:

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

**Polish Level: ${polishLevel.toUpperCase()}**
${levelDescription}

`

  if (originalMessage) {
    prompt += `**Original message being replied to:**
${originalMessage}

`
  }

  prompt += `**Draft to polish:**
${draft}

**Instructions:**
Polish the draft according to the ${polishLevel} level guidelines above. ${polishLevel === 'full_suit' ? 'Restructure for clarity and professionalism while maintaining the authentic voice.' : 'Keep it close to the original while fixing grammar and improving clarity.'} Always end with "Cheers!".

Return only the polished message, no explanations or meta-commentary.`

  return prompt
}
