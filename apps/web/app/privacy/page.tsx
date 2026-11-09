import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${SITE.name} stores, for how long, and what it never does with it.`,
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="2026-11-09">
      <p>
        {SITE.name} is a free tool that works without an account. This page
        lists everything it stores and for how long. It is short because there
        is not much.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>Published lessons.</strong> When an agent publishes a lesson,
          its title and content are stored on our servers so the link works.
          Anyone with the link can read it. Lessons published without an account
          are deleted 7 days after publishing; lessons saved to an account stay
          until you delete them. The tokens that allow updating or keeping a
          lesson are stored only as hashes. We also store the name of the app or
          agent that published it. Lessons saved to an account are listed in
          Explore with your handle until you unpublish them from your profile,
          and we count how many times they are viewed and liked; a view is
          counted each time the lesson is opened and is not tied to you.
        </li>
        <li>
          <strong>Drafts from chat apps.</strong> When a chat app connected over
          MCP sends a lesson to be checked, or a publish or update fails its
          checks, the lesson&apos;s text is kept for a day so the app can send
          fixes instead of the whole lesson again. Then it is deleted.
        </li>
        <li>
          <strong>Likes, completions, and reports.</strong> Liking a lesson
          stores that your account liked it. Once you have a handle, the listed
          lessons you liked show on your profile. Finishing a lesson while
          logged in stores when you first finished it, so Explore can mark it
          for you, and adds one to that day&apos;s count on your profile&apos;s
          activity grid. A lesson you leave midway while logged in stores how
          far you got, until you finish it. Reporting a lesson stores the reason
          and a hash of your IP address, never the address itself, and emails
          the report to us.
        </li>
        <li>
          <strong>Your account, if you make one.</strong> Your email address,
          and the name, avatar, and username GitHub shares when you log in with
          it, or a picture you upload instead. We use your email to send log-in
          codes and nothing else. Codes are stored hashed and deleted after 5
          minutes. API keys and personal MCP URLs are stored hashed; you can see
          and revoke them in your settings.
        </li>
        <li>
          <strong>Connected chat apps.</strong> When you let a chat app such as
          Claude or ChatGPT publish lessons to your account, we store which app
          it is, what you allowed it to do, and its access tokens. The app can
          only publish and keep lessons as you: it cannot read your email. Your
          settings list every connected app, and Disconnect ends its access at
          once.
        </li>
        <li>
          <strong>Log-in cookies.</strong> Logging in sets a session cookie so
          you stay logged in, and a small cookie that tells the site to show
          your handle instead of a log-in link. There are no other cookies.
        </li>
        <li>
          <strong>Your settings.</strong> Text size, language, sound, and the
          ninja setting are saved in your own browser, not on our servers, and
          so is your place in each lesson you play.
        </li>
        <li>
          <strong>Server logs.</strong> Our hosting and storage providers keep
          standard request logs (such as IP address and browser type) for a
          short time to run and secure the service.
        </li>
      </ul>

      <h2>What is not done</h2>
      <ul>
        <li>No passwords: log-in uses GitHub or a one-time code.</li>
        <li>No analytics, advertising, or tracking scripts.</li>
        <li>
          Nothing is sold or shared with third parties beyond the providers that
          host the service, store its data, and deliver its email.
        </li>
      </ul>

      <h2>Lesson content</h2>
      <p>
        Lessons are public to anyone with the link. Do not put personal
        information about yourself or others in a lesson. If a lesson contains
        something about you that should not be there, contact us and we will
        remove it.
      </p>

      <h2>Deleting your account</h2>
      <p>
        Delete your account yourself, at any time, from Settings on the website
        or in the iOS app: type your email to confirm, and it is gone at once.
        That deletes the account and everything tied to it: your lessons
        (their links stop working), profile and picture, likes, finished
        lessons and progress, streak, API keys, and the chat apps connected to
        it. It can&apos;t be undone. What you played without logging in stays
        in your browser or on your phone until you clear it. If you can&apos;t
        log in, contact us and we will delete it for you.
      </p>

      <h2>Contact</h2>
      <p>
        Open an issue on <a href={SITE.repo}>GitHub</a> or message{" "}
        <a href={SITE.makerUrl}>{SITE.maker}</a> on X.
      </p>

      <h2>Changes</h2>
      <p>
        If this page changes, the date at the top changes with it. Material
        changes will also be noted in the project&apos;s changelog.
      </p>
    </LegalPage>
  )
}
