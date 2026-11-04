/**
 * A title split into the words that vanish one by one (components/smoke.tsx), each but the last
 * ending in a no-break space: iOS leaves a line's trailing space out of its width, so a plain one
 * would vanish and the words would run together.
 */
export function smokeWords(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, i) => (i < words.length - 1 ? `${word} ` : word))
}
