/*
 * NGÂN HÀNG CÂU HỎI
 * Mỗi câu hỏi gồm:
 *   id          : mã câu hỏi (duy nhất, không trùng nhau)
 *   question    : nội dung câu hỏi
 *   options     : danh sách phương án (tự động đánh A, B, C, D... theo thứ tự)
 *   answer      : đáp án đúng (chữ cái: "A", "B", "C", ...)
 *   explanation : phần giải thích
 *
 * Thay toàn bộ dữ liệu mẫu bên dưới bằng dữ liệu thật.
 */
window.QUESTION_BANK = [
  {
    id: 1,
    question: "Thủ đô của Việt Nam là thành phố nào?",
    options: ["TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Huế"],
    answer: "B",
    explanation: "Hà Nội là thủ đô của nước Cộng hòa xã hội chủ nghĩa Việt Nam."
  },
  {
    id: 2,
    question: "Kết quả của phép tính 12 × 8 là bao nhiêu?",
    options: ["86", "94", "96", "108"],
    answer: "C",
    explanation: "12 × 8 = 96."
  },
  {
    id: 3,
    question: "HTML là viết tắt của cụm từ nào?",
    options: [
      "HyperText Markup Language",
      "HighText Machine Language",
      "Hyperlink and Text Markup Language",
      "Home Tool Markup Language"
    ],
    answer: "A",
    explanation: "HTML = HyperText Markup Language, ngôn ngữ đánh dấu siêu văn bản dùng để xây dựng trang web."
  },
  {
    id: 4,
    question: "Nước sôi ở bao nhiêu độ C (ở áp suất tiêu chuẩn)?",
    options: ["90 °C", "100 °C", "110 °C", "120 °C"],
    answer: "B",
    explanation: "Ở áp suất 1 atm, nước sôi ở 100 °C."
  },
  {
    id: 5,
    question: "Trong Excel, hàm nào dùng để tính tổng?",
    options: ["AVERAGE", "COUNT", "SUM", "MAX"],
    answer: "C",
    explanation: "Hàm SUM dùng để tính tổng các giá trị, ví dụ =SUM(A1:A10)."
  }
];
