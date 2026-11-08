"""Đọc các file Word ngân hàng câu hỏi (PCTU_Nhom_XX_...docx) thành danh sách câu hỏi."""
import re
import glob
import os
import docx

TRAILER = re.compile(r'^(Bảng kiểm|BẢNG KIỂM|CHECKLIST|ĐỀ NGHỊ THẨM ĐỊNH)', re.I)
ANSWER = re.compile(r'^\s*(Đáp án|ĐÁP ÁN)[^:：]*[:：]\s*([A-E])\b\s*(.*)$', re.S)
OPTION = re.compile(r'^\s*([A-E])[.)]\s+(.*)$', re.S)
TITLE = re.compile(r'NHÓM\s+(\d+)\s*[–-]\s*(.+)', re.I)
PROBLEM = re.compile(r'VẤN ĐỀ\s+(\d+)\s*[—–-]\s*(.+)')
CASE = re.compile(r'Ca\s+(\d+)\s*:?\s*(.*)')


def parse_file(path):
    d = docx.Document(path)
    paras = [(p.style.name, p.text.strip()) for p in d.paragraphs if p.text.strip()]
    group = system = None
    problem_no = problem = None
    cases, cur = [], None
    for style, text in paras:
        if TRAILER.match(text):
            break
        if style == 'Title':
            m = TITLE.search(text)
            group, system = int(m.group(1)), m.group(2).strip()
        elif style == 'Heading 1':
            m = PROBLEM.search(text)
            problem_no, problem = int(m.group(1)), m.group(2).strip()
        elif style == 'Heading 2':
            m = CASE.search(text)
            cur = {'case': m.group(1), 'title': m.group(2).strip(), 'group': group, 'system': system,
                   'problemNo': problem_no, 'problem': problem, 'lines': []}
            cases.append(cur)
        elif cur is not None:
            cur['lines'].append(text)
    out = []
    for c in cases:
        q = build(c)
        if q:
            out.append(q)
        else:
            print('  !! Không đọc được ca', c['case'], os.path.basename(path))
    return out


def build(c):
    lines = c.pop('lines')
    ai = next((i for i, t in enumerate(lines) if ANSWER.match(t)), None)
    if ai is None:
        return None
    # khối phương án liên tiếp gần nhất trước dòng đáp án
    opts, j = [], ai - 1
    skipped = 0
    while j >= 0 and not OPTION.match(lines[j]) and skipped < 2:  # bỏ dòng tiêu đề chen giữa
        j -= 1
        skipped += 1
    while j >= 0 and OPTION.match(lines[j]):
        opts.insert(0, OPTION.match(lines[j]))
        j -= 1
    letters = ''.join(m.group(1) for m in opts)
    if len(opts) < 2 or letters != 'ABCDE'[:len(opts)]:
        return None
    stem = lines[:j + 1]
    m = ANSWER.match(lines[ai])
    ans, rest = m.group(2), m.group(3).strip()
    options = [o.group(2).strip() for o in opts]
    # phần giải thích kèm trên dòng đáp án (bỏ phần lặp lại nội dung phương án)
    opt_text = options['ABCDE'.index(ans)]
    rest = re.sub(r'^[.\-–—:\s]+', '', rest)
    if rest.startswith(opt_text):
        rest = rest[len(opt_text):]
    rest = re.sub(r'^[.\-–—:\s]+', '', rest).strip()
    expl = ([rest] if rest else []) + lines[ai + 1:]
    expl = [e for e in expl if not re.fullmatch(r'Giải thích\s*:?', e)]
    question = stem[-1] if stem else ''
    c.update({
        'id': c['case'],
        'stem': stem,
        'questionLine': question,
        'options': options,
        'answer': ans,
        'explanation': expl,
    })
    return c


def parse_dir(folder):
    files = sorted(glob.glob(os.path.join(folder, '*.docx')),
                   key=lambda f: re.search(r'Nhom_(\d+)', f).group(1))
    allq = []
    for f in files:
        qs = parse_file(f)
        print(f'{os.path.basename(f)}: {len(qs)} câu')
        allq += qs
    return allq
