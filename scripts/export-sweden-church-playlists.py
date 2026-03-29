#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from openpyxl.utils import get_column_letter


ROOT = Path(__file__).resolve().parent.parent
PLAYLIST_JSON = ROOT / "tmp" / "spreadsheets" / "sweden-church-playlists-playlist-level.json"
CHURCH_JSON = ROOT / "tmp" / "spreadsheets" / "sweden-church-playlists-church-level.json"
OUT_DIR = ROOT / "output" / "spreadsheet"
CSV_PATH = OUT_DIR / "sweden-churches-with-spotify-playlists.csv"
PLAYLIST_CSV_PATH = OUT_DIR / "sweden-church-playlists-playlist-level.csv"
XLSX_PATH = OUT_DIR / "sweden-churches-with-spotify-playlists.xlsx"

CHURCH_COLUMNS = [
    "church_name",
    "city",
    "location",
    "website",
    "email",
    "playlist_count",
    "playlist_urls",
    "playlist_ids",
    "owner_names",
    "confidence",
    "sources",
    "notes",
]

PLAYLIST_COLUMNS = [
    "church_name",
    "city",
    "location",
    "website",
    "email",
    "playlist_name",
    "playlist_id",
    "playlist_url",
    "owner_name",
    "owner_id",
    "playlist_description",
    "confidence",
    "source",
    "matched_queries",
    "notes",
]


def load_json(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"Missing input file: {path}")
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError(f"Expected list in {path}")
    return payload


def frame_with_columns(rows: list[dict], columns: list[str]) -> pd.DataFrame:
    frame = pd.DataFrame(rows)
    for column in columns:
        if column not in frame.columns:
            frame[column] = ""
    return frame[columns]


def autosize_worksheet_columns(writer: pd.ExcelWriter, sheet_name: str, frame: pd.DataFrame) -> None:
    worksheet = writer.sheets[sheet_name]
    for idx, column in enumerate(frame.columns, start=1):
        max_content = max(
            [len(str(column))]
            + [len(str(value)) for value in frame[column].fillna("").astype(str).head(500)]
        )
        worksheet.column_dimensions[get_column_letter(idx)].width = min(max(12, max_content + 2), 80)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    church_rows = load_json(CHURCH_JSON)
    playlist_rows = load_json(PLAYLIST_JSON)

    churches = frame_with_columns(church_rows, CHURCH_COLUMNS).sort_values(
        by=["confidence", "playlist_count", "church_name"],
        ascending=[False, False, True],
        kind="stable",
    )
    playlists = frame_with_columns(playlist_rows, PLAYLIST_COLUMNS).sort_values(
        by=["confidence", "church_name", "playlist_name"],
        ascending=[False, True, True],
        kind="stable",
    )

    churches.to_csv(CSV_PATH, index=False)
    playlists.to_csv(PLAYLIST_CSV_PATH, index=False)

    with pd.ExcelWriter(XLSX_PATH, engine="openpyxl") as writer:
        churches.to_excel(writer, sheet_name="churches", index=False)
        playlists.to_excel(writer, sheet_name="playlists", index=False)
        autosize_worksheet_columns(writer, "churches", churches)
        autosize_worksheet_columns(writer, "playlists", playlists)

    with_web = int((churches["website"].astype(str).str.len() > 0).sum()) if len(churches) else 0
    with_email = int((churches["email"].astype(str).str.len() > 0).sum()) if len(churches) else 0

    print(f"Church rows: {len(churches)}")
    print(f"Playlist rows: {len(playlists)}")
    print(f"With website: {with_web}")
    print(f"With email: {with_email}")
    print(f"Wrote CSV: {CSV_PATH}")
    print(f"Wrote playlist CSV: {PLAYLIST_CSV_PATH}")
    print(f"Wrote XLSX: {XLSX_PATH}")


if __name__ == "__main__":
    main()
