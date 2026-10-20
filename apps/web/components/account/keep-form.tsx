"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { Button, LinkButton } from "@workspace/ui/components/button"

import { ButtonLink } from "@/components/site/button-link"

import { FormError } from "./form-error"

export interface KeepResult {
  ok: boolean
  message: string
  url?: string
  title?: string
  /** The owner's handle, or null when they haven't picked one yet. */
  handle?: string | null
  /** Whether the kept lesson is listed in Explore. */
  listed?: boolean
}

type KeepAction = (
  previous: KeepResult | null,
  formData: FormData
) => Promise<KeepResult>

/**
 * What a kept lesson's state is, after its title: the same sentence the agents say after a keep
 * (skills/learn/steps.md step 6). Listed under the handle; or saved but still to be listed or
 * named, with where to do that.
 */
function keptSentence({ handle, listed }: KeepResult) {
  if (handle && listed)
    return `is saved to your account and listed in Explore under @${handle}. Unlist it any time from your settings.`
  if (handle)
    return `is saved to your account under @${handle} and won't expire. List it in Explore from your settings.`
  return "is saved to your account and won't expire. Pick a handle in your settings and it'll show in Explore."
}

/** The /keep page for a signed-in user: the lesson's title and one button. */
export function KeepForm({
  token,
  title,
  action,
}: {
  token: string
  title: string
  action: KeepAction
}) {
  const [result, formAction, pending] = React.useActionState(action, null)

  if (result?.ok) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CheckIcon className="size-6 text-green-600" aria-hidden="true" />
            Kept
          </h1>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{result.title}</span>{" "}
            {keptSentence(result)}
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href={result.url}>Open lesson</LinkButton>
          <ButtonLink href="/settings" variant="outline">
            Settings
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Keep this lesson?
        </h1>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{title}</span> expires 7
          days after it was published. Keeping it saves it to your account for
          good.
        </p>
      </div>
      <FormError>{result && !result.ok ? result.message : null}</FormError>
      <Button type="submit" isDisabled={pending} className="self-start">
        Keep it
      </Button>
    </form>
  )
}
