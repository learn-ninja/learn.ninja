import type { Voices } from "../../voices"

// Português do Brasil, sem regionalismos marcados. Casual é curto e claro, Sensei é um mestre sereno e
// Unhinged é um pilha de nervos que fala como a gente fala, não como tradução.

export const pt: Voices = {
  casual: {
    praise: {
      plain: ["Correto.", "Isso mesmo."],
      flavor: [
        "Bom trabalho!",
        "Exato.",
        "Você acertou.",
        "Na mosca.",
        "Bem observado.",
        "É isso.",
        "Essa mesmo.",
        "Muito bem.",
      ],
    },
    correctWithHint: {
      plain: ["Correto, com uma dica."],
      flavor: [
        "A dica fez o trabalho dela.",
        "Bem resolvido.",
        "Com dica, mas chegou lá.",
      ],
    },
    goodGuess: {
      plain: ["Bom palpite!"],
      flavor: ["Bom instinto.", "Boa escolha.", "Palpite certeiro."],
    },
    hookMiss: {
      plain: ["Não foi dessa vez, e tudo bem."],
      flavor: [
        "Boa tentativa. Vamos ver por quê.",
        "Quase. Logo você vai ver por quê.",
      ],
    },
    nudge: {
      plain: ["Não é isso. Olhe de novo."],
      flavor: [
        "Quase. Tente mais uma vez.",
        "Mais uma olhada e você acerta.",
        "Dê mais uma olhada. Acho que você pega.",
      ],
    },
    close: {
      plain: ["Perto, mas não é a melhor."],
      flavor: [
        "Quase. Outra opção encaixa melhor.",
        "Boa, mas não é a melhor.",
      ],
    },
    answer: {
      plain: ["Aqui está a resposta."],
      flavor: [
        "É assim que funciona.",
        "Essa era difícil. Aqui está.",
        "Vamos ver a resposta.",
      ],
    },
    streak: {
      plain: ["Três seguidas."],
      flavor: ["Você está embalado.", "Isso é uma sequência."],
    },
    comeback: {
      plain: ["Aí está."],
      flavor: ["Dessa vez foi.", "Boa recuperação."],
    },
    last: {
      plain: ["A última, e certa."],
      flavor: ["Essa era a lição.", "Terminou forte."],
    },
  },
  sensei: {
    praise: {
      plain: ["Bom.", "Sim."],
      flavor: [
        "Bom. De novo assim.",
        "Você viu.",
        "Limpo.",
        "É assim.",
        "Bom olho.",
        "Guarde isso.",
        "Nenhum movimento a mais.",
      ],
    },
    correctWithHint: {
      plain: ["Bom. A dica ajudou."],
      flavor: [
        "Perguntar também é treino.",
        "Pegou a dica e terminou.",
        "Primeiro a ajuda, depois as suas mãos.",
      ],
    },
    goodGuess: {
      plain: ["Bom palpite."],
      flavor: [
        "Primeiro o instinto. Agora o motivo.",
        "Acertou no palpite. Vamos ver por quê.",
        "Suas mãos souberam antes da cabeça.",
      ],
    },
    hookMiss: {
      plain: ["Ainda não. Começamos aqui."],
      flavor: [
        "Um palpite mostra a linha de partida.",
        "Não importa. Observe.",
      ],
    },
    nudge: {
      plain: ["Ainda não. De novo."],
      flavor: ["Mais devagar.", "Olhe mais uma vez.", "De novo. Está aí."],
    },
    close: {
      plain: ["Perto. Tem uma melhor."],
      flavor: [
        "Quase. Ache a mais precisa.",
        "Bom olho. Ainda não é a melhor.",
      ],
    },
    answer: {
      plain: ["Aqui está a resposta."],
      flavor: [
        "Observe, depois veja por si mesmo.",
        "Leia devagar.",
        "As difíceis ensinam mais. Aqui.",
      ],
    },
    streak: {
      plain: ["Três seguidas. Firme."],
      flavor: ["Bom ritmo.", "Mãos calmas."],
    },
    comeback: {
      plain: ["Você olhou de novo. Aí está."],
      flavor: ["Isso é treino.", "A segunda olhada é a lição."],
    },
    last: {
      plain: ["Essa é a lição. Muito bem."],
      flavor: ["Você terminou o que começou.", "O último passo também conta."],
    },
  },
  unhinged: {
    praise: {
      plain: ["Correto. Respira.", "Está certo. Ninguém entra em pânico."],
      flavor: [
        "Eita! Está certo. Está certo mesmo!",
        "Meu Deus, você conseguiu!",
        "Não acredito que deu certo.",
        "Ufa. Achei que a gente estava perdido.",
        "Meu olho parou de tremer. Correto.",
        "Você acertou e nada explodiu!",
        "Correto. Meu coração não aguenta isso.",
      ],
    },
    correctWithHint: {
      plain: ["Dica. Correto. Respira."],
      flavor: [
        "A dica salvou nós dois.",
        "Ufa, dica e pronto. Estou tremendo.",
        "A dica funcionou. Funcionou mesmo!",
      ],
    },
    goodGuess: {
      plain: ["Espera, você simplesmente sabia?"],
      flavor: [
        "Eita! Como você sabia?",
        "Esse palpite foi certo demais.",
        "Como? Você está me espionando?",
      ],
    },
    hookMiss: {
      plain: ["Tudo bem. Está tudo bem mesmo."],
      flavor: [
        "Errou, mas era só um palpite. Respira.",
        "Ninguém viu. Seguindo.",
        "Relaxa, eu me preocupo por você.",
      ],
    },
    nudge: {
      plain: ["Essa não. Olha de novo."],
      flavor: [
        "Ai, não, ai, não. Mais uma olhada?",
        "Tá, respira fundo. Olha de novo.",
        "Não é essa, mas ainda dá para consertar.",
      ],
    },
    close: {
      plain: ["Tão perto. Por que é sempre tão perto?"],
      flavor: [
        "Quase. Isso é quase pior.",
        "Tem uma melhor, eu juro.",
        "Perto. Meus nervos não aguentam perto.",
      ],
    },
    answer: {
      plain: ["Tá, sem pânico. Aqui está."],
      flavor: [
        "Aqui está. Nunca mais falamos disso.",
        "Rápido, antes que suma!",
        "Ufa. Tá. É assim que funciona.",
      ],
    },
    streak: {
      plain: ["Três seguidas? Quem É você?"],
      flavor: [
        "Para, para, eu não aguento uma sequência!",
        "Três! Preciso me sentar.",
      ],
    },
    comeback: {
      plain: ["Você voltou. Daquilo."],
      flavor: [
        "Resolvido. Nunca mais duvido de você. Até a próxima.",
        "Ufa. Achei que aquela tinha nos pegado.",
      ],
    },
    last: {
      plain: ["Acabou. A gente conseguiu."],
      flavor: ["Preciso me deitar.", "A última. Minhas pernas bambearam."],
    },
  },
}
