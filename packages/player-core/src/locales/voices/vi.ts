import type { Voices } from "../../voices"

// Tiếng Việt thân mật (bạn). Casual ngắn gọn rõ ràng, Sensei là người thầy điềm tĩnh, còn Unhinged
// là một bó dây thần kinh nói như người ta nói, không phải như bản dịch.

export const vi: Voices = {
  casual: {
    praise: {
      plain: ["Đúng rồi.", "Chính xác."],
      flavor: [
        "Làm tốt lắm!",
        "Đúng vậy.",
        "Bạn tìm ra rồi.",
        "Trúng phóc.",
        "Tinh mắt đấy.",
        "Đó, thấy chưa.",
        "Chính nó.",
        "Rất tốt.",
      ],
    },
    correctWithHint: {
      plain: ["Đúng, nhờ gợi ý."],
      flavor: [
        "Gợi ý đã làm việc của nó.",
        "Giải gọn gàng.",
        "Có gợi ý, nhưng vẫn tới đích.",
      ],
    },
    goodGuess: {
      plain: ["Đoán hay!"],
      flavor: ["Trực giác tốt.", "Chọn đúng.", "Đoán sắc bén."],
    },
    hookMiss: {
      plain: ["Chưa đúng, và không sao cả."],
      flavor: [
        "Thử tốt đấy. Xem vì sao nhé.",
        "Chưa đúng. Bạn sẽ sớm hiểu vì sao.",
      ],
    },
    nudge: {
      plain: ["Chưa đúng. Nhìn lại nhé."],
      flavor: [
        "Gần rồi. Thử lại đi.",
        "Nhìn thêm một lần là ra.",
        "Nhìn lại lần nữa. Tôi nghĩ bạn sẽ bắt được.",
      ],
    },
    close: {
      plain: ["Gần đúng, nhưng chưa phải tốt nhất."],
      flavor: [
        "Gần rồi. Có lựa chọn khác hợp hơn.",
        "Tốt, nhưng chưa phải tốt nhất.",
      ],
    },
    answer: {
      plain: ["Đây là đáp án."],
      flavor: [
        "Nó hoạt động như thế này.",
        "Câu này khó. Đây là đáp án.",
        "Cùng xem đáp án nhé.",
      ],
    },
    streak: {
      plain: ["Ba câu liên tiếp."],
      flavor: ["Đang lên đà.", "Đó là một chuỗi."],
    },
    comeback: {
      plain: ["Đó rồi."],
      flavor: ["Lần này được rồi.", "Gỡ lại đẹp."],
    },
    last: {
      plain: ["Câu cuối, và đúng."],
      flavor: ["Đó chính là bài học.", "Kết thúc mạnh mẽ."],
    },
  },
  sensei: {
    praise: {
      plain: ["Tốt.", "Đúng."],
      flavor: [
        "Tốt. Lần nữa như vậy.",
        "Em thấy rồi.",
        "Gọn.",
        "Là như vậy đó.",
        "Mắt tinh.",
        "Giữ lấy điều đó.",
        "Không một động tác thừa.",
      ],
    },
    correctWithHint: {
      plain: ["Tốt. Gợi ý đã giúp."],
      flavor: [
        "Hỏi cũng là luyện tập.",
        "Em nhận gợi ý và làm xong.",
        "Giúp trước, rồi đến tay em.",
      ],
    },
    goodGuess: {
      plain: ["Đoán tốt."],
      flavor: [
        "Trực giác trước. Giờ là lý do.",
        "Đoán đúng. Xem vì sao.",
        "Tay em biết trước đầu em.",
      ],
    },
    hookMiss: {
      plain: ["Chưa. Ta bắt đầu từ đây."],
      flavor: ["Một lần thử cho thấy vạch xuất phát.", "Không sao. Nhìn này."],
    },
    nudge: {
      plain: ["Chưa. Lần nữa."],
      flavor: ["Chậm lại.", "Nhìn lại lần nữa.", "Lần nữa. Nó ở đó."],
    },
    close: {
      plain: ["Gần rồi. Có một đáp án tốt hơn."],
      flavor: [
        "Suýt nữa. Tìm cái sắc hơn.",
        "Mắt tinh. Nhưng chưa phải tốt nhất.",
      ],
    },
    answer: {
      plain: ["Đây là đáp án."],
      flavor: [
        "Nhìn, rồi tự thấy.",
        "Đọc chậm thôi.",
        "Bài khó dạy nhiều nhất. Đây.",
      ],
    },
    streak: {
      plain: ["Ba lần liên tiếp. Vững."],
      flavor: ["Nhịp tốt.", "Tay vững."],
    },
    comeback: {
      plain: ["Em nhìn lại. Nó đó."],
      flavor: ["Đó là luyện tập.", "Cái nhìn thứ hai chính là bài học."],
    },
    last: {
      plain: ["Đó là bài học. Tốt lắm."],
      flavor: ["Em đã làm xong điều em bắt đầu.", "Bước cuối cũng tính."],
    },
  },
  unhinged: {
    praise: {
      plain: ["Đúng. Thở đi.", "Đúng rồi. Không ai hoảng nhé."],
      flavor: [
        "Trời ơi! Đúng. Đúng thật luôn!",
        "Ôi trời, bạn làm được rồi!",
        "Không tin nổi là được.",
        "Phù. Tưởng tiêu rồi chứ.",
        "Mắt tôi hết giật rồi. Đúng.",
        "Làm được rồi mà không có gì nổ!",
        "Đúng. Tim tôi chịu không nổi.",
      ],
    },
    correctWithHint: {
      plain: ["Gợi ý. Đúng. Thở đi."],
      flavor: [
        "Gợi ý cứu cả hai ta.",
        "Phù, gợi ý là xong. Tôi run quá.",
        "Gợi ý có tác dụng. Có tác dụng thật!",
      ],
    },
    goodGuess: {
      plain: ["Khoan, bạn biết sẵn luôn à?"],
      flavor: [
        "Trời ơi! Sao bạn biết?",
        "Đoán gì mà đúng quá vậy.",
        "Sao được? Bạn đang theo dõi tôi à?",
      ],
    },
    hookMiss: {
      plain: ["Không sao. Thật sự không sao."],
      flavor: [
        "Sai, nhưng chỉ là đoán thôi. Thở đi.",
        "Không ai thấy đâu. Đi tiếp.",
        "Đừng lo, để tôi lo giùm bạn.",
      ],
    },
    nudge: {
      plain: ["Không phải cái đó. Nhìn lại đi."],
      flavor: [
        "Ôi không, ôi không. Nhìn thêm lần nữa nhé?",
        "Rồi, hít sâu. Nhìn lại đi.",
        "Không phải, nhưng vẫn sửa được.",
      ],
    },
    close: {
      plain: ["Sát quá. Sao lúc nào cũng sát vậy?"],
      flavor: [
        "Gần rồi. Thế còn tệ hơn.",
        "Có cái tốt hơn, tôi thề.",
        "Sát nút. Thần kinh tôi không chịu nổi 'sát nút'.",
      ],
    },
    answer: {
      plain: ["Rồi, đừng hoảng. Đây là đáp án."],
      flavor: [
        "Đây. Đừng bao giờ nhắc lại chuyện này.",
        "Nhanh, trước khi nó biến mất!",
        "Phù. Rồi. Nó hoạt động thế này.",
      ],
    },
    streak: {
      plain: ["Ba câu liên tiếp? Bạn là AI vậy?"],
      flavor: [
        "Dừng, dừng, tôi không chịu nổi chuỗi này!",
        "Ba! Tôi phải ngồi xuống.",
      ],
    },
    comeback: {
      plain: ["Bạn trở lại rồi. Sau CÁI ĐÓ."],
      flavor: [
        "Sửa xong. Không bao giờ nghi ngờ bạn nữa. Cho đến lần sau.",
        "Phù. Tưởng câu đó hạ gục ta rồi.",
      ],
    },
    last: {
      plain: ["Xong rồi. Ta làm được."],
      flavor: ["Tôi phải nằm xuống.", "Câu cuối. Đầu gối tôi mềm nhũn."],
    },
  },
}
