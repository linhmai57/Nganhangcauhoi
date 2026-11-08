"""Xuất ngân hàng câu hỏi ra file Excel để nhập vào Google Sheet (bản Google Apps Script).

Cách dùng:  python3 tools/export_sheet.py [đường_dẫn_file_xlsx]
Mặc định đọc data/questions.js + data/blueprint.js, ghi ra xuat/NganHangCauHoi.xlsx
(thư mục xuat/ không được đưa lên GitHub để tránh lộ đề).
"""
import json
import os
import re
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_js_json(text, var):
    m = re.search(r'window\.' + var + r'\s*=\s*', text)
    start = m.end()
    depth, i, in_str, esc = 0, start, False, False
    while True:
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch in '[{':
            depth += 1
        elif ch in ']}':
            depth -= 1
            if depth == 0:
                return json.loads(text[start:i + 1])
        i += 1


def read_blueprint():
    """Đọc data/blueprint.js (cú pháp JS) bằng regex đơn giản."""
    text = open(os.path.join(ROOT, 'data', 'blueprint.js'), encoding='utf-8').read()
    systems = [(int(a), b, float(c), float(d)) for a, b, c, d in re.findall(
        r'\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)",\s*min:\s*([\d.]+),\s*max:\s*([\d.]+)\s*\}', text)]
    comps = [(a, b, float(c), float(d)) for a, b, c, d in re.findall(
        r'\{\s*id:\s*"([A-Z]+)",\s*name:\s*"([^"]+)",\s*min:\s*([\d.]+),\s*max:\s*([\d.]+),', text)]
    return systems, comps


def style_header(ws, widths):
    for cell in ws[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='1D4ED8')
        cell.alignment = Alignment(vertical='center', wrap_text=True)
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    ws.freeze_panes = 'A2'


def main(out_path):
    text = open(os.path.join(ROOT, 'data', 'questions.js'), encoding='utf-8').read()
    problems = read_js_json(text, 'PROBLEMS')
    bank = read_js_json(text, 'QUESTION_BANK')
    systems, comps = read_blueprint()

    wb = Workbook()
    ws = wb.active
    ws.title = 'CauHoi'
    head = ['ID', 'Nhom', 'SoVanDe', 'VanDe', 'NangLuc', 'TieuMuc', 'TinhHuong',
            'A', 'B', 'C', 'D', 'DapAn', 'LapLuan', 'LyDo_A', 'LyDo_B', 'LyDo_C', 'LyDo_D']
    ws.append(head)
    for q in bank:
        opts = (q['options'] + ['', '', '', ''])[:4]
        d = q['ex']['d']
        ws.append([str(q['id']), q['g'], q['p'], problems.get(str(q['p']), ''), q['c'], q['s'],
                   '\n'.join(q['stem']), *opts, q['answer'], q['ex']['r'],
                   d.get('A', ''), d.get('B', ''), d.get('C', ''), d.get('D', '')])
    for row in ws.iter_rows(min_row=2, max_col=1):
        row[0].number_format = '@'  # giữ ID dạng chữ (0051 không bị đổi thành 51)
    style_header(ws, {'A': 8, 'B': 6, 'C': 8, 'D': 24, 'E': 9, 'F': 9, 'G': 60, 'H': 30, 'I': 30,
                      'J': 30, 'K': 30, 'L': 7, 'M': 50, 'N': 35, 'O': 35, 'P': 35, 'Q': 35})

    ws2 = wb.create_sheet('TrongSo')
    ws2.append(['Loai', 'Ma', 'Ten', 'Min', 'Max'])
    for sid, name, mn, mx in systems:
        ws2.append(['HE', sid, name, mn, mx])
    for cid, name, mn, mx in comps:
        ws2.append(['NANGLUC', cid, name, mn, mx])
    style_header(ws2, {'A': 10, 'B': 8, 'C': 50, 'D': 8, 'E': 8})

    ws3 = wb.create_sheet('CaiDat')
    ws3.append(['Khoa', 'GiaTri', 'GhiChu'])
    for row in [
        ['SO_CAU_REALTIME', 120, 'Số câu mỗi đề Real-time'],
        ['THOI_GIAN_PHUT', 180, 'Thời gian làm bài Real-time (phút)'],
        ['SO_CAU_PRACTICE', 40, 'Số câu mỗi đợt Practice'],
        ['TEN_MIEN_EMAIL', 'pctu.edu.vn', 'Chỉ email thuộc tên miền này được dùng'],
        ['GIOI_HAN_REALTIME_NGAY', 3, 'Số đề Real-time tối đa mỗi sinh viên/ngày (0 = không giới hạn)'],
        ['GIOI_HAN_PRACTICE_NGAY', 20, 'Số đợt Practice tối đa mỗi sinh viên/ngày (0 = không giới hạn)'],
    ]:
        ws3.append(row)
    style_header(ws3, {'A': 26, 'B': 14, 'C': 60})

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    wb.save(out_path)
    print(f'Đã ghi {len(bank)} câu vào {out_path}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'xuat', 'NganHangCauHoi.xlsx'))
