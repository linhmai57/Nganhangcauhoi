# Khoa Y – Luyện thi đánh giá năng lực quốc gia

Trang web tĩnh (HTML/CSS/JS thuần), không cần server. Mở `index.html` hoặc đăng lên GitHub Pages.

## Tính năng

- **Tạo đề theo QĐ 22/QĐ-HĐYKQG**: mỗi đề 120 câu, số câu theo 17 hệ cơ quan (mục 4.1) và
  6 miền năng lực (mục 4.2) đều nằm đúng trong khoảng trọng số quy định. Ưu tiên câu chưa gặp ở các đề trước.
- **Real-time**: 120 câu / 3 tiếng, tự nộp khi hết giờ; đáp án và giải thích chỉ hiện sau khi nộp bài.
- **Practice**: 40 câu mỗi đợt (tỉ lệ theo QĐ 22, làm tròn cho đề ngắn), không giới hạn thời gian; chọn đáp án → bấm **Nộp** → hiện đáp án và giải thích →
  **Câu tiếp theo**; không quay lại câu trước; tự động lưu để làm tiếp.
- **Đáp án – giải thích thống nhất** theo Hướng dẫn viết MCQ bậc cao: "Đáp án và lập luận" rồi lý do loại từng phương án nhiễu; bỏ các ghi chú nội bộ của người biên soạn.
- **Phân tích sau mỗi đợt**: bảng tỉ lệ đúng theo miền năng lực và tiểu mục, chỉ ra miền cần cải thiện.

## Cấu trúc thư mục

| File | Nội dung |
|---|---|
| `data/blueprint.js` | Trọng số QĐ 22, số câu mỗi đề, thời gian thi |
| `data/questions.js` | Ngân hàng câu hỏi (tạo tự động từ file Word) |
| `tools/build_data.py` | Chuyển file Word → `data/questions.js` |
| `tools/classify.py` | Quy tắc tự gán miền năng lực |

## Cập nhật ngân hàng câu hỏi từ file Word

1. Đặt các file `PCTU_Nhom_XX_....docx` vào một thư mục.
2. Chạy: `python3 tools/build_data.py <thư_mục>` (cần `pip install python-docx`).

Định dạng file Word: tiêu đề `NHÓM xx – ...` (Title), `VẤN ĐỀ xxx — ...` (Heading 1),
`Ca xxxx: ...` (Heading 2), tiếp theo là bệnh cảnh, câu hỏi, các phương án `A.`–`D.`,
dòng `Đáp án: X` và phần giải thích.

## Nhãn miền năng lực

File Word hiện chưa có nhãn năng lực nên hệ thống **tự gán** dựa trên lời dẫn câu hỏi và nội dung đáp án đúng
(ví dụ "Chẩn đoán phù hợp nhất?" → Chẩn đoán; "Xử trí ưu tiên?" → Xử trí; Nhóm 16 → Học tập và cải thiện;
Nhóm 17 → Giao tiếp / An toàn người bệnh).

- Muốn gán thủ công: thêm dòng `Năng lực: <tên năng lực>` vào từng ca trong file Word rồi chạy lại script,
  hoặc sửa trực tiếp trường `"c"` / `"s"` trong `data/questions.js`.
- Mã năng lực: `KHCB`, `CD` (BS, CLS, CDX, TL), `XT` (PB, THUOC, CT, PH), `HTCT`, `GT`, `HT` – xem `data/blueprint.js`.

## Lưu ý

Tiến độ lưu trong trình duyệt (localStorage) của từng máy; đổi máy/trình duyệt hoặc xóa dữ liệu duyệt web sẽ mất tiến độ.

## Bản bảo mật – Google Apps Script (khuyến nghị)

Thư mục `apps-script/` chứa bản chạy trên Google Apps Script: ngân hàng câu hỏi nằm trong Google Sheet riêng tư,
chỉ email trường đăng nhập được, trình duyệt chỉ nhận câu hỏi **không kèm đáp án**; đáp án chỉ gửi sau khi nộp.
Tiến độ và kết quả lưu trên Google Sheet (trang `TienDo`, `KetQua`).

- Cài đặt: xem `apps-script/HUONG_DAN_CAI_DAT.md`.
- Tạo file Excel để nhập vào Google Sheet: `python3 tools/export_sheet.py` → `xuat/NganHangCauHoi.xlsx`
  (thư mục `xuat/` nằm trong `.gitignore`, không đưa lên GitHub).
