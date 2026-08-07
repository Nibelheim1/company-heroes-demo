#!/usr/bin/env python3
"""Normalize the TSV hero catalog and portrait assets for the H5 app.

The source folder contains 320 portraits whose filenames end in a six digit
stock code.  Some of those files have a ``.png`` suffix while containing JPEG
bytes.  This script decodes every selected source image with Pillow and writes
real WebP files for the app, avoiding a browser/MIME mismatch while keeping a
repeatable audit trail in ``data/asset-report.json``.

Run from either the repository root or ``full-h5``::

    python full-h5/scripts/normalize-assets.py
    python scripts/normalize-assets.py

Paths can be overridden when importing a refreshed TSV or asset directory.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from PIL import Image, ImageOps, UnidentifiedImageError


EXPECTED_HEADERS = [
    "股票代码",
    "股票名称",
    "股票池",
    "英雄ID",
    "公司/行业事实",
    "核心矛盾",
    "人格原型",
    "视觉关键词",
    "一句话使命",
    "优势标签1",
    "优势标签2",
    "优势标签3",
    "真实取舍",
    "结果页短文案",
    "详情页长文案",
    "答题匹配标签",
    "社群传播钩子",
    "避免表达",
    "审核状态",
    "备注",
]

CODE_RE = re.compile(r"(?<!\d)(\d{6})(?=\.[^.]+$)", re.IGNORECASE)
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def path_from(value: str | Path, base: Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else base / path


def relative_path(path: Path, workspace: Path) -> str:
    """Return a stable, repository-relative path where possible."""

    try:
        return path.resolve().relative_to(workspace.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sniff_format(path: Path) -> str:
    """Detect the byte-level format without trusting the filename suffix."""

    with path.open("rb") as handle:
        header = handle.read(16)
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"
    if header.startswith(b"\xff\xd8\xff"):
        return "JPEG"
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "WEBP"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return "GIF"
    if header.startswith(b"BM"):
        return "BMP"
    return "UNKNOWN"


def atomic_save_webp(image: Image.Image, destination: Path, quality: int) -> None:
    """Save a WebP atomically so an interrupted run never leaves a partial file."""

    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.stem}-", suffix=".tmp", dir=destination.parent
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        # method=4 keeps the first-run/rebuild time reasonable for 320 portraits
        # while quality=84/78 provides the requested visual fidelity.
        image.save(temporary, format="WEBP", quality=quality, method=4)
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def resize_for_webp(image: Image.Image, maximum: int) -> Image.Image:
    """Orient and resize without upscaling, preserving transparency if present."""

    oriented = ImageOps.exif_transpose(image)
    has_alpha = "A" in oriented.getbands() or (
        oriented.mode == "P" and "transparency" in oriented.info
    )
    converted = oriented.convert("RGBA" if has_alpha else "RGB")
    if max(converted.size) > maximum:
        converted.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
    return converted


def split_tags(value: str, separator: str) -> list[str]:
    return [part.strip() for part in value.split(separator) if part.strip()]


def normalize_code(value: Any) -> str | None:
    text = "" if value is None else str(value).strip()
    if not text or not text.isdigit() or len(text) > 6:
        return None
    return text.zfill(6)


def read_catalog(path: Path) -> tuple[list[tuple[int, dict[str, str]]], dict[str, Any]]:
    """Read the TSV while retaining every source copy field verbatim."""

    rows: list[tuple[int, dict[str, str]]] = []
    anomalies: dict[str, Any] = {
        "header": None,
        "headerMismatch": False,
        "rowFieldCountIssues": [],
    }
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        headers = reader.fieldnames or []
        anomalies["header"] = headers
        anomalies["headerMismatch"] = headers != EXPECTED_HEADERS
        for row_number, raw in enumerate(reader, start=2):
            extra_values = raw.get(None)
            if extra_values:
                anomalies["rowFieldCountIssues"].append(
                    {"line": row_number, "extraFields": len(extra_values)}
                )
            row: dict[str, str] = {}
            for header in EXPECTED_HEADERS:
                value = raw.get(header, "")
                row[header] = "" if value is None else value
            rows.append((row_number, row))
    return rows, anomalies


def discover_portraits(directory: Path) -> tuple[dict[str, list[Path]], list[str]]:
    """Map six digit codes to source files and list image-like files without codes."""

    by_code: dict[str, list[Path]] = defaultdict(list)
    unmatched: list[str] = []
    if not directory.exists():
        return by_code, unmatched
    for path in sorted(directory.iterdir(), key=lambda item: item.name.casefold()):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        match = CODE_RE.search(path.name)
        if match:
            by_code[match.group(1)].append(path)
        else:
            unmatched.append(path.name)
    return by_code, unmatched


def source_stem(path: Path) -> str:
    match = re.match(r"^(.*)-\d{6}\.[^.]+$", path.name)
    return match.group(1) if match else path.stem


def build_hero(row: dict[str, str], code: str, source: Path) -> dict[str, Any]:
    """Create the canonical frontend record plus an exact copy-field payload."""

    copy_fields = {header: row.get(header, "") for header in EXPECTED_HEADERS}
    stock_name = row["股票名称"].strip()
    pool = row["股票池"].strip()
    archetype = row["人格原型"].strip()
    hero_id = f"H{code}"
    image_path = f"/heroes/{code}.webp"
    thumbnail_path = f"/heroes/thumb/{code}.webp"
    return {
        "id": hero_id,
        "heroId": hero_id,
        "code": code,
        "stockCode": code,
        "name": stock_name,
        "stockName": stock_name,
        "pool": pool,
        "stockPool": pool,
        "companyFact": row["公司/行业事实"],
        "coreConflict": row["核心矛盾"],
        "archetype": archetype,
        "role": archetype,
        "visualKeywords": row["视觉关键词"],
        "visualKeywordParts": split_tags(row["视觉关键词"], ","),
        "mission": row["一句话使命"],
        "strengths": [row[key] for key in ("优势标签1", "优势标签2", "优势标签3") if row[key]],
        "tradeoff": row["真实取舍"],
        "resultCopy": row["结果页短文案"],
        "detailCopy": row["详情页长文案"],
        "answerTags": split_tags(row["答题匹配标签"], ";"),
        "communityHook": row["社群传播钩子"],
        "avoidExpression": row["避免表达"],
        "reviewStatus": row["审核状态"],
        "note": row["备注"],
        "image": image_path,
        "imagePath": image_path,
        "thumbnailPath": thumbnail_path,
        "sourcePortrait": source.name,
        "copy": copy_fields,
    }


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    os.replace(temporary, path)


def parse_args() -> argparse.Namespace:
    script_root = Path(__file__).resolve()
    default_workspace = script_root.parents[2]
    default_h5 = default_workspace / "full-h5"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=default_workspace)
    parser.add_argument(
        "--input",
        dest="input_tsv",
        type=Path,
        default=Path("立绘文件夹") / "heroes_output.tsv",
        help="TSV path, relative to --workspace by default",
    )
    parser.add_argument(
        "--portraits",
        type=Path,
        default=Path("立绘文件夹"),
        help="Portrait directory, relative to --workspace by default",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=default_h5 / "public" / "heroes",
        help="WebP output directory (absolute by default)",
    )
    parser.add_argument(
        "--data-out",
        type=Path,
        default=default_h5 / "data" / "heroes.json",
        help="Normalized catalog JSON path",
    )
    parser.add_argument(
        "--report-out",
        type=Path,
        default=default_h5 / "data" / "asset-report.json",
        help="Asset audit report path",
    )
    parser.add_argument("--expected-count", type=int, default=320)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    workspace = args.workspace.resolve()
    input_tsv = path_from(args.input_tsv, workspace).resolve()
    portraits_dir = path_from(args.portraits, workspace).resolve()
    out_dir = path_from(args.out_dir, workspace).resolve()
    data_out = path_from(args.data_out, workspace).resolve()
    report_out = path_from(args.report_out, workspace).resolve()

    generated_at = utc_now()
    rows, catalog_anomalies = read_catalog(input_tsv)
    portraits, unmatched_source_files = discover_portraits(portraits_dir)

    tsv_code_rows: dict[str, list[tuple[int, dict[str, str]]]] = defaultdict(list)
    invalid_rows: list[dict[str, Any]] = []
    ordered_codes: list[str] = []
    for line, row in rows:
        code = normalize_code(row.get("股票代码"))
        if code is None:
            invalid_rows.append(
                {"line": line, "stockCode": row.get("股票代码", ""), "name": row.get("股票名称", "")}
            )
            continue
        if code not in tsv_code_rows:
            ordered_codes.append(code)
        tsv_code_rows[code].append((line, row))

    duplicate_tsv_codes = [
        {"code": code, "lines": [line for line, _ in entries]}
        for code, entries in sorted(tsv_code_rows.items())
        if len(entries) > 1
    ]
    duplicate_source_codes = [
        {"code": code, "files": [path.name for path in paths]}
        for code, paths in sorted(portraits.items())
        if len(paths) > 1
    ]

    missing_images: list[dict[str, Any]] = []
    name_mismatches: list[dict[str, str]] = []
    mime_mismatches: list[dict[str, Any]] = []
    conversion_failures: list[dict[str, Any]] = []
    heroes: list[dict[str, Any]] = []
    converted_assets: list[dict[str, Any]] = []

    # Ensure the destination exists before writing temporary files.
    out_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir = out_dir / "thumb"
    thumb_dir.mkdir(parents=True, exist_ok=True)

    # Keep the source TSV ordering so the first-screen catalog remains the
    # author's chosen order; duplicate codes are still reported above.
    for code in ordered_codes:
        entries = tsv_code_rows[code]
        # A duplicate row is an input anomaly; retain only its first deterministic row.
        line, row = entries[0]
        source_candidates = portraits.get(code, [])
        if not source_candidates:
            missing_images.append(
                {
                    "line": line,
                    "code": code,
                    "name": row.get("股票名称", ""),
                    "heroId": row.get("英雄ID", ""),
                    "pool": row.get("股票池", ""),
                    "reviewStatus": row.get("审核状态", ""),
                    "note": row.get("备注", ""),
                }
            )
            continue
        source = source_candidates[0]
        expected_name = row.get("股票名称", "").strip()
        actual_stem = source_stem(source)
        if actual_stem != expected_name:
            name_mismatches.append(
                {
                    "code": code,
                    "sourceFile": source.name,
                    "sourceStem": actual_stem,
                    "tsvName": expected_name,
                }
            )

        detected = sniff_format(source)
        if source.suffix.lower() == ".png" and detected != "PNG":
            mime_mismatches.append(
                {
                    "code": code,
                    "sourceFile": source.name,
                    "expectedExtension": ".png",
                    "detectedFormat": detected,
                }
            )

        main_path = out_dir / f"{code}.webp"
        thumb_path = thumb_dir / f"{code}.webp"
        try:
            with Image.open(source) as opened:
                source_format = (opened.format or detected).upper()
                source_size = list(opened.size)
                opened.load()
                prepared = resize_for_webp(opened, 1200)
                thumbnail = resize_for_webp(opened, 480)
                main_size = list(prepared.size)
                thumb_size = list(thumbnail.size)
                atomic_save_webp(prepared, main_path, quality=84)
                atomic_save_webp(thumbnail, thumb_path, quality=78)
            # Reopen both outputs to verify that the browser-facing resources decode.
            with Image.open(main_path) as check_main:
                check_main.load()
                main_format = (check_main.format or "").upper()
                verified_main_size = list(check_main.size)
            with Image.open(thumb_path) as check_thumb:
                check_thumb.load()
                thumb_format = (check_thumb.format or "").upper()
                verified_thumb_size = list(check_thumb.size)
            if main_format != "WEBP" or thumb_format != "WEBP":
                raise ValueError(f"output format check failed: {main_format}/{thumb_format}")
            converted_assets.append(
                {
                    "code": code,
                    "sourceFile": source.name,
                    "sourceFormat": source_format,
                    "sourceMimeMismatch": source.suffix.lower() == ".png" and detected != "PNG",
                    "sourceSize": source_size,
                    "mainFile": main_path.name,
                    "mainSize": verified_main_size,
                    "mainBytes": main_path.stat().st_size,
                    "mainSha256": sha256(main_path),
                    "thumbnailFile": f"thumb/{thumb_path.name}",
                    "thumbnailSize": verified_thumb_size,
                    "thumbnailBytes": thumb_path.stat().st_size,
                    "thumbnailSha256": sha256(thumb_path),
                }
            )
            heroes.append(build_hero(row, code, source))
        except (OSError, ValueError, UnidentifiedImageError) as error:
            conversion_failures.append(
                {
                    "line": line,
                    "code": code,
                    "sourceFile": source.name,
                    "error": str(error),
                }
            )

    tsv_codes = set(tsv_code_rows)
    extra_portrait_files = [
        {"code": code, "files": [path.name for path in paths]}
        for code, paths in sorted(portraits.items())
        if code not in tsv_codes
    ]
    expected_codes = {hero["code"] for hero in heroes}
    stale_main_outputs = [
        path.name
        for path in sorted(out_dir.glob("*.webp"), key=lambda item: item.name)
        if path.stem not in expected_codes
    ]
    stale_thumb_outputs = [
        f"thumb/{path.name}"
        for path in sorted(thumb_dir.glob("*.webp"), key=lambda item: item.name)
        if path.stem not in expected_codes
    ]

    payload = {
        "version": 1,
        "generatedAt": generated_at,
        "source": {
            "tsv": relative_path(input_tsv, workspace),
            "portraits": relative_path(portraits_dir, workspace),
            "mainFormat": "webp",
            "thumbnailFormat": "webp",
        },
        "count": len(heroes),
        "heroes": heroes,
    }

    report = {
        "version": 1,
        "generatedAt": generated_at,
        "source": {
            "tsv": relative_path(input_tsv, workspace),
            "portraits": relative_path(portraits_dir, workspace),
            "data": relative_path(data_out, workspace),
            "output": relative_path(out_dir, workspace),
        },
        "expectedCount": args.expected_count,
        "tsvRows": len(rows),
        "sourcePortraits": len({code for code, paths in portraits.items() if paths}),
        "usableHeroes": len(heroes),
        "missingImages": len(missing_images),
        "convertedMain": len(converted_assets),
        "convertedThumb": len(converted_assets),
        "mimeMismatch": len(mime_mismatches),
        "missingImageRows": missing_images,
        "mimeMismatchFiles": mime_mismatches,
        "nameMismatches": name_mismatches,
        "duplicateTsvCodes": duplicate_tsv_codes,
        "duplicateSourceCodes": duplicate_source_codes,
        "extraPortraitFiles": extra_portrait_files,
        "unmatchedSourceFiles": unmatched_source_files,
        "invalidTsvRows": invalid_rows,
        "conversionFailures": conversion_failures,
        "staleMainOutputs": stale_main_outputs,
        "staleThumbOutputs": stale_thumb_outputs,
        "catalog": catalog_anomalies,
        "assets": converted_assets,
        "checks": {
            "expectedCountMatches": len(heroes) == args.expected_count,
            "allSourcesDecoded": len(conversion_failures) == 0 and len(converted_assets) == len(tsv_code_rows) - len(missing_images),
            "allMainDecoded": len(converted_assets) == len(heroes),
            "allThumbsDecoded": len(converted_assets) == len(heroes),
            "mainFiles": len(list(out_dir.glob("*.webp"))),
            "thumbnailFiles": len(list(thumb_dir.glob("*.webp"))),
        },
    }

    write_json(data_out, payload)
    write_json(report_out, report)

    print(
        f"normalized {len(heroes)} heroes from {len(rows)} TSV rows; "
        f"converted {len(converted_assets)} main + {len(converted_assets)} thumbnails; "
        f"missing images={len(missing_images)}, mime mismatches={len(mime_mismatches)}"
    )
    if conversion_failures:
        print(f"conversion failures: {len(conversion_failures)}", file=sys.stderr)
    if len(heroes) != args.expected_count or conversion_failures:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
