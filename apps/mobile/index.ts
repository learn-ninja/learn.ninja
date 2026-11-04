// The app's entry: polyfills first, then Expo Router. Hermes has no Intl.PluralRules (or
// Intl.Locale), which player-core's locales call as they load, so FormatJS's polyfills stand in,
// with plural rules for every interface language (UI_LANGUAGES in player-core's strings.ts;
// zh covers zh-tw). Each polyfill only installs itself where the engine lacks it.
import "@formatjs/intl-getcanonicallocales/polyfill.js"
import "@formatjs/intl-locale/polyfill.js"
import "@formatjs/intl-pluralrules/polyfill.js"
import "@formatjs/intl-pluralrules/locale-data/en.js"
import "@formatjs/intl-pluralrules/locale-data/es.js"
import "@formatjs/intl-pluralrules/locale-data/pt.js"
import "@formatjs/intl-pluralrules/locale-data/fr.js"
import "@formatjs/intl-pluralrules/locale-data/de.js"
import "@formatjs/intl-pluralrules/locale-data/it.js"
import "@formatjs/intl-pluralrules/locale-data/nl.js"
import "@formatjs/intl-pluralrules/locale-data/pl.js"
import "@formatjs/intl-pluralrules/locale-data/ru.js"
import "@formatjs/intl-pluralrules/locale-data/uk.js"
import "@formatjs/intl-pluralrules/locale-data/tr.js"
import "@formatjs/intl-pluralrules/locale-data/ar.js"
import "@formatjs/intl-pluralrules/locale-data/he.js"
import "@formatjs/intl-pluralrules/locale-data/hi.js"
import "@formatjs/intl-pluralrules/locale-data/id.js"
import "@formatjs/intl-pluralrules/locale-data/vi.js"
import "@formatjs/intl-pluralrules/locale-data/th.js"
import "@formatjs/intl-pluralrules/locale-data/ja.js"
import "@formatjs/intl-pluralrules/locale-data/ko.js"
import "@formatjs/intl-pluralrules/locale-data/zh.js"

import { LogBox } from "react-native"

// A development warning from a deprecation inside a dependency, not ours; its toast would sit over
// the lesson's tray.
LogBox.ignoreLogs(["ImageBackground is deprecated"])

import "expo-router/entry"
