// The spec's rich-text subset: **bold**, *italic*, `code`, and \\( formulas \\). A $ is always a plain dollar sign.
// Kept apart from the React renderer, so the server (link previews) can strip markers too.

export const TOKEN = /\\\(([\s\S]+?)\\\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g

/** The same text without its markers, for places that need a plain string (like a live region). */
export function plainText(text: string): string {
  return text.replace(
    TOKEN,
    (_, math?: string, code?: string, bold?: string, italic?: string) =>
      math?.trim() ?? code ?? bold ?? italic ?? ""
  )
}
