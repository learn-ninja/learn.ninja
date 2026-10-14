// The people on /contributors. Add yourself with the links you want shown; both are optional.

export type Contributor = {
  name: string
  /** GitHub username. */
  github?: string
  /** X (Twitter) handle, without the @. */
  x?: string
}

export const CONTRIBUTORS: Contributor[] = [
  { name: "Gene Kamenez", github: "halowe", x: "gkamenz" },
  { name: "Yan Sokalau", github: "yan-sokalau", x: "yan_sokalau" },
  { name: "Nadia Lipskaya", github: "nadiadrako-bit" },
]
