import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Terms",
  description: `The terms for using ${SITE.name} and publishing lessons with it.`,
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="2026-10-19">
      <p>
        By using {SITE.name}, its skill, or its API, you agree to these terms.
        They are written in plain language on purpose.
      </p>

      <h2>The service</h2>
      <p>
        {SITE.name} turns content into short interactive lessons and hosts them
        at a shareable link. It is free, needs no account, and is provided as
        is, without any warranty. It may change or stop at any time.
      </p>

      <h2>Your lessons</h2>
      <ul>
        <li>
          You keep ownership of the content you publish. You give us permission
          to store and show it at its link for as long as it is kept.
        </li>
        <li>
          You are responsible for what you publish. Only publish content you
          have the right to use.
        </li>
        <li>
          Do not publish content that is illegal, infringes someone&apos;s
          rights, harasses or threatens people, contains personal information
          about others, or tries to run code or load resources from other
          sites.
        </li>
        <li>
          Lessons published without an account are deleted 7 days after
          publishing. Lessons saved to an account stay until you delete them or
          the account. We may remove a lesson earlier if it breaks these terms
          or we are asked to by someone with a valid claim.
        </li>
      </ul>

      <h2>Accounts</h2>
      <ul>
        <li>
          An account is optional. It exists so lessons can be kept and credited
          to you. You can sign in with GitHub or with a code sent to your
          email.
        </li>
        <li>
          Keep your API keys private. Anything published with your key counts
          as published by you. Revoke a key you no longer trust from your
          settings.
        </li>
        <li>
          Pick a handle that is yours to use. We may change or reclaim a handle
          that impersonates someone or is offensive.
        </li>
        <li>
          We may suspend an account that breaks these terms. Its lessons may
          be removed with it.
        </li>
      </ul>

      <h2>Fair use of the service</h2>
      <p>
        Do not overload the service, publish lessons in bulk by automation
        beyond normal use, or try to get around its limits.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, {SITE.name} and its contributors are not
        liable for any loss or damage from using the service or from content
        others publish with it. Lessons are written by AI agents and may
        contain mistakes.
      </p>

      <h2>Contact</h2>
      <p>
        For takedown requests or questions, open an issue on{" "}
        <a href={SITE.repo}>GitHub</a> or message{" "}
        <a href={SITE.makerUrl}>{SITE.maker}</a> on X.
      </p>

      <h2>Changes</h2>
      <p>
        If these terms change, the date at the top changes with it. Continuing
        to use the service after a change means you accept the new terms.
      </p>
    </LegalPage>
  )
}
