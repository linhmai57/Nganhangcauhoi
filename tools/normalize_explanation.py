"""Chuẩn hóa phần đáp án – giải thích theo "Hướng dẫn viết MCQ bậc cao dạng tình huống":

    Đáp án và lập luận: <X>. <vì sao đáp án là tốt nhất>
    <Y>. <vì sao phương án nhiễu Y không phải tốt nhất>   (lần lượt cho cả 3 phương án nhiễu)

Các file gốc dùng nhiều cách trình bày khác nhau; module này tách ra hai phần:
  r  – lập luận cho đáp án đúng
  d  – {chữ cái: lý do loại} cho từng phương án nhiễu
và bỏ các ghi chú nội bộ dành cho người biên soạn/thẩm định.
"""
import re

LETTERS = 'ABCDE'

# Nhãn mở đầu phần lập luận cho đáp án đúng
RATIONALE_LABEL = re.compile(
    r'^(Giải thích đáp án đúng|Giải thích đáp án|Giải thích bước đầu|Giải thích|Cơ sở lựa chọn|'
    r'Lý do chọn|Lập luận đáp án|Lập luận)\s*[:：]\s*', re.I)

# Nhãn mở đầu đoạn phân tích phương án nhiễu viết liền một đoạn
INLINE_LABEL = re.compile(
    r'^(Phân tích lựa chọn còn lại|Phân tích phương án khác|Giải thích phương án nhiễu'
    r'(\s*\([^)]*\))?)\s*[:：]\s*', re.I)

# Một dòng giải thích cho một phương án
OPTION_LINE = re.compile(
    r'^(?:Phương án\s+|Loại trừ\s+)?([A-E])'
    r'(?:\s*[.:]\s*|\s+(?:chưa phù hợp|không phù hợp|không chọn)\s*[:.]\s*)(.*)$', re.S | re.I)

# Ghi chú nội bộ cho người biên soạn / thẩm định – không hiển thị cho người học
META = [
    r'\s*\[YÊU CẦU[^\]]*\]',
    r'\s*Đáp án phải được bác sĩ thẩm định độc lập trước khi công bố\.?',
    r';?\s*đối chiếu với phân tích trên khi thẩm định\.?',
    r'\s*Phần đối chiếu cụ thể từng lựa chọn cần thẩm định chuyên khoa trước khi sử dụng\.?',
    r';?\s*cần kiểm tra lại nếu dữ kiện lâm sàng thay đổi\.?',
]

# Tiền tố đánh giá đúng/sai ở đầu lý do (bỏ để thống nhất cách trình bày)
VERDICT = re.compile(
    r'^((Đúng|ĐÚNG|Sai|SAI|Chưa phù hợp|Không phù hợp|Không chọn)\s*[:.–—-]\s*)+',
    re.I)


def clean(text):
    for pat in META:
        text = re.sub(pat, '', text, flags=re.I)
    text = re.sub(r'\.\.+', '.', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def tidy(text):
    """Viết hoa chữ đầu, kết thúc bằng dấu chấm."""
    text = text.strip(' ;')
    if not text:
        return ''
    text = text[0].upper() + text[1:]
    if text[-1] not in '.!?…)”»':
        text += '.'
    return text


def strip_option(reason, option):
    """Bỏ phần lặp lại nguyên văn nội dung phương án ở đầu lý do."""
    o = option.strip().rstrip('.')
    if o and reason.lower().startswith(o.lower()) and re.match(r'^\s*([.:;,–—-]|$)', reason[len(o):]):
        reason = reason[len(o):]
        reason = re.sub(r'^\s*[.:;,–—-]+\s*', '', reason)
    return reason


def split_inline(text, letters):
    """Tách đoạn 'A không phù hợp: ... B: ... ' thành {chữ: lý do}. Trả về (phần trước, dict)."""
    pos, marks = 0, []
    for L in letters:
        pat = re.compile(r'(?:^|(?<=[.;:]\s)|(?<=[.;:]))\s*(?:Phương án\s+)?' + L +
                         r'(?=\s+không phù hợp|\s+khác với|\s+chưa phù hợp|\s*:)')
        m = pat.search(text, pos)
        if not m:
            return text, {}
        marks.append((L, m.start(), m.end()))
        pos = m.end()
    head = text[:marks[0][1]].strip()
    out = {}
    for i, (L, s, e) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
        seg = text[e:end].strip()
        seg = re.sub(r'^(không phù hợp|chưa phù hợp)\s*:\s*', '', seg, flags=re.I)
        seg = re.sub(r'^:\s*', '', seg)
        out[L] = seg.strip(' ;')
    return head, out


def normalize(q):
    ans = q['answer']
    options = q['options']
    letters = LETTERS[:len(options)]
    others = [L for L in letters if L != ans]
    ans_text = options[letters.index(ans)]

    rationale, correct_line = [], None
    dist = {}
    for raw in q['explanation']:
        line = clean(raw.replace('\n', ' '))
        if not line:
            continue
        m = INLINE_LABEL.match(line)
        if m:
            _, parts = split_inline(line[m.end():], others)
            dist.update({k: v for k, v in parts.items() if v})
            continue
        m = RATIONALE_LABEL.match(line)
        if m:
            body = line[m.end():]
            head, parts = split_inline(body, others)  # Nhóm 09: lý do loại nằm chung đoạn
            if parts:
                body = head
                dist.update({k: v for k, v in parts.items() if v})
            body = strip_option(body, ans_text)
            if body:
                rationale.append(body)
            continue
        m = OPTION_LINE.match(line)
        if m and m.group(1) in letters:
            L, reason = m.group(1), m.group(2).strip()
            reason = strip_option(VERDICT.sub('', reason), options[letters.index(L)])
            reason = VERDICT.sub('', reason)
            if L == ans:
                correct_line = reason
            else:
                dist[L] = reason
            continue
        rationale.append(strip_option(line, ans_text))  # đoạn lập luận không có nhãn

    r = ' '.join(x for x in rationale if x) or (correct_line or '')
    out_d = {}
    for L in others:
        reason = dist.get(L, '')
        # "B khác với hướng chẩn đoán/xử trí chính: <nội dung phương án>"
        reason = strip_option(reason, options[letters.index(L)]) if reason else ''
        if re.match(r'^khác với hướng', reason, re.I) or (not reason and L in dist):
            reason = 'Khác với hướng chẩn đoán/xử trí chính được dữ kiện của ca hỗ trợ'
        out_d[L] = tidy(VERDICT.sub('', reason))
    return {'r': tidy(r), 'd': out_d}
