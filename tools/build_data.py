"""Chuyển các file Word câu hỏi thành data/questions.js cho trang web.

Cách dùng:  python3 tools/build_data.py <thư_mục_chứa_file_docx>
"""
import json
import os
import sys
import collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse_docx  # noqa: E402
import classify  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(folder):
    qs = parse_docx.parse_dir(folder)
    problems, out = {}, []
    stat = collections.Counter()
    for q in qs:
        comp, sub = classify.classify(q)
        stat[comp] += 1
        problems[q['problemNo']] = q['problem']
        out.append({
            'id': q['id'],
            'g': q['group'],
            'p': q['problemNo'],
            'c': comp,
            's': sub,
            'stem': q['stem'],
            'options': q['options'],
            'answer': q['answer'],
            'explanation': q['explanation'],
        })
    path = os.path.join(ROOT, 'data', 'questions.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('/* Tự động tạo bởi tools/build_data.py từ các file Word ngân hàng câu hỏi.\n'
                ' * g = nhóm (hệ cơ quan), p = vấn đề, c/s = miền/tiểu mục năng lực (xem data/blueprint.js).\n'
                ' * Có thể sửa trực tiếp trường "c" và "s" nếu muốn gán lại năng lực cho câu hỏi. */\n')
        f.write('window.PROBLEMS = ' + json.dumps({str(k): v for k, v in sorted(problems.items())},
                                                 ensure_ascii=False, indent=0) + ';\n')
        f.write('window.QUESTION_BANK = [\n')
        f.write(',\n'.join(json.dumps(q, ensure_ascii=False, separators=(',', ':')) for q in out))
        f.write('\n];\n')
    print(f'Đã ghi {len(out)} câu vào {path} ({os.path.getsize(path) // 1024} KB)')
    print('Phân bố năng lực:', dict(stat))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
