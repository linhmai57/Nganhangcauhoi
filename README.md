# Luyện tập ngân hàng câu hỏi

Trang web tĩnh (HTML/CSS/JS thuần), không cần server, không cần cài đặt.

## Hai chế độ luyện tập

| | Real-time (thi thử) | Practice (luyện tập) |
|---|---|---|
| Số câu | 120 câu chọn ngẫu nhiên | Toàn bộ ngân hàng |
| Thời gian | 3 tiếng, hết giờ tự nộp bài | Không giới hạn |
| Đáp án & giải thích | Xem sau khi nộp bài | Xem ngay sau mỗi câu |
| Lưu tiến độ | Có (lỡ tải lại trang vẫn làm tiếp, đồng hồ vẫn chạy) | Có, lần sau vào làm tiếp |

Tính năng thêm: bảng điều hướng câu hỏi, đánh dấu câu cần xem lại, làm lại các câu sai,
lọc câu đúng/sai khi xem kết quả, phím tắt (`1`-`4` hoặc `A`-`D` để chọn, `←` `→` để chuyển câu).

## Cách chạy

Mở file `index.html` bằng trình duyệt (Chrome, Edge, Firefox...).

Đưa lên mạng cho sinh viên dùng: bật **GitHub Pages** (Settings → Pages → chọn nhánh) hoặc
tải cả thư mục lên bất kỳ hosting tĩnh nào.

## Nhập dữ liệu câu hỏi

Sửa file `data/questions.js`, mỗi câu hỏi có dạng:

```js
{
  id: 1,                                   // mã câu hỏi, không trùng
  question: "Nội dung câu hỏi",
  options: ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
  answer: "B",                             // đáp án đúng
  explanation: "Phần giải thích"
},
```

- Số phương án có thể nhiều hoặc ít hơn 4, tự động đánh chữ A, B, C...
- Có thể bổ sung câu hỏi mới bất cứ lúc nào; tiến độ Practice cũ vẫn được giữ, câu mới tự thêm vào cuối.

## Thay đổi số câu / thời gian thi

Trong `app.js`, sửa phần `CONFIG`:

```js
const CONFIG = {
  EXAM_QUESTIONS: 120,
  EXAM_MINUTES: 180
};
```

## Lưu ý

Tiến độ được lưu trong trình duyệt (localStorage) của từng máy. Đổi máy, đổi trình duyệt
hoặc xóa dữ liệu duyệt web thì tiến độ sẽ mất.
