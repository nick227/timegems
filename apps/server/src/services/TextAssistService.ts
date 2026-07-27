// TextAssistMode has no Prisma-backed column (it's a pure API-shape concept,
// unlike AgentEmployeeKind/GoalStatus which are re-exported from
// @prisma/client), so it's hand-mirrored from packages/api-spec/openapi.yaml
// here rather than imported -- keep the two in sync if this ever changes.
type TextAssistMode = 'enhance' | 'summarize'

// V1 placeholder policy, same as AgentEmployeeService: deterministic text
// transforms standing in for a real LLM call, so the API contract
// (CreateTextAssistInput -> { result }) doesn't need to change when a real
// model replaces the logic later.
export class TextAssistService {
  // Same shape as AgentEmployeeService.runners: a Record, not a switch/
  // ternary, so adding a mode to the spec without adding a handler here is a
  // tsc error (TS2741 "Property '<mode>' is missing"), not a silent
  // fallthrough discovered only when someone actually requests that mode.
  private readonly modes: Record<TextAssistMode, (text: string) => string> = {
    enhance: (text) => this.enhance(text),
    summarize: (text) => this.summarize(text),
  }

  async run(text: string, mode: TextAssistMode) {
    return this.modes[mode](text)
  }

  // Cleans up whitespace and punctuation/capitalization -- the kind of
  // mechanical pass a real model would do as a baseline, before any
  // rewriting.
  private enhance(text: string) {
    const collapsed = text.trim().replace(/\s+/g, ' ')
    if (!collapsed) return collapsed

    const sentences = collapsed.split(/(?<=[.!?])\s+/).map((sentence) => {
      const trimmed = sentence.trim()
      if (!trimmed) return trimmed
      const capitalized = trimmed[0]!.toUpperCase() + trimmed.slice(1)
      return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`
    })

    return sentences.join(' ')
  }

  // Collapses to the first sentence (or two, if the first is very short) --
  // a crude but honest stand-in for a real summary.
  private summarize(text: string) {
    const collapsed = text.trim().replace(/\s+/g, ' ')
    if (!collapsed) return collapsed

    const sentences = collapsed.split(/(?<=[.!?])\s+/).filter(Boolean)
    const first = sentences[0] ?? collapsed
    if (first.length >= 40 || sentences.length === 1) return first

    return sentences.slice(0, 2).join(' ')
  }
}
