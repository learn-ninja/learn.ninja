import type { Voices } from "../../voices"

// Bahasa Indonesia santai (kamu). Casual singkat dan jelas, Sensei guru yang tenang, dan Unhinged
// gugup berat dan bicara seperti orang bicara, bukan seperti terjemahan.

export const id: Voices = {
  casual: {
    praise: {
      plain: ["Benar.", "Tepat."],
      flavor: [
        "Kerja bagus!",
        "Persis.",
        "Kamu dapat.",
        "Tepat sasaran.",
        "Jeli.",
        "Nah, itu dia.",
        "Yang itu.",
        "Bagus sekali.",
      ],
    },
    correctWithHint: {
      plain: ["Benar, dengan petunjuk."],
      flavor: [
        "Petunjuknya berhasil.",
        "Dipecahkan dengan rapi.",
        "Pakai petunjuk, tapi sampai juga.",
      ],
    },
    goodGuess: {
      plain: ["Tebakan bagus!"],
      flavor: ["Naluri yang bagus.", "Pilihan tepat.", "Tebakan jitu."],
    },
    hookMiss: {
      plain: ["Belum tepat, dan tidak apa-apa."],
      flavor: [
        "Usaha bagus. Mari lihat kenapa.",
        "Belum tepat. Sebentar lagi kamu tahu kenapa.",
      ],
    },
    nudge: {
      plain: ["Belum tepat. Lihat lagi."],
      flavor: [
        "Hampir. Coba sekali lagi.",
        "Sekali lihat lagi, pasti dapat.",
        "Lihat sekali lagi. Kurasa kamu bisa menangkapnya.",
      ],
    },
    close: {
      plain: ["Dekat, tapi bukan yang terbaik."],
      flavor: [
        "Hampir. Pilihan lain lebih pas.",
        "Bagus, tapi bukan yang terbaik.",
      ],
    },
    answer: {
      plain: ["Ini jawabannya."],
      flavor: [
        "Begini cara kerjanya.",
        "Yang ini sulit. Ini jawabannya.",
        "Mari lihat jawabannya.",
      ],
    },
    streak: {
      plain: ["Tiga berturut-turut."],
      flavor: ["Lagi lancar.", "Itu baru rentetan."],
    },
    comeback: {
      plain: ["Nah, itu dia."],
      flavor: ["Kali ini dapat.", "Pemulihan yang bagus."],
    },
    last: {
      plain: ["Yang terakhir, dan benar."],
      flavor: ["Itulah pelajarannya.", "Diakhiri dengan kuat."],
    },
  },
  sensei: {
    praise: {
      plain: ["Bagus.", "Ya."],
      flavor: [
        "Bagus. Sekali lagi seperti itu.",
        "Kamu melihatnya.",
        "Bersih.",
        "Begitu caranya.",
        "Mata yang jeli.",
        "Simpan itu.",
        "Tak ada gerakan sia-sia.",
      ],
    },
    correctWithHint: {
      plain: ["Bagus. Petunjuknya membantu."],
      flavor: [
        "Bertanya juga latihan.",
        "Kamu ambil petunjuknya dan menyelesaikannya.",
        "Bantuan dulu, lalu tanganmu sendiri.",
      ],
    },
    goodGuess: {
      plain: ["Tebakan yang bagus."],
      flavor: [
        "Naluri dulu. Sekarang alasannya.",
        "Tebakanmu benar. Mari lihat mengapa.",
        "Tanganmu tahu sebelum kepalamu.",
      ],
    },
    hookMiss: {
      plain: ["Belum. Kita mulai dari sini."],
      flavor: ["Tebakan menunjukkan garis awal.", "Tak apa. Perhatikan."],
    },
    nudge: {
      plain: ["Belum. Sekali lagi."],
      flavor: [
        "Lebih pelan.",
        "Lihat sekali lagi.",
        "Sekali lagi. Ada di sana.",
      ],
    },
    close: {
      plain: ["Dekat. Ada yang lebih baik."],
      flavor: [
        "Hampir. Cari yang lebih tepat.",
        "Mata yang jeli. Belum yang terbaik.",
      ],
    },
    answer: {
      plain: ["Ini jawabannya."],
      flavor: [
        "Perhatikan, lalu lihat sendiri.",
        "Baca pelan-pelan.",
        "Yang sulit paling banyak mengajarkan. Ini dia.",
      ],
    },
    streak: {
      plain: ["Tiga berturut-turut. Mantap."],
      flavor: ["Irama yang bagus.", "Tangan yang tenang."],
    },
    comeback: {
      plain: ["Kamu melihat lagi. Itu dia."],
      flavor: ["Itulah latihan.", "Pandangan kedua adalah pelajarannya."],
    },
    last: {
      plain: ["Itulah pelajarannya. Bagus."],
      flavor: [
        "Kamu menyelesaikan yang kamu mulai.",
        "Langkah terakhir juga dihitung.",
      ],
    },
  },
  unhinged: {
    praise: {
      plain: ["Benar. Tarik napas.", "Benar. Jangan ada yang panik."],
      flavor: [
        "Waduh! Benar. Beneran benar!",
        "Astaga, kamu berhasil!",
        "Nggak nyangka itu berhasil.",
        "Fiuh. Kukira kita tamat.",
        "Mataku berhenti kedutan. Benar.",
        "Kamu berhasil dan tidak ada yang meledak!",
        "Benar. Jantungku nggak kuat.",
      ],
    },
    correctWithHint: {
      plain: ["Petunjuk. Benar. Tarik napas."],
      flavor: [
        "Petunjuknya menyelamatkan kita berdua.",
        "Fiuh, petunjuk dan beres. Aku gemetar.",
        "Petunjuknya berhasil. Beneran berhasil!",
      ],
    },
    goodGuess: {
      plain: ["Tunggu, kamu tahu begitu saja?"],
      flavor: [
        "Waduh! Kok bisa tahu?",
        "Tebakan itu terlalu tepat.",
        "Gimana caranya? Kamu ngawasin aku?",
      ],
    },
    hookMiss: {
      plain: ["Nggak apa-apa. Beneran nggak apa-apa."],
      flavor: [
        "Salah, tapi cuma tebakan. Tarik napas.",
        "Nggak ada yang lihat. Lanjut.",
        "Jangan khawatir, aku yang khawatir buat kamu.",
      ],
    },
    nudge: {
      plain: ["Bukan itu. Lihat lagi."],
      flavor: [
        "Aduh, aduh. Lihat sekali lagi?",
        "Oke, tarik napas dalam. Lihat lagi.",
        "Bukan itu, tapi masih bisa diperbaiki.",
      ],
    },
    close: {
      plain: ["Dekat banget. Kenapa selalu dekat banget?"],
      flavor: [
        "Hampir. Itu malah lebih parah.",
        "Ada yang lebih baik, sumpah.",
        "Dekat. Sarafku nggak tahan sama 'dekat'.",
      ],
    },
    answer: {
      plain: ["Oke, jangan panik. Ini jawabannya."],
      flavor: [
        "Ini jawabannya. Jangan pernah bahas ini lagi.",
        "Cepat, sebelum hilang!",
        "Fiuh. Oke. Begini cara kerjanya.",
      ],
    },
    streak: {
      plain: ["Tiga berturut-turut? Kamu ini SIAPA?"],
      flavor: [
        "Stop, stop, aku nggak kuat rentetan!",
        "Tiga! Aku harus duduk.",
      ],
    },
    comeback: {
      plain: ["Kamu kembali. Setelah ITU."],
      flavor: [
        "Beres. Aku nggak akan ragu lagi. Sampai lain kali.",
        "Fiuh. Kukira yang itu menghabisi kita.",
      ],
    },
    last: {
      plain: ["Selesai. Kita berhasil."],
      flavor: ["Aku harus rebahan.", "Yang terakhir. Lututku lemas."],
    },
  },
}
