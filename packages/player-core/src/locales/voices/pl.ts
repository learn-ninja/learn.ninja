import type { Voices } from "../../voices"

// Polski (ty). Casual jest krótki i jasny, Sensei to spokojny mistrz, a Unhinged to kłębek nerwów,
// który mówi tak, jak się mówi, a nie jak się tłumaczy.

export const pl: Voices = {
  casual: {
    praise: {
      plain: ["Dobrze.", "Zgadza się."],
      flavor: [
        "Świetna robota!",
        "Dokładnie.",
        "Masz to.",
        "W punkt.",
        "Dobrze zauważone.",
        "No proszę.",
        "To ta.",
        "Bardzo dobrze.",
      ],
    },
    correctWithHint: {
      plain: ["Dobrze, z podpowiedzią."],
      flavor: [
        "Podpowiedź zrobiła swoje.",
        "Ładnie rozwiązane.",
        "Z podpowiedzią, ale jest.",
      ],
    },
    goodGuess: {
      plain: ["Dobry strzał!"],
      flavor: ["Dobry instynkt.", "Dobry wybór.", "Celny strzał."],
    },
    hookMiss: {
      plain: ["Nie całkiem, i to w porządku."],
      flavor: [
        "Dobra próba. Zobaczmy dlaczego.",
        "Nie całkiem. Zaraz zobaczysz dlaczego.",
      ],
    },
    nudge: {
      plain: ["Nie całkiem. Spójrz jeszcze raz."],
      flavor: [
        "Prawie. Spróbuj jeszcze raz.",
        "Jeszcze jedno spojrzenie i będzie.",
        "Spójrz jeszcze raz. Myślę, że to wyłapiesz.",
      ],
    },
    close: {
      plain: ["Blisko, ale to nie najlepsza."],
      flavor: [
        "Prawie. Inna opcja pasuje lepiej.",
        "Dobrze, ale nie najlepiej.",
      ],
    },
    answer: {
      plain: ["Oto odpowiedź."],
      flavor: [
        "Tak to działa.",
        "To było podchwytliwe. Oto ona.",
        "Spójrzmy na odpowiedź.",
      ],
    },
    streak: {
      plain: ["Trzy z rzędu."],
      flavor: ["Idzie ci jak z płatka.", "To już seria."],
    },
    comeback: {
      plain: ["Jest."],
      flavor: ["Tym razem tak.", "Dobre odrobienie."],
    },
    last: {
      plain: ["Ostatnie, i dobrze."],
      flavor: ["To była cała lekcja.", "Mocne zakończenie."],
    },
  },
  sensei: {
    praise: {
      plain: ["Dobrze.", "Tak."],
      flavor: [
        "Dobrze. Jeszcze raz tak samo.",
        "Widzisz to.",
        "Czysto.",
        "Tak to się robi.",
        "Dobre oko.",
        "Zachowaj to.",
        "Żadnego zbędnego ruchu.",
      ],
    },
    correctWithHint: {
      plain: ["Dobrze. Podpowiedź pomogła."],
      flavor: [
        "Pytanie to też ćwiczenie.",
        "Z podpowiedzią, ale do końca.",
        "Najpierw pomoc, potem własne ręce.",
      ],
    },
    goodGuess: {
      plain: ["Dobry strzał."],
      flavor: [
        "Najpierw instynkt. Teraz powód.",
        "Trafne. Zobaczmy dlaczego.",
        "Ręce wiedziały przed głową.",
      ],
    },
    hookMiss: {
      plain: ["Jeszcze nie. Zaczynamy tutaj."],
      flavor: ["Próba pokazuje linię startu.", "Nic nie szkodzi. Patrz."],
    },
    nudge: {
      plain: ["Jeszcze nie. Jeszcze raz."],
      flavor: ["Wolniej.", "Spójrz jeszcze raz.", "Jeszcze raz. To tam jest."],
    },
    close: {
      plain: ["Blisko. Jedna jest lepsza."],
      flavor: [
        "Prawie. Znajdź tę ostrzejszą.",
        "Dobre oko. Jeszcze nie najlepsza.",
      ],
    },
    answer: {
      plain: ["Oto odpowiedź."],
      flavor: [
        "Patrz, potem zobacz to sam.",
        "Czytaj powoli.",
        "Trudne uczą najwięcej. Oto ona.",
      ],
    },
    streak: {
      plain: ["Trzy z rzędu. Spokojnie."],
      flavor: ["Dobry rytm.", "Spokojne ręce."],
    },
    comeback: {
      plain: ["Jeszcze jedno spojrzenie i jest."],
      flavor: ["To jest ćwiczenie.", "Drugie spojrzenie to lekcja."],
    },
    last: {
      plain: ["To cała lekcja. Dobra robota."],
      flavor: ["Dokończone, co zaczęte.", "Ostatni krok też się liczy."],
    },
  },
  unhinged: {
    praise: {
      plain: ["Dobrze. Oddychaj.", "Jest dobrze. Bez paniki."],
      flavor: [
        "O rety! Jest dobrze. Naprawdę dobrze!",
        "O matko, udało się!",
        "Nie wierzę, że to zadziałało.",
        "Uff. Myślałem, że po nas.",
        "Oko przestało mi drgać. Dobrze.",
        "Udało się i nic nie wybuchło!",
        "Dobrze. Moje serce tego nie wytrzyma.",
      ],
    },
    correctWithHint: {
      plain: ["Podpowiedź. Dobrze. Oddychaj."],
      flavor: [
        "Podpowiedź uratowała nas oboje.",
        "Uff, podpowiedź i po sprawie. Trzęsę się.",
        "Podpowiedź zadziałała. Naprawdę zadziałała!",
      ],
    },
    goodGuess: {
      plain: ["Chwila, po prostu wiedziałeś?"],
      flavor: [
        "O rety! Skąd wiedziałeś?",
        "Ten strzał był zbyt celny.",
        "Jak? Podglądasz mnie?",
      ],
    },
    hookMiss: {
      plain: ["Jest okej. Naprawdę jest okej."],
      flavor: [
        "Źle, ale to tylko strzał. Oddychaj.",
        "Nikt nie widział. Idziemy dalej.",
        "Nie martw się, ja się martwię za ciebie.",
      ],
    },
    nudge: {
      plain: ["Nie ta. Spójrz jeszcze raz."],
      flavor: [
        "O nie, o nie. Jeszcze jedno spojrzenie?",
        "Dobra, głęboki oddech. Spójrz jeszcze raz.",
        "Nie ta, ale wciąż możesz to naprawić.",
      ],
    },
    close: {
      plain: ["Tak blisko. Czemu zawsze tak blisko?"],
      flavor: [
        "Prawie. To prawie gorsze.",
        "Jest lepsza, przysięgam.",
        "Blisko. Moje nerwy nie znoszą blisko.",
      ],
    },
    answer: {
      plain: ["Dobra, bez paniki. Oto ona."],
      flavor: [
        "Oto ona. Nigdy więcej o tym nie mówmy.",
        "Szybko, zanim zniknie!",
        "Uff. Dobra. Tak to działa.",
      ],
    },
    streak: {
      plain: ["Trzy z rzędu? Kim ty JESTEŚ?"],
      flavor: ["Stop, stop, nie wytrzymam serii!", "Trzy! Muszę usiąść."],
    },
    comeback: {
      plain: ["Wróciłeś. Po TYM."],
      flavor: [
        "Naprawione. Nigdy więcej w ciebie nie zwątpię. Do następnego razu.",
        "Uff. Myślałem, że to nas załatwiło.",
      ],
    },
    last: {
      plain: ["Koniec. Udało się."],
      flavor: ["Muszę się położyć.", "Ostatnie. Kolana mi zmiękły."],
    },
  },
}
