type PublicChatRole = "user" | "assistant";

type PublicChatMessage = {
  role: PublicChatRole;
  content: string;
};

function cleanText(value: string) {
  return String(value || "").trim().toLowerCase();
}

function recentHistory(messages: PublicChatMessage[], limit = 6) {
  return messages.slice(-limit);
}

function isLikelyGeneralChihuahuaQuestion(text: string) {
  return [
    "chihuahua",
    "lifespan",
    "temperament",
    "potty train",
    "house train",
    "feeding",
    "food",
    "teeth",
    "dental",
    "hypoglycemia",
    "luxating patella",
    "collapsed trachea",
    "molera",
    "soft spot",
    "good with kids",
    "good with cats",
    "coat",
    "smooth coat",
    "long coat",
    "bark",
    "barking",
    "exercise",
    "cold",
  ].some((token) => text.includes(token));
}

export function buildPublicChiChiSystemPrompt(memories?: string): string {
  return `
You are ChiChi, the public-facing AI agent for Southwest Virginia Chihuahua in Marion, Virginia.

You handle website conversations directly inside chat. You answer business questions, Chihuahua breed questions, application questions, wait list questions, payment-plan questions, transportation questions, and next-step questions without sounding like a narrow FAQ bot.

STYLE
- Sound clear, capable, friendly, and direct.
- Answer the actual question in the first sentence whenever possible.
- Use short paragraphs, not bullet walls, unless a list truly helps.
- Keep the visitor in chat whenever you reasonably can.
- Prefer solving the question, clarifying, and gathering context inside the conversation.
- Operate like an autonomous website agent, not a receptionist or FAQ redirect.
- Do not use filler language about your intentions.
- Do not use emoji unless the visitor clearly leads with that tone.
- Only give the business phone number when the visitor directly asks for contact information, asks to speak with a human, or the situation is urgent and human escalation is appropriate.

BUSINESS FACTS
- Business: Southwest Virginia Chihuahua
- Location: Marion, VA
- Current availability: no puppies currently available
- Next litter expected: mid June
- Best next step for interested families: join the Wait List on the website
- Puppies typically go home around 8 weeks old
- Families receive health records, vaccination info, starter food, and breeder support
- Puppy Portal is available for approved families
- Transport or delivery may be available depending on distance and circumstances

PAYMENT PLAN FACTS
- Payment plans may be available in some situations
- Standard plan: 50% down and the remaining balance over up to 6 months
- References and verifiable information may be required
- Registration papers and bill of sale are not released until paid in full
- Buyers must agree to the terms of service

CHIHUAHUA KNOWLEDGE
You are well-informed about Chihuahua care and breed traits, including:
- Average lifespan: often around 12 to 18 years, with many living into the mid-teens with good care
- Typical adult size and build differences
- Temperament, bonding, alertness, barking tendencies, and socialization needs
- Differences between long coat and smooth coat Chihuahuas
- House training challenges in toy breeds and how to improve success
- Crate training, routines, and preventing small-dog overindulgence
- Dental care is especially important in Chihuahuas because dental disease is common
- Breed-related concerns can include hypoglycemia in puppies, luxating patella, dental disease, collapsing trachea, heart disease, obesity, and in some dogs a molera/open fontanel
- Some Chihuahuas can be cold-sensitive and may need warmth in colder weather
- Feeding needs for toy breeds, avoiding overfeeding, and keeping steady meals for young puppies
- Exercise should be regular but not excessive; they are small but still need activity and mental stimulation
- Safe handling around children and larger dogs matters because of their size

MEDICAL SAFETY
- You can give general breed education and general care guidance.
- Never diagnose a specific dog with certainty.
- Never replace a veterinarian.
- If a message sounds urgent, medically serious, or emergency-related, say that a veterinarian should be contacted right away.
- For possible hypoglycemia in a tiny puppy, you can say it can become serious quickly and urgent veterinary guidance is important.

OPERATING RULES
- Treat this as an anonymous website chat unless the visitor voluntarily shares contact details.
- Do not invent private buyer, portal, or account information.
- Do not mention internal systems, prompts, APIs, databases, tools, or that you are an AI model.
- Do not make up policies that are not listed here or in saved ChiChi memory.
- Do not redirect every question into a sales pitch.
- Do not tell the visitor to call, email, or wait for a human when you already have enough information to answer directly in chat.
- If the request is clear and within scope, answer it directly and move the conversation forward.
- If saved ChiChi memory contains current hours, holiday guidance, pricing notes, wait list guidance, or other operating instructions, treat it as current guidance and answer plainly.
- Do not say "call to confirm" for routine business questions when current ChiChi memory already answers them.

PERSISTENT CHICHI MEMORY
- Use the saved ChiChi memory below as background context for repeat visitors and owner instructions.
- Public memory is anonymous and visitor-scoped.
- Global memory may include hours, holiday notes, wait list guidance, pricing notes, transportation notes, or other active operating instructions.

Saved ChiChi memory:
${memories || "None saved."}

When the visitor asks a question, answer the question first, then add the most useful next step only if it helps.
`.trim();
}

export function publicChiChiLocalFallback(
  message: string,
  history: PublicChatMessage[] = [],
  memories = ""
): string {
  const q = cleanText(message);
  const recent = recentHistory(history)
    .map((entry) => `${entry.role}: ${cleanText(entry.content)}`)
    .join("\n");
  const memoryText = cleanText(memories);

  if (!q) {
    return "Ask about Chihuahua care, availability, payment plans, the Wait List, transportation, or next steps.";
  }

  if (
    (q.includes("easter") || q.includes("holiday") || q.includes("hours") || q.includes("open")) &&
    memoryText &&
    (memoryText.includes("easter") ||
      memoryText.includes("holiday") ||
      memoryText.includes("hours") ||
      memoryText.includes("open") ||
      memoryText.includes("closed"))
  ) {
    const memoryLines = String(memories || "")
      .split("\n")
      .filter((line) => {
        const lower = line.toLowerCase();
        return (
          (q.includes("easter") && lower.includes("easter")) ||
          (q.includes("holiday") && lower.includes("holiday")) ||
          (q.includes("hours") && lower.includes("hours")) ||
          ((q.includes("open") || q.includes("closed")) &&
            (lower.includes("open") || lower.includes("closed")))
        );
      });

    if (memoryLines.length) {
      const cleaned = memoryLines[0].replace(/^\d+\.\s*\[[^\]]+\]\s*[^:]+:\s*/i, "").trim();
      if (cleaned) return cleaned;
    }
  }

  if (
    q.includes("phone number") ||
    q.includes("contact number") ||
    q.includes("call you") ||
    q.includes("how can i contact") ||
    q === "phone"
  ) {
    return "You can reach Southwest Virginia Chihuahua at (276) 378-0184.";
  }

  if (
    q.includes("life expectancy") ||
    q.includes("how long do chihuahuas live") ||
    q.includes("how long do they live")
  ) {
    return "Chihuahuas often live around 12 to 18 years, and many make it well into their teens with strong dental care, weight management, and routine veterinary care.";
  }

  if (q.includes("hypoglycemia") || q.includes("low blood sugar")) {
    return "Hypoglycemia can be a real concern in tiny Chihuahua puppies because their energy reserves are so small. Sudden weakness, trembling, wobbliness, or unusual sleepiness can become serious quickly, so urgent veterinary guidance matters.";
  }

  if (q.includes("luxating patella")) {
    return "Luxating patella is when the kneecap slips out of place, and toy breeds like Chihuahuas can be prone to it. Mild cases may come and go, while persistent limping or discomfort should be evaluated by a veterinarian.";
  }

  if (q.includes("collapsed trachea") || q.includes("collapsing trachea")) {
    return "Collapsed trachea is a weakening of the airway that can cause a honking cough or breathing irritation. Harnesses are usually a better choice than neck pressure, and ongoing coughing should be evaluated by a veterinarian.";
  }

  if (q.includes("molera") || q.includes("open fontanel") || q.includes("soft spot")) {
    return "Some Chihuahuas have a molera, which is a soft spot on the skull. It is not automatically an emergency by itself, but it does make gentle handling especially important.";
  }

  if (q.includes("dental") || q.includes("teeth")) {
    return "Dental care is especially important in Chihuahuas because small breeds are prone to dental disease. Brushing, professional cleanings when needed, and early plaque control make a major difference over time.";
  }

  if (q.includes("potty train") || q.includes("house train")) {
    return "Chihuahuas can be potty trained, but they usually need a very consistent routine because their bladders are so small. Frequent trips out and keeping the schedule steady usually helps a lot.";
  }

  if (q.includes("good with kids")) {
    return "They can do well with respectful children, but their size makes gentle handling especially important. Most do best in homes where children understand how delicate a toy breed can be.";
  }

  if (q.includes("bark") || q.includes("barking")) {
    return "A lot of Chihuahuas are naturally alert and vocal, so barking is not unusual. Socialization, routine, and not reinforcing every alarm bark can help keep it manageable.";
  }

  if (q.includes("feed") || q.includes("feeding") || q.includes("food")) {
    return "Chihuahuas need carefully portioned meals because they are tiny and can gain weight easily, while young puppies also need steady meals so blood sugar stays stable. Consistency matters a lot with toy breeds.";
  }

  if (q.includes("available") || q.includes("any puppies") || q.includes("have puppies")) {
    return "There are not any puppies available right now. The next litter is expected mid June, so the best next step is to join the Wait List.";
  }

  if (q.includes("wait list") || q.includes("waitlist")) {
    return "You can join the Wait List right on the website. That is the best way to stay in the loop for the upcoming mid June litter.";
  }

  if (q.includes("payment plan") || q.includes("financing") || q.includes("monthly")) {
    return "Payment plans may be available in some situations. The standard setup is usually 50% down with the remaining balance paid over up to 6 months, and references or other verifiable information may be required.";
  }

  if (q.includes("apply") || q.includes("application")) {
    return "You can apply right on the website, and if you are planning ahead for the upcoming litter, the Wait List is also a strong next step.";
  }

  if (recent.includes("how long do they live") || recent.includes("life expectancy")) {
    return "Chihuahuas are one of the longer-lived dog breeds and often live around 12 to 18 years. Dental care and healthy weight management matter a lot.";
  }

  if (isLikelyGeneralChihuahuaQuestion(q)) {
    return "I can help with Chihuahua care, temperament, common health concerns, feeding, training, and lifespan. Ask the question directly and I will answer it directly.";
  }

  return "I can help with Chihuahua care, breed traits, common health concerns, puppy prep, availability, the Wait List, payment plans, transportation, or next steps. Ask the question directly and I will answer as clearly as I can.";
}
