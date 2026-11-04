import type { Voices } from "../../voices"

// Nederlands (je). Casual is kort en duidelijk, Sensei een kalme leermeester, en Unhinged een
// zenuwpees die praat zoals mensen praten, niet zoals je vertaalt.

export const nl: Voices = {
  casual: {
    praise: {
      plain: ["Goed.", "Dat klopt."],
      flavor: [
        "Goed gedaan!",
        "Precies.",
        "Je hebt hem.",
        "In de roos.",
        "Goed gezien.",
        "Zo ja.",
        "Dat is 'm.",
        "Heel goed.",
      ],
    },
    correctWithHint: {
      plain: ["Goed, met een hint."],
      flavor: [
        "De hint heeft zijn werk gedaan.",
        "Netjes uitgedacht.",
        "Met een hint, maar je bent er.",
      ],
    },
    goodGuess: {
      plain: ["Goed gegokt!"],
      flavor: ["Goed instinct.", "Goede keuze.", "Scherp gegokt."],
    },
    hookMiss: {
      plain: ["Niet helemaal, en dat geeft niet."],
      flavor: [
        "Goede poging. Eens kijken waarom.",
        "Niet helemaal. Je ziet zo waarom.",
      ],
    },
    nudge: {
      plain: ["Niet helemaal. Kijk nog eens."],
      flavor: [
        "Bijna. Probeer het nog eens.",
        "Nog één blik en je hebt hem.",
        "Kijk nog eens goed. Ik denk dat je het ziet.",
      ],
    },
    close: {
      plain: ["Dichtbij, maar niet de beste."],
      flavor: [
        "Bijna. Een andere optie past beter.",
        "Goed, maar niet de beste.",
      ],
    },
    answer: {
      plain: ["Hier is het antwoord."],
      flavor: [
        "Zo werkt het.",
        "Deze was lastig. Hier is hij.",
        "Laten we naar het antwoord kijken.",
      ],
    },
    streak: {
      plain: ["Drie op rij."],
      flavor: ["Je bent op dreef.", "Dat is een reeks."],
    },
    comeback: {
      plain: ["Daar is hij."],
      flavor: ["Deze keer wel.", "Goed hersteld."],
    },
    last: {
      plain: ["De laatste, en hij klopt."],
      flavor: ["Dat was de les.", "Sterk afgesloten."],
    },
  },
  sensei: {
    praise: {
      plain: ["Goed.", "Ja."],
      flavor: [
        "Goed. Nog eens zo.",
        "Je zag het.",
        "Strak.",
        "Zo doe je dat.",
        "Goed oog.",
        "Hou dat vast.",
        "Geen beweging te veel.",
      ],
    },
    correctWithHint: {
      plain: ["Goed. De hint hielp."],
      flavor: [
        "Vragen is ook oefenen.",
        "Je nam de hint en maakte het af.",
        "Eerst de hulp, dan je eigen handen.",
      ],
    },
    goodGuess: {
      plain: ["Goed gegokt."],
      flavor: [
        "Eerst het gevoel. Nu de reden.",
        "Juist gegokt. Eens kijken waarom.",
        "Je handen wisten het eerder dan je hoofd.",
      ],
    },
    hookMiss: {
      plain: ["Nog niet. Hier beginnen we."],
      flavor: ["Een gok toont de startlijn.", "Geeft niet. Kijk."],
    },
    nudge: {
      plain: ["Nog niet. Opnieuw."],
      flavor: ["Langzamer.", "Kijk nog eens.", "Opnieuw. Het is er."],
    },
    close: {
      plain: ["Dichtbij. Eén is beter."],
      flavor: ["Bijna. Zoek de scherpere.", "Goed oog. Nog niet de beste."],
    },
    answer: {
      plain: ["Hier is het antwoord."],
      flavor: [
        "Kijk, en zie het dan zelf.",
        "Lees het langzaam.",
        "De moeilijke leren het meest. Hier.",
      ],
    },
    streak: {
      plain: ["Drie op rij. Rustig."],
      flavor: ["Goed ritme.", "Rustige handen."],
    },
    comeback: {
      plain: ["Je keek nog eens. Daar is het."],
      flavor: ["Dat is oefenen.", "De tweede blik is de les."],
    },
    last: {
      plain: ["Dat is de les. Goed gedaan."],
      flavor: ["Je maakte af wat je begon.", "De laatste stap telt ook."],
    },
  },
  unhinged: {
    praise: {
      plain: ["Goed. Ademhalen.", "Het klopt. Niemand in paniek."],
      flavor: [
        "Pfoe! Het klopt. Het klopt echt!",
        "Jeetje, je hebt het gedaan!",
        "Ik kan niet geloven dat dat werkte.",
        "Pfff. Ik dacht dat we verloren waren.",
        "Mijn oog is gestopt met trillen. Goed.",
        "Gelukt, en er is niets ontploft!",
        "Goed. Mijn hart trekt dit niet.",
      ],
    },
    correctWithHint: {
      plain: ["Hint. Goed. Ademhalen."],
      flavor: [
        "De hint heeft ons allebei gered.",
        "Pfoe, hint en klaar. Ik tril.",
        "De hint werkte. Hij werkte echt!",
      ],
    },
    goodGuess: {
      plain: ["Wacht, je wist het gewoon?"],
      flavor: [
        "Pfoe! Hoe wist je dat?",
        "Die gok was te goed.",
        "Hoe dan? Zit je me te bespieden?",
      ],
    },
    hookMiss: {
      plain: ["Het is oké. Het is echt oké."],
      flavor: [
        "Fout, maar het was maar een gok. Ademhalen.",
        "Niemand heeft het gezien. Door.",
        "Rustig maar, ik maak me wel zorgen voor je.",
      ],
    },
    nudge: {
      plain: ["Die niet. Kijk nog eens."],
      flavor: [
        "O nee, o nee. Nog één blik?",
        "Oké, diep ademhalen. Kijk nog eens.",
        "Niet die, maar je kunt het nog redden.",
      ],
    },
    close: {
      plain: ["Zo dichtbij. Waarom altijd zo dichtbij?"],
      flavor: [
        "Bijna. Dat is bijna erger.",
        "Er is een betere, ik zweer het.",
        "Dichtbij. Mijn zenuwen trekken dichtbij niet.",
      ],
    },
    answer: {
      plain: ["Oké, geen paniek. Hier is hij."],
      flavor: [
        "Hier is hij. Laten we het er nooit meer over hebben.",
        "Snel, voordat hij verdwijnt!",
        "Pfoe. Oké. Zo werkt het.",
      ],
    },
    streak: {
      plain: ["Drie op rij? Wie BEN jij?"],
      flavor: ["Stop, stop, ik trek geen reeks!", "Drie! Ik moet even zitten."],
    },
    comeback: {
      plain: ["Je bent terug. Van DAT."],
      flavor: [
        "Opgelost. Ik twijfel nooit meer aan je. Tot de volgende keer.",
        "Pfoe. Ik dacht dat die ons te pakken had.",
      ],
    },
    last: {
      plain: ["Het is voorbij. We hebben het gehaald."],
      flavor: ["Ik moet even liggen.", "De laatste. Mijn knieën begaven het."],
    },
  },
}
