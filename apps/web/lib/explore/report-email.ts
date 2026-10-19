import { SITE } from "@/lib/site"
import { DEFAULT_FROM } from "@/lib/auth/email"

// A report on a lesson goes to the maker (REPORT_EMAIL) through Resend. Without the key or the
// address, it's printed to the server console instead and kept in the report table either way.

export interface ReportMail {
  reportId: string
  lessonId: string
  title: string
  url: string
  reason: string
  reporterIpHash: string
}

export type ReportSender = (report: ReportMail) => Promise<void>

export function reportSenderFromEnv(env = process.env): ReportSender {
  const key = env.RESEND_API_KEY
  const to = env.REPORT_EMAIL
  if (!key || !to) {
    return async (report) => {
      console.log(`[${SITE.name}] Report on ${report.url}:\n${reportText(report)}`)
    }
  }
  const from = env.EMAIL_FROM ?? DEFAULT_FROM
  return async (report) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Report: ${report.title}`,
        text: reportText(report),
      }),
    })
    if (!res.ok) {
      throw new Error(`Resend replied ${res.status}: ${await res.text()}`)
    }
  }
}

/** The email's text: the link, the reason, and the SQL that hides the lesson. */
export function reportText(report: ReportMail): string {
  return [
    `Someone reported "${report.title}".`,
    "",
    `Lesson: ${report.url}`,
    `Reason: ${report.reason}`,
    "",
    `Report ${report.reportId}, from reporter ${report.reporterIpHash.slice(0, 12)}.`,
    "",
    "To take it out of Explore and profiles (its owner can still open the link):",
    `UPDATE lesson SET hidden = true WHERE id = '${report.lessonId}';`,
  ].join("\n")
}
