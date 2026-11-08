/*
 * CẤU TRÚC ĐỀ KIỂM TRA (TEST BLUEPRINT)
 * Theo Quyết định số 22/QĐ-HĐYKQG ngày 21/4/2026 của Hội đồng Y khoa Quốc gia.
 * min/max: trọng số (%) trong đề, mục 4.1 và 4.2 của Phụ lục.
 * Số câu mỗi đề = tổng số câu x trọng số trung bình (min+max)/2, làm tròn và luôn nằm trong [min, max].
 */
window.BLUEPRINT = {
  totalQuestions: 120,   // số câu mỗi đề
  minutes: 180,          // thời gian chế độ Real-time (phút)

  // 4.1. Trọng số của 17 đề mục (hệ cơ quan và các vấn đề) – id trùng số Nhóm trong file câu hỏi
  systems: [
    { id: 1,  name: "Hệ Miễn dịch", min: 3, max: 5 },
    { id: 2,  name: "Hệ Máu – Lưới – Bạch huyết", min: 3, max: 5 },
    { id: 3,  name: "Sức khỏe hành vi – Tâm thần", min: 2, max: 4 },
    { id: 4,  name: "Hệ thần kinh", min: 3, max: 5 },
    { id: 5,  name: "Da – Mô dưới da", min: 1, max: 3 },
    { id: 6,  name: "Hệ cơ xương khớp", min: 4, max: 6 },
    { id: 7,  name: "Hệ tim mạch", min: 7, max: 10 },
    { id: 8,  name: "Hệ hô hấp", min: 9, max: 11 },
    { id: 9,  name: "Hệ tiêu hóa", min: 13.5, max: 16.5 },
    { id: 10, name: "Hệ thận niệu", min: 7, max: 9 },
    { id: 11, name: "Thai kỳ, Chuyển dạ, Sinh đẻ và Hậu sản", min: 6, max: 8 },
    { id: 12, name: "Hệ sinh dục, Vú và Sức khoẻ sinh sản", min: 5, max: 7 },
    { id: 13, name: "Hệ nội tiết – Dinh dưỡng – Chuyển hoá", min: 4, max: 6 },
    { id: 14, name: "Rối loạn đa cơ quan", min: 4, max: 6 },
    { id: 15, name: "Y học cấp cứu", min: 9, max: 11 },
    { id: 16, name: "Thống kê y sinh học/DTH, SKDS/Diễn giải y văn", min: 1, max: 3 },
    { id: 17, name: "Khoa học xã hội trong y học", min: 1, max: 3 }
  ],

  // 4.2. Trọng số Lĩnh vực năng lực
  competencies: [
    { id: "KHCB", name: "Áp dụng khái niệm Khoa học cơ bản", min: 1, max: 3,
      subs: [{ id: "KHCB", name: "Áp dụng khái niệm Khoa học cơ bản" }] },
    { id: "CD", name: "Chẩn đoán", min: 45, max: 60,
      subs: [
        { id: "BS",  name: "Bệnh sử / Thăm khám thực thể" },
        { id: "CLS", name: "Cận lâm sàng / XN chẩn đoán" },
        { id: "CDX", name: "Chẩn đoán" },
        { id: "TL",  name: "Tiên lượng / Kết cục" }
      ] },
    { id: "XT", name: "Xử trí", min: 35, max: 50,
      subs: [
        { id: "PB",    name: "Duy trì sức khỏe / Phòng bệnh" },
        { id: "THUOC", name: "Liệu pháp thuốc" },
        { id: "CT",    name: "Can thiệp lâm sàng" },
        { id: "PH",    name: "Xử trí phối hợp" }
      ] },
    { id: "HTCT", name: "Học tập và cải thiện dựa trên thực hành", min: 1, max: 3,
      subs: [{ id: "HTCT", name: "Học tập và cải thiện dựa trên thực hành" }] },
    { id: "GT", name: "Giao tiếp và tính chuyên nghiệp", min: 1, max: 3,
      subs: [{ id: "GT", name: "Giao tiếp và tính chuyên nghiệp" }] },
    { id: "HT", name: "Thực hành dựa trên hệ thống và an toàn bệnh nhân", min: 1, max: 2,
      subs: [{ id: "HT", name: "Thực hành dựa trên hệ thống và an toàn bệnh nhân" }] }
  ]
};
