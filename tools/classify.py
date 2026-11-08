"""Phân loại miền năng lực (QĐ 22/QĐ-HĐYKQG, mục 4.2) cho từng câu hỏi.

Mã năng lực:
  KHCB  Áp dụng khái niệm Khoa học cơ bản
  CD    Chẩn đoán      (BS: Bệnh sử/Thăm khám, CLS: Cận lâm sàng/XN, CDX: Chẩn đoán, TL: Tiên lượng/Kết cục)
  XT    Xử trí         (PB: Duy trì sức khỏe/Phòng bệnh, THUOC: Liệu pháp thuốc,
                        CT: Can thiệp lâm sàng, PH: Xử trí phối hợp)
  HTCT  Học tập và cải thiện dựa trên thực hành
  GT    Giao tiếp và tính chuyên nghiệp
  HT    Thực hành dựa trên hệ thống và an toàn bệnh nhân

Nếu file Word có sẵn dòng "Năng lực: ..." thì dùng nhãn đó; nếu không thì tự suy luận
từ lời dẫn câu hỏi và nội dung đáp án đúng.
"""
import re
import unicodedata

LABELS = {
    'khoa học cơ bản': ('KHCB', 'KHCB'),
    'bệnh sử': ('CD', 'BS'), 'thăm khám': ('CD', 'BS'),
    'cận lâm sàng': ('CD', 'CLS'), 'xn chẩn đoán': ('CD', 'CLS'),
    'tiên lượng': ('CD', 'TL'),
    'chẩn đoán': ('CD', 'CDX'),
    'phòng bệnh': ('XT', 'PB'), 'duy trì sức khỏe': ('XT', 'PB'),
    'liệu pháp thuốc': ('XT', 'THUOC'),
    'can thiệp': ('XT', 'CT'),
    'xử trí phối hợp': ('XT', 'PH'), 'xử trí': ('XT', 'PH'),
    'học tập': ('HTCT', 'HTCT'),
    'giao tiếp': ('GT', 'GT'),
    'an toàn': ('HT', 'HT'), 'hệ thống': ('HT', 'HT'),
}


def norm(s):
    return unicodedata.normalize('NFC', s).lower()


def has(text, words):
    return any(re.search(r'(?<!\w)' + w + r'(?!\w)', text) for w in words)


KHCB_Q = ['cơ chế', 'sinh lý bệnh', 'giải phẫu', 'cấu trúc tổn thương', 'nguồn gốc tổn thương',
          'tổn thương mô học', 'chất nào', 'loại tinh thể']
GT_Q = ['đạo đức', 'bảo mật', 'phản hồi', 'thông báo tin xấu', 'đồng ý', 'quyền', 'cách nói',
        'cách tư vấn hiệu quả']
HT_Q = ['bàn giao', 'an toàn người bệnh', 'kiểm soát lây nhiễm', 'sai sót', 'biện pháp an toàn',
        'vận chuyển', 'chuyển tuyến', 'quy trình']
PROG_Q = ['tiên lượng', 'biến chứng', 'nguy cơ', 'biến cố', 'kết cục', 'thông tin tiên lượng']
CLS_Q = ['xét nghiệm', 'thăm dò', 'khảo sát', 'chụp', 'hình ảnh', 'cận lâm sàng', 'ecg', 'que thử',
         'cặn lắng', 'nitrite', 'acr', 'albumin niệu', 'protein niệu', 'creatinine', 'chỉ số',
         'trụ hồng cầu', 'mô bệnh học', 'phương tiện', 'siêu âm', 'nội soi', 'sinh thiết',
         'diễn giải bệnh cảnh và cận lâm sàng', 'kết quả xét nghiệm', 'egfr', 'ngưỡng']
HX_Q = ['khai thác', 'hỏi bệnh', 'thăm khám', 'yếu tố cần đánh giá', 'đánh giá ban đầu',
        'nhóm triệu chứng', 'khám']
DX_Q = ['chẩn đoán', 'nhận định', 'nguyên nhân', 'hội chứng', 'phân loại', 'kiểu', 'loại', 'tổn thương',
        'bệnh', 'kết luận', 'diễn giải', 'giải thích', 'nghĩ', 'bất thường', 'khả năng', 'khả dĩ']
TX_Q = ['xử trí', 'điều trị', 'can thiệp', 'kế hoạch', 'chiến lược', 'quản lý', 'hành động', 'ưu tiên',
        'bước', 'việc cần', 'điều cần', 'quyết định', 'tư vấn', 'lời khuyên', 'dặn dò', 'hướng dẫn',
        'biện pháp', 'dự phòng', 'thuốc', 'chăm sóc', 'tiếp cận', 'lựa chọn', 'chỉ định', 'liều',
        'nguyên tắc', 'cần làm', 'chuẩn bị', 'tiêm', 'hỗ trợ', 'cách', 'chọn hình thức sinh']

PREV = ['dự phòng', 'phòng ngừa', 'tầm soát', 'sàng lọc', 'tiêm chủng', 'tiêm phòng', 'tiêm ngừa',
        'vaccine', 'vắc xin', 'tư vấn', 'lời khuyên', 'dặn dò', 'hướng dẫn', 'giáo dục', 'lối sống',
        'tiêm bù', 'tiêm nhắc', 'cai thuốc', 'chế độ ăn', 'tập luyện', 'giảm cân', 'nuôi con bằng sữa mẹ']
DRUG = ['thuốc', 'kháng sinh', 'liều', 'chống đông', 'insulin', 'corticoid', 'corticosteroid',
        'kháng virus', 'điều trị đầu tay', 'adrenaline', 'epinephrine', 'truyền dịch', 'oxytocin',
        'magnesium', 'magnesi', 'statin', 'aspirin', 'heparin', 'morphin', 'giảm đau', 'hạ áp',
        'lợi tiểu', 'kháng histamin', 'ppi', 'ức chế bơm proton', 'metformin', 'levothyroxine',
        'amoxicillin', 'ceftriaxone', 'paracetamol', 'nsaid', 'hóa trị', 'tiêu sợi huyết', 'globulin',
        'hbig', 'tig', 'prep', 'pep', 'arv', 'vitamin', 'sắt', 'kali', 'calci', 'glucose', 'uống', 'tiêm tĩnh mạch', 'truyền tĩnh mạch', 'mg', 'mcg']
PROC = ['can thiệp', 'phẫu thuật', 'mổ', 'thủ thuật', 'nắn', 'đặt ống', 'đặt thông', 'đặt nội khí quản',
        'nội khí quản', 'dẫn lưu', 'ép tim', 'sốc điện', 'khử rung', 'cắt', 'khâu', 'bất động', 'cố định',
        'chọc', 'hút', 'nội soi can thiệp', 'pci', 'tái tưới máu', 'lọc máu', 'thay thế thận',
        'truyền máu', 'truyền tiểu cầu', 'băng ép', 'cầm máu', 'giải áp', 'mở khí quản', 'thở máy',
        'thông khí', 'hồi sức', 'cesarean', 'mổ lấy thai', 'forceps', 'giác hút', 'bóc nhau', 'nạo',
        'hút thai', 'sinh thiết', 'rửa', 'ga rô', 'garo', 'nẹp', 'bó bột', 'thông tiểu', 'đặt']

DX_OPT_START = ['xét nghiệm', 'chụp', 'siêu âm', 'định lượng', 'đo ', 'nội soi', 'sinh thiết', 'làm ',
                'ct ', 'mri', 'x-quang', 'ecg', 'điện tim', 'cấy', 'công thức máu', 'khảo sát',
                'thăm dò', 'đánh giá', 'khai thác', 'hỏi', 'khám']
TX_OPT_START = ['đặt', 'cho ', 'dùng', 'chuyển', 'tiêm', 'điều trị', 'hồi sức', 'theo dõi', 'tư vấn',
                'giải thích', 'hướng dẫn', 'kích hoạt', 'ngừng', 'dừng', 'bắt đầu', 'khởi', 'truyền',
                'phẫu thuật', 'mổ', 'nhập viện', 'cấp cứu', 'ép tim', 'sốc điện', 'xử trí', 'giữ',
                'bảo đảm', 'đảm bảo', 'tiếp tục', 'hoãn', 'trì hoãn', 'hẹn', 'lập kế hoạch', 'phối hợp',
                'thực hiện', 'gọi', 'báo', 'cung cấp', 'bổ sung', 'tránh', 'duy trì',
                'cách ly', 'rửa', 'băng', 'nắn', 'bất động', 'cố định', 'hội chẩn', 'mời', 'chỉ định',
                'không ', 'chỉ ', 'thay', 'loại bỏ', 'khuyến', 'can thiệp', 'cân nhắc', 'kiểm soát',
                'cá thể hóa', 'tầm soát', 'sàng lọc', 'tôn trọng', 'thừa nhận', 'dừng lại', 'lắng nghe']


def sub_of_treatment(opt, q=''):
    for text in (opt, q):
        if has(text, PREV):
            return 'PB'
        if has(text, PROC):
            return 'CT'
        if has(text, DRUG):
            return 'THUOC'
    return 'PH'


HT_OPT = ['định danh', 'bàn giao', 'sự cố', 'báo cáo sai sót', 'vệ sinh tay', 'kiểm soát nhiễm khuẩn',
          'kiểm soát lây nhiễm', 'phiên dịch']
CLS_OPT = ['xét nghiệm', 'chụp', 'siêu âm', 'nội soi', 'sinh thiết', 'ct', 'mri', 'x-quang', 'định lượng']


def sub_of_diagnosis(q, opt):
    if has(q, PROG_Q):
        return 'TL'
    if has(q, CLS_Q):
        return 'CLS'
    if has(q, HX_Q):
        return 'BS'
    if any(opt.startswith(w) for w in ['xét nghiệm', 'chụp', 'siêu âm', 'định lượng', 'nội soi',
                                         'sinh thiết', 'ct ', 'mri', 'x-quang', 'cấy', 'đo ']):
        return 'CLS'
    if any(opt.startswith(w) for w in ['khai thác', 'hỏi', 'khám']):
        return 'BS'
    if has(q, ['đánh giá', 'bước', 'hướng']) and has(opt, CLS_OPT):
        return 'CLS'
    return 'CDX'


def classify(q):
    # 1) Nhãn có sẵn trong file
    for line in q['stem'] + q['explanation']:
        m = re.match(r'^\s*(Năng lực|Lĩnh vực năng lực|Miền năng lực)\s*[:：]\s*(.+)$', line, re.I)
        if m:
            label = norm(m.group(2))
            for key, val in LABELS.items():
                if key in label:
                    return val
    # 2) Theo đề mục (Nhóm 16, 17)
    p = q['problemNo']
    if p in (123, 124):
        return ('HTCT', 'HTCT')
    if p in (125, 126):
        return ('GT', 'GT')
    if p in (127, 128):
        return ('HT', 'HT')

    ql = norm(re.sub(r'^Câu hỏi\s*[:：]\s*', '', q['questionLine']))
    opt = norm(q['options']['ABCDE'.index(q['answer'])])
    generic = (not has(ql, DX_Q + TX_Q + CLS_Q + PROG_Q + HX_Q + KHCB_Q)) or \
        ql.startswith('lựa chọn phù hợp nhất dựa trên') or 'mcq' in ql

    # 3) Khoa học cơ bản, giao tiếp, an toàn
    if has(ql, KHCB_Q):
        return ('KHCB', 'KHCB')
    if has(ql, GT_Q):
        return ('GT', 'GT')
    if has(ql, HT_Q) or has(opt, HT_OPT):
        return ('HT', 'HT')
    if ql.startswith('chẩn đoán'):
        return ('CD', sub_of_diagnosis(ql, opt))

    # 4) Chẩn đoán hay xử trí
    if not generic:
        dx = has(ql, DX_Q + CLS_Q + PROG_Q + HX_Q)
        tx = has(ql, TX_Q)
        if dx and tx:
            # "Nhận định và hướng xử trí", "Chẩn đoán và hướng ưu tiên"... -> dựa vào đáp án
            tx = any(opt.startswith(w) for w in TX_OPT_START) or has(ql, ['xử trí', 'điều trị'])
            dx = not tx
        if has(ql, CLS_Q + HX_Q) and not has(ql, ['xử trí', 'điều trị', 'can thiệp']):
            return ('CD', sub_of_diagnosis(ql, opt))
        if tx and not dx:
            return ('XT', sub_of_treatment(opt, ql))
        if dx:
            return ('CD', sub_of_diagnosis(ql, opt))
    # 5) Lời dẫn chung chung: dựa vào nội dung đáp án đúng
    if any(opt.startswith(w) for w in DX_OPT_START):
        return ('CD', sub_of_diagnosis(ql, opt))
    if any(opt.startswith(w) for w in TX_OPT_START) or has(opt, PROC + DRUG + PREV):
        return ('XT', sub_of_treatment(opt, ql))
    return ('CD', sub_of_diagnosis(ql, opt))
