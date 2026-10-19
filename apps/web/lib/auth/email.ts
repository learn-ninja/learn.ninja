import { SITE } from "@/lib/site"

// Sign-in codes go out through Resend (RESEND_API_KEY) from mail.learn.ninja. Without the key, the
// code is printed to the server console instead, so development needs no account.

export const DEFAULT_FROM = `${SITE.name} <code@mail.learn.ninja>`

export type CodeSender = (email: string, code: string) => Promise<void>

export function codeSenderFromEnv(env = process.env): CodeSender {
  const key = env.RESEND_API_KEY
  if (!key) {
    return async (email, code) => {
      console.log(`[${SITE.name}] Sign-in code for ${email}: ${code}`)
    }
  }
  const from = env.EMAIL_FROM ?? DEFAULT_FROM
  return async (email, code) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${code} is your ${SITE.name} code`,
        text: codeText(code),
        html: codeHtml(code),
      }),
    })
    if (!res.ok) {
      throw new Error(`Resend replied ${res.status}: ${await res.text()}`)
    }
  }
}

export function codeText(code: string): string {
  return `Your ${SITE.name} sign-in code is ${code}.\n\nIt works for 5 minutes. If you didn't ask for it, ignore this email.`
}

function codeHtml(code: string): string {
  return `<p>Your ${SITE.name} sign-in code is</p>
<p style="font-size:28px;font-weight:600;letter-spacing:0.2em;font-family:ui-monospace,monospace">${code}</p>
<p>It works for 5 minutes. If you didn't ask for it, ignore this email.</p>`
}
