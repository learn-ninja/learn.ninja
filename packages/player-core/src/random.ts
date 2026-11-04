/** A small seeded random source (Park–Miller), so a demo shuffles the same way on the server and in the browser. */
export function seeded(key: string): () => number {
  let s = 7
  for (const c of key) s = (s * 31 + c.charCodeAt(0)) % 2147483647
  s = s || 1
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}
