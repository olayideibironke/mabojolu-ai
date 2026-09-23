#!/usr/bin/env python3
"""
Mabojolu local multimodal document worker.

This helper intentionally uses the Python standard library for non-macro OOXML
containers. PDF support is optional through the free pypdf package.

It never executes uploaded content, macros, formulas, scripts, or embedded
objects. It only reads bounded text and document structure.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


MAX_TEXT_CHARS = 400_000
MAX_ROWS_PER_SHEET = 5_000
MAX_CELLS_PER_ROW = 256


def emit(payload: dict[str, Any]) -> None:
    serialized = json.dumps(payload, ensure_ascii=False)
    sys.stdout.buffer.write(serialized.encode("utf-8"))


def fail(code: str, message: str) -> None:
    emit(
        {
            "ok": False,
            "code": code,
            "message": message,
        }
    )


def bounded(text: str) -> tuple[str, bool]:
    if len(text) <= MAX_TEXT_CHARS:
        return text, False
    return text[:MAX_TEXT_CHARS], True


def xml_root(archive: zipfile.ZipFile, name: str) -> ET.Element:
    with archive.open(name, "r") as handle:
        return ET.fromstring(handle.read())


def natural_key(value: str) -> list[Any]:
    return [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r"(\d+)", value)
    ]


def extract_docx(path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(path, "r") as archive:
        names = set(archive.namelist())
        required = "word/document.xml"
        if required not in names:
            raise ValueError("DOCX container is missing word/document.xml.")

        root = xml_root(archive, required)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

        paragraphs: list[str] = []
        for paragraph in root.findall(".//w:p", ns):
            pieces = [
                node.text or ""
                for node in paragraph.findall(".//w:t", ns)
            ]
            value = "".join(pieces).strip()
            if value:
                paragraphs.append(value)

        text, truncated = bounded("\n".join(paragraphs))
        return {
            "ok": True,
            "processor": "python-stdlib-docx-v1",
            "text": text,
            "metadata": {
                "paragraphs": len(paragraphs),
            },
            "warnings": (
                ["Extracted text was truncated to the configured limit."]
                if truncated
                else []
            ),
        }


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = xml_root(archive, "xl/sharedStrings.xml")
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    values: list[str] = []
    for item in root.findall("x:si", ns):
        parts = [
            node.text or ""
            for node in item.findall(".//x:t", ns)
        ]
        values.append("".join(parts))
    return values


def workbook_sheet_names(archive: zipfile.ZipFile) -> list[str]:
    if "xl/workbook.xml" not in archive.namelist():
        return []

    root = xml_root(archive, "xl/workbook.xml")
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    return [
        sheet.attrib.get("name", f"Sheet {index + 1}")
        for index, sheet in enumerate(root.findall(".//x:sheets/x:sheet", ns))
    ]


BUILTIN_EXCEL_DATE_FORMAT_IDS = {
    *range(14, 23),
    *range(27, 37),
    *range(45, 48),
    *range(50, 59),
}


def workbook_uses_1904_dates(archive: zipfile.ZipFile) -> bool:
    if "xl/workbook.xml" not in archive.namelist():
        return False

    root = xml_root(archive, "xl/workbook.xml")
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    properties = root.find("x:workbookPr", ns)
    if properties is None:
        return False

    return properties.attrib.get("date1904", "").strip().lower() in {"1", "true"}


def workbook_number_formats(
    archive: zipfile.ZipFile,
) -> tuple[list[int], dict[int, str]]:
    if "xl/styles.xml" not in archive.namelist():
        return [], {}

    root = xml_root(archive, "xl/styles.xml")
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    custom_formats: dict[int, str] = {}
    for number_format in root.findall("x:numFmts/x:numFmt", ns):
        raw_id = number_format.attrib.get("numFmtId", "")
        try:
            number_format_id = int(raw_id)
        except ValueError:
            continue
        custom_formats[number_format_id] = number_format.attrib.get("formatCode", "")

    style_number_format_ids: list[int] = []
    for style in root.findall("x:cellXfs/x:xf", ns):
        try:
            style_number_format_ids.append(int(style.attrib.get("numFmtId", "0")))
        except ValueError:
            style_number_format_ids.append(0)

    return style_number_format_ids, custom_formats


def normalized_excel_format_code(format_code: str) -> str:
    value = re.sub(r'"[^"]*"', "", format_code)
    value = re.sub(r"\\.", "", value)
    value = re.sub(r"\[[^\]]*\]", "", value)
    value = value.replace("_", "").replace("*", "")
    return value.lower()


def is_excel_date_format(number_format_id: int, format_code: str | None) -> bool:
    if number_format_id in BUILTIN_EXCEL_DATE_FORMAT_IDS:
        return True
    if not format_code:
        return False

    normalized = normalized_excel_format_code(format_code)
    return bool(re.search(r"[ymdhis]", normalized))


def excel_serial_to_text(raw: str, uses_1904_dates: bool) -> str | None:
    try:
        serial = float(raw)
    except ValueError:
        return None

    if serial < 0:
        return None

    if uses_1904_dates:
        converted = datetime(1904, 1, 1) + timedelta(days=serial)
    else:
        whole_days = int(serial)
        fraction = serial - whole_days
        if whole_days == 60:
            if abs(fraction) < 1e-12:
                return "1900-02-29"
            seconds = round(fraction * 86_400)
            hours, remainder = divmod(seconds, 3_600)
            minutes, seconds = divmod(remainder, 60)
            return f"1900-02-29T{hours:02d}:{minutes:02d}:{seconds:02d}"
        base = datetime(1899, 12, 31)
        adjusted_days = whole_days if whole_days < 60 else whole_days - 1
        converted = base + timedelta(days=adjusted_days, seconds=fraction * 86_400)

    if abs(serial - round(serial)) < 1e-12:
        return converted.date().isoformat()

    if converted.microsecond:
        return converted.isoformat(timespec="microseconds")
    return converted.isoformat(timespec="seconds")


def formatted_excel_value(
    raw: str,
    cell: ET.Element,
    style_number_format_ids: list[int],
    custom_formats: dict[int, str],
    uses_1904_dates: bool,
) -> str:
    raw_style_index = cell.attrib.get("s")
    if raw_style_index is None:
        return raw

    try:
        style_index = int(raw_style_index)
    except ValueError:
        return raw

    if not 0 <= style_index < len(style_number_format_ids):
        return raw

    number_format_id = style_number_format_ids[style_index]
    format_code = custom_formats.get(number_format_id)
    if not is_excel_date_format(number_format_id, format_code):
        return raw

    return excel_serial_to_text(raw, uses_1904_dates) or raw


def cell_value(
    cell: ET.Element,
    strings: list[str],
    ns: dict[str, str],
    style_number_format_ids: list[int],
    custom_formats: dict[int, str],
    uses_1904_dates: bool,
) -> str:
    cell_type = cell.attrib.get("t", "")
    formula = cell.find("x:f", ns)
    value = cell.find("x:v", ns)
    inline = cell.find(".//x:is/x:t", ns)

    if inline is not None:
        return inline.text or ""

    raw = value.text if value is not None and value.text is not None else ""

    if cell_type == "s":
        try:
            index = int(raw)
            return strings[index] if 0 <= index < len(strings) else raw
        except ValueError:
            return raw

    displayed = formatted_excel_value(
        raw,
        cell,
        style_number_format_ids,
        custom_formats,
        uses_1904_dates,
    )

    if formula is not None and formula.text:
        if displayed:
            return f"={formula.text} -> {displayed}"
        return f"={formula.text}"

    return displayed


def extract_xlsx(path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(path, "r") as archive:
        worksheet_paths = sorted(
            [
                name
                for name in archive.namelist()
                if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name)
            ],
            key=natural_key,
        )

        if not worksheet_paths:
            raise ValueError("XLSX container contains no worksheets.")

        strings = shared_strings(archive)
        sheet_names = workbook_sheet_names(archive)
        style_number_format_ids, custom_formats = workbook_number_formats(archive)
        uses_1904_dates = workbook_uses_1904_dates(archive)
        ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

        blocks: list[str] = []
        total_rows = 0
        warnings: list[str] = []

        for sheet_index, worksheet_path in enumerate(worksheet_paths):
            root = xml_root(archive, worksheet_path)
            display_name = (
                sheet_names[sheet_index]
                if sheet_index < len(sheet_names)
                else f"Sheet {sheet_index + 1}"
            )

            lines = [f"[Sheet: {display_name}]"]
            rows = root.findall(".//x:sheetData/x:row", ns)

            for row_index, row in enumerate(rows):
                if row_index >= MAX_ROWS_PER_SHEET:
                    warnings.append(
                        f"Sheet {display_name} exceeded the row extraction limit."
                    )
                    break

                cells = row.findall("x:c", ns)[:MAX_CELLS_PER_ROW]
                values = [
                    cell_value(
                        cell,
                        strings,
                        ns,
                        style_number_format_ids,
                        custom_formats,
                        uses_1904_dates,
                    ).replace("\t", " ").replace("\n", " ")
                    for cell in cells
                ]
                lines.append("\t".join(values))
                total_rows += 1

            blocks.append("\n".join(lines))

        text, truncated = bounded("\n\n".join(blocks))
        if truncated:
            warnings.append("Extracted workbook text was truncated to the configured limit.")

        return {
            "ok": True,
            "processor": "python-stdlib-xlsx-v1",
            "text": text,
            "metadata": {
                "sheets": sheet_names or [
                    f"Sheet {index + 1}" for index in range(len(worksheet_paths))
                ],
                "sheetCount": len(worksheet_paths),
                "extractedRows": total_rows,
            },
            "warnings": warnings,
        }


def extract_pptx(path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(path, "r") as archive:
        slide_paths = sorted(
            [
                name
                for name in archive.namelist()
                if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
            ],
            key=natural_key,
        )

        if not slide_paths:
            raise ValueError("PPTX container contains no slides.")

        ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
        blocks: list[str] = []

        for index, slide_path in enumerate(slide_paths):
            root = xml_root(archive, slide_path)
            text_nodes = [
                node.text or ""
                for node in root.findall(".//a:t", ns)
            ]
            cleaned = [value.strip() for value in text_nodes if value.strip()]
            blocks.append(
                "\n".join([f"[Slide {index + 1}]", *cleaned])
            )

        text, truncated = bounded("\n\n".join(blocks))
        return {
            "ok": True,
            "processor": "python-stdlib-pptx-v1",
            "text": text,
            "metadata": {
                "slides": len(slide_paths),
            },
            "warnings": (
                ["Extracted presentation text was truncated to the configured limit."]
                if truncated
                else []
            ),
        }


def extract_pdf(path: Path) -> dict[str, Any]:
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        return {
            "ok": False,
            "code": "missing_dependency",
            "message": "PDF extraction requires the free local Python package pypdf.",
        }

    reader = PdfReader(str(path))
    blocks: list[str] = []
    warnings: list[str] = []

    for index, page in enumerate(reader.pages):
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""
            warnings.append(f"Page {index + 1} text extraction failed.")

        blocks.append(f"[Page {index + 1}]\n{page_text.strip()}")

    text, truncated = bounded("\n\n".join(blocks))
    if truncated:
        warnings.append("Extracted PDF text was truncated to the configured limit.")

    return {
        "ok": True,
        "processor": "pypdf-v1",
        "text": text,
        "metadata": {
            "pages": len(reader.pages),
        },
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--mime", required=True)
    args = parser.parse_args()

    path = Path(args.input)

    if not path.is_file():
        fail("missing_input", "The local document worker could not find the input file.")
        return 2

    try:
        if args.mime == "application/pdf":
            payload = extract_pdf(path)
        elif args.mime == (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ):
            payload = extract_docx(path)
        elif args.mime == (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ):
            payload = extract_xlsx(path)
        elif args.mime == (
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ):
            payload = extract_pptx(path)
        else:
            fail("unsupported_mime", f"Unsupported document MIME type: {args.mime}")
            return 3

        emit(payload)
        return 0 if payload.get("ok") else 4
    except zipfile.BadZipFile:
        fail("invalid_container", "The Office file is not a valid OOXML ZIP container.")
        return 5
    except ET.ParseError:
        fail("invalid_xml", "The Office file contains invalid XML.")
        return 6
    except Exception as exc:
        fail("processing_error", str(exc))
        return 7


if __name__ == "__main__":
    raise SystemExit(main())