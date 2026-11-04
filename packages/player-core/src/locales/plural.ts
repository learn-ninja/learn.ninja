/**
 * Picks the form for a count by the language's plural rules (CLDR categories: zero, one, two, few,
 * many, other), with "#" standing for the number. A missing form falls back to "other".
 */
export function plural(lang: string) {
  const rules = new Intl.PluralRules(lang)
  return (n: number, forms: Partial<Record<Intl.LDMLPluralRule, string>>) =>
    (forms[rules.select(n)] ?? forms.other ?? "").replace("#", String(n))
}
