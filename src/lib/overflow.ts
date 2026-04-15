/**
 * Regex patterns for detecting context overflow from error strings.
 * Matches the same patterns as pi-ai's isContextOverflow but works on raw error strings
 * (since agent.state.errorMessage is a string, not an AssistantMessage).
 */
const OVERFLOW_PATTERNS = [
  /prompt is too long/i,
  /input is too long for requested model/i,
  /exceeds the context window/i,
  /input token count.*exceeds the maximum/i,
  /maximum prompt length is \d+/i,
  /reduce the length of the messages/i,
  /maximum context length is \d+ tokens/i,
  /exceeds the limit of \d+/i,
  /exceeds the available context size/i,
  /greater than the context length/i,
  /context window exceeds limit/i,
  /exceeded model token limit/i,
  /context[_ ]length[_ ]exceeded/i,
  /too many tokens/i,
  /token limit exceeded/i,
  /^4(?:00|13)\s*(?:status code)?\s*\(no body\)/i,
];

/** Check if an error string indicates a context overflow. */
export function isOverflowError(error: string): boolean {
  return OVERFLOW_PATTERNS.some((p) => p.test(error));
}
