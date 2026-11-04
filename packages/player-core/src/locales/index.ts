import type { PackChunk } from "../language"
import type { UiLanguage } from "../strings"

// Every language but English, each loaded on demand as one chunk: its strings and its ninja's lines.
// A lesson needs one language, so the other twenty never reach the learner's browser.

export const LOADERS: Record<
  Exclude<UiLanguage, "en">,
  () => Promise<PackChunk>
> = {
  es: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-es" */ "./es"),
      import(/* webpackChunkName: "lang-es" */ "./voices/es"),
    ]).then(([s, v]) => ({ strings: s.es, voices: v.es })),
  pt: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-pt" */ "./pt"),
      import(/* webpackChunkName: "lang-pt" */ "./voices/pt"),
    ]).then(([s, v]) => ({ strings: s.pt, voices: v.pt })),
  fr: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-fr" */ "./fr"),
      import(/* webpackChunkName: "lang-fr" */ "./voices/fr"),
    ]).then(([s, v]) => ({ strings: s.fr, voices: v.fr })),
  de: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-de" */ "./de"),
      import(/* webpackChunkName: "lang-de" */ "./voices/de"),
    ]).then(([s, v]) => ({ strings: s.de, voices: v.de })),
  it: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-it" */ "./it"),
      import(/* webpackChunkName: "lang-it" */ "./voices/it"),
    ]).then(([s, v]) => ({ strings: s.it, voices: v.it })),
  nl: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-nl" */ "./nl"),
      import(/* webpackChunkName: "lang-nl" */ "./voices/nl"),
    ]).then(([s, v]) => ({ strings: s.nl, voices: v.nl })),
  pl: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-pl" */ "./pl"),
      import(/* webpackChunkName: "lang-pl" */ "./voices/pl"),
    ]).then(([s, v]) => ({ strings: s.pl, voices: v.pl })),
  ru: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-ru" */ "./ru"),
      import(/* webpackChunkName: "lang-ru" */ "./voices/ru"),
    ]).then(([s, v]) => ({ strings: s.ru, voices: v.ru })),
  uk: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-uk" */ "./uk"),
      import(/* webpackChunkName: "lang-uk" */ "./voices/uk"),
    ]).then(([s, v]) => ({ strings: s.uk, voices: v.uk })),
  tr: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-tr" */ "./tr"),
      import(/* webpackChunkName: "lang-tr" */ "./voices/tr"),
    ]).then(([s, v]) => ({ strings: s.tr, voices: v.tr })),
  ar: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-ar" */ "./ar"),
      import(/* webpackChunkName: "lang-ar" */ "./voices/ar"),
    ]).then(([s, v]) => ({ strings: s.ar, voices: v.ar })),
  he: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-he" */ "./he"),
      import(/* webpackChunkName: "lang-he" */ "./voices/he"),
    ]).then(([s, v]) => ({ strings: s.he, voices: v.he })),
  hi: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-hi" */ "./hi"),
      import(/* webpackChunkName: "lang-hi" */ "./voices/hi"),
    ]).then(([s, v]) => ({ strings: s.hi, voices: v.hi })),
  id: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-id" */ "./id"),
      import(/* webpackChunkName: "lang-id" */ "./voices/id"),
    ]).then(([s, v]) => ({ strings: s.id, voices: v.id })),
  vi: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-vi" */ "./vi"),
      import(/* webpackChunkName: "lang-vi" */ "./voices/vi"),
    ]).then(([s, v]) => ({ strings: s.vi, voices: v.vi })),
  th: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-th" */ "./th"),
      import(/* webpackChunkName: "lang-th" */ "./voices/th"),
    ]).then(([s, v]) => ({ strings: s.th, voices: v.th })),
  ja: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-ja" */ "./ja"),
      import(/* webpackChunkName: "lang-ja" */ "./voices/ja"),
    ]).then(([s, v]) => ({ strings: s.ja, voices: v.ja })),
  ko: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-ko" */ "./ko"),
      import(/* webpackChunkName: "lang-ko" */ "./voices/ko"),
    ]).then(([s, v]) => ({ strings: s.ko, voices: v.ko })),
  zh: () =>
    Promise.all([
      import(/* webpackChunkName: "lang-zh" */ "./zh"),
      import(/* webpackChunkName: "lang-zh" */ "./voices/zh"),
    ]).then(([s, v]) => ({ strings: s.zh, voices: v.zh })),
  "zh-tw": () =>
    Promise.all([
      import(/* webpackChunkName: "lang-zh-tw" */ "./zh-tw"),
      import(/* webpackChunkName: "lang-zh-tw" */ "./voices/zh-tw"),
    ]).then(([s, v]) => ({ strings: s.zhTw, voices: v.zhTw })),
}
