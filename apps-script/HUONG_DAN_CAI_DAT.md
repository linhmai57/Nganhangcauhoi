# Hướng dẫn cài đặt bản Google Apps Script (bảo mật)

Thời gian: khoảng 15–20 phút, làm **một lần**. Toàn bộ thao tác dùng tài khoản **email trường (@pctu.edu.vn)**.

Cần chuẩn bị 3 file:
- `NganHangCauHoi.xlsx` – ngân hàng câu hỏi (file riêng, **không** đưa lên GitHub)
- `Code.gs` – phần máy chủ
- `Index.html` – phần giao diện

---

## Bước 1. Tạo Google Sheet chứa ngân hàng câu hỏi

1. Mở https://drive.google.com bằng email trường.
2. Bấm **+ Mới → Tải tệp lên** → chọn `NganHangCauHoi.xlsx`.
3. Nhấp đúp vào file vừa tải lên → chọn **Mở bằng Google Trang tính**.
4. Bấm **Tệp → Lưu dưới dạng Google Trang tính**. Từ đây làm việc trên bản Google Sheet mới tạo (tên không có đuôi .xlsx).
5. Kiểm tra có 3 trang: **CauHoi** (1.280 dòng), **TrongSo**, **CaiDat**.
6. Xóa file `.xlsx` gốc trên Drive cho gọn (không bắt buộc).

> ⚠️ **Không chia sẻ** Google Sheet này cho sinh viên. Sinh viên chỉ dùng đường link trang web ở Bước 4.

## Bước 2. Dán mã nguồn

1. Trong Google Sheet, bấm **Tiện ích mở rộng → Apps Script**. Một tab mới mở ra.
2. Ở tab Apps Script, mục **Tệp** bên trái đang có `Mã.gs` (hoặc `Code.gs`):
   - Xóa hết nội dung có sẵn trong file đó.
   - Mở file `Code.gs` (tôi gửi), copy **toàn bộ** và dán vào.
3. Bấm dấu **+** cạnh chữ **Tệp** → chọn **HTML** → đặt tên là **`Index`** (đúng chữ I viết hoa, không gõ đuôi .html).
   - Xóa nội dung mẫu, copy **toàn bộ** file `Index.html` và dán vào.
4. Bấm biểu tượng **💾 Lưu** (hoặc Ctrl + S).
5. Bấm vào **⚙️ Cài đặt dự án** (biểu tượng bánh răng bên trái) → mục **Múi giờ** chọn **(GMT+07:00) Bangkok/Hanoi/Jakarta**.

## Bước 3. Cấp quyền và kiểm tra dữ liệu

1. Quay lại tab Google Sheet → **tải lại trang (F5)**. Trên thanh menu xuất hiện mục **Luyện thi**.
2. Bấm **Luyện thi → Kiểm tra ngân hàng câu hỏi**.
3. Lần đầu Google hỏi cấp quyền: bấm **Tiếp tục** → chọn email trường → **Cho phép**.
   (Nếu hiện "Google chưa xác minh ứng dụng này": bấm **Nâng cao → Đi tới … (không an toàn)**. Đây là script của chính thầy/cô nên an toàn.)
4. Bấm lại **Luyện thi → Kiểm tra ngân hàng câu hỏi**. Kết quả đúng: *"Đã đọc 1280 câu hỏi. Đề Real-time 120 câu: đủ câu để khớp tỉ lệ QĐ 22."*

## Bước 4. Đưa trang web lên mạng

1. Ở tab Apps Script, bấm nút **Triển khai** (góc trên bên phải) → **Tùy chọn triển khai mới**.
2. Bấm biểu tượng ⚙️ cạnh "Chọn loại" → chọn **Ứng dụng web**.
3. Điền:
   - **Mô tả:** Luyện thi v1
   - **Thực thi với tư cách:** **Tôi** (email của thầy/cô)
   - **Người có quyền truy cập:** **Bất kỳ ai trong Trường …** (pctu.edu.vn)
4. Bấm **Triển khai** → copy **URL ứng dụng web** (dạng `https://script.google.com/a/macros/pctu.edu.vn/s/.../exec`).
5. Mở URL đó để thử. Gửi URL cho sinh viên.

## Cập nhật sau này

| Muốn thay đổi | Cách làm |
|---|---|
| Sửa câu hỏi, đáp án, giải thích, nhãn năng lực | Sửa trực tiếp trên trang **CauHoi** → menu **Luyện thi → Làm mới dữ liệu sau khi sửa câu hỏi** |
| Thêm câu hỏi | Thêm dòng mới ở cuối trang **CauHoi** (ID không trùng) → **Làm mới dữ liệu** |
| Số câu, thời gian thi, số lượt/ngày | Sửa cột **GiaTri** trên trang **CaiDat** → **Làm mới dữ liệu** |
| Trọng số QĐ 22 | Sửa cột **Min/Max** trên trang **TrongSo** → **Làm mới dữ liệu** |
| Sửa code (`Code.gs`/`Index`) | Dán code mới → **Lưu** → **Triển khai → Quản lý các lượt triển khai** → ✏️ → Phiên bản: **Phiên bản mới** → **Triển khai** (URL giữ nguyên) |

## Xem kết quả của sinh viên

- Trang **KetQua** (tự tạo): mỗi đợt thi/luyện tập một dòng – thời gian, email, chế độ, số câu đúng/sai/bỏ trống, điểm, tỉ lệ đúng theo từng miền năng lực. Có thể lọc, sắp xếp, tạo biểu đồ như Google Sheet thông thường.
- Trang **TienDo** (tự tạo): dữ liệu kỹ thuật lưu bài đang làm của từng sinh viên – **không sửa tay**.

## Ý nghĩa các cột trang CauHoi

| Cột | Nội dung |
|---|---|
| ID | Mã câu (không trùng) |
| Nhom | Số nhóm hệ cơ quan 1–17 (khớp cột Ma của trang TrongSo) |
| SoVanDe / VanDe | Số và tên vấn đề chuyên môn |
| NangLuc | KHCB, CD, XT, HTCT, GT, HT |
| TieuMuc | CD: BS, CLS, CDX, TL · XT: PB, THUOC, CT, PH · các miền khác: trùng mã miền |
| TinhHuong | Bệnh cảnh + câu dẫn (mỗi đoạn một dòng, xuống dòng trong ô bằng Ctrl + Enter) |
| A, B, C, D | Các phương án |
| DapAn | Chữ cái đáp án đúng |
| LapLuan | Lập luận cho đáp án đúng |
| LyDo_A … LyDo_D | Lý do loại từng phương án nhiễu (để trống ô của đáp án đúng) |

## Giới hạn cần biết

- Google cho tối đa khoảng **30 lượt xử lý cùng lúc** trên tài khoản chạy script. Trang web tự thử lại khi máy chủ bận. Với 300 sinh viên luyện tập rải rác thì không vấn đề; nếu tổ chức thi thử **đồng loạt cùng một giờ**, nên chia ca (ví dụ mỗi ca 100 sinh viên, bắt đầu lệch nhau vài phút).
- Mỗi thao tác (bắt đầu đề, nộp câu) mất khoảng 0,5–2 giây.
