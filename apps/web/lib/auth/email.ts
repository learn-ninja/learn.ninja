import { SITE } from "@/lib/site"

// Log-in codes go out through Resend (RESEND_API_KEY) as sensei@learn.ninja, which is a real inbox
// in the learn.ninja Google Workspace, so replies reach a person. Without the key, the code is
// printed to the server console instead, so development needs no account; a production build
// without the key refuses to send, since its logs would otherwise hold every user's code.

export const DEFAULT_FROM = `${SITE.name} <sensei@learn.ninja>`

/** What a code is for: logging in, or confirming a new address from the settings page. */
export type CodePurpose = "log-in" | "change-email"

export type CodeSender = (
  email: string,
  code: string,
  purpose?: CodePurpose
) => Promise<void>

export function codeSenderFromEnv(env = process.env): CodeSender {
  const key = env.RESEND_API_KEY
  if (!key) {
    if (env.NODE_ENV === "production") {
      return async () => {
        throw new Error("RESEND_API_KEY isn't set, so log-in codes can't be sent.")
      }
    }
    return async (email, code, purpose = "log-in") => {
      console.log(`[${SITE.name}] ${purpose === "log-in" ? "Log-in" : "Email change"} code for ${email}: ${code}`)
    }
  }
  const from = env.EMAIL_FROM ?? DEFAULT_FROM
  return async (email, code, purpose = "log-in") => {
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
        text: codeText(code, purpose),
        html: codeHtml(code, purpose),
      }),
    })
    if (!res.ok) {
      throw new Error(`Resend replied ${res.status}: ${await res.text()}`)
    }
  }
}

/** The opening line and where to enter the code, for each purpose. */
function codeWords(purpose: CodePurpose) {
  return purpose === "change-email"
    ? {
        intro: `Your code to make this your ${SITE.name} email is`,
        where: `Enter it in your ${SITE.name} settings.`,
      }
    : {
        intro: `Your ${SITE.name} log-in code is`,
        where: `Enter it on ${SITE.url}, or in the terminal where your agent asked for it.`,
      }
}

export function codeText(code: string, purpose: CodePurpose = "log-in"): string {
  const { intro, where } = codeWords(purpose)
  return `${intro} ${code}.\n\n${where} It works for 5 minutes. Nobody from ${SITE.name} will ever ask you for it; if you didn't ask for it, ignore this email.`
}

function codeHtml(code: string, purpose: CodePurpose): string {
  const { intro, where } = codeWords(purpose)
  return `<p>${intro}</p>
<p style="font-size:28px;font-weight:600;letter-spacing:0.2em;font-family:ui-monospace,monospace">${code}</p>
<p>${where} It works for 5 minutes. Nobody from ${SITE.name} will ever ask you for it; if you didn't ask for it, ignore this email.</p>`
}
