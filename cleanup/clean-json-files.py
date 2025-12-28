#!/usr/bin/env python3
"""
Clean and rename JSON metadata files.

Renames: *.jpg.json -> *.json
Keeps only: filename, keywords, format, fileSize, dimensions
"""

import json
import os
import sys
from pathlib import Path


def clean_json_file(source_path: Path) -> tuple[bool, str]:
    """
    Read a .jpg.json file, extract required fields, write to new .json file, delete original.

    Returns (success, message)
    """
    # Compute new filename: foo.jpg.json -> foo.json
    stem = source_path.stem  # e.g., "sample-0003.jpg"
    if stem.endswith('.jpg'):
        new_stem = stem[:-4]  # remove .jpg
    elif stem.endswith('.JPG'):
        new_stem = stem[:-4]
    else:
        return False, f"Unexpected filename pattern: {source_path.name}"

    new_path = source_path.parent / f"{new_stem}.json"

    # Read and parse original JSON
    try:
        with open(source_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, f"JSON parse error: {e}"
    except Exception as e:
        return False, f"Read error: {e}"

    # Extract only required fields
    cleaned = {}
    for field in ['filename', 'keywords', 'format', 'fileSize', 'dimensions']:
        if field in data:
            cleaned[field] = data[field]

    # Write new file
    try:
        with open(new_path, 'w', encoding='utf-8') as f:
            json.dump(cleaned, f, indent=2)
            f.write('\n')  # trailing newline
    except Exception as e:
        return False, f"Write error: {e}"

    # Delete original
    try:
        source_path.unlink()
    except Exception as e:
        return False, f"Delete error (new file was created): {e}"

    return True, f"{source_path.name} -> {new_path.name}"


def main():
    if len(sys.argv) < 2:
        target_dir = Path("/Volumes/dev/kline-martin-archive-complete")
    else:
        target_dir = Path(sys.argv[1])

    if not target_dir.is_dir():
        print(f"Error: {target_dir} is not a directory")
        sys.exit(1)

    # Find all .jpg.json files
    json_files = sorted(target_dir.glob("*.jpg.json")) + sorted(target_dir.glob("*.JPG.json"))
    total = len(json_files)

    if total == 0:
        print(f"No .jpg.json files found in {target_dir}")
        sys.exit(0)

    print(f"Found {total} files to process in {target_dir}")
    print("-" * 60)

    success_count = 0
    fail_count = 0
    failures = []

    for i, filepath in enumerate(json_files, 1):
        success, message = clean_json_file(filepath)

        if success:
            success_count += 1
            if i % 100 == 0 or i == total:
                print(f"[{i}/{total}] Processed {success_count} files...")
        else:
            fail_count += 1
            failures.append((filepath.name, message))
            print(f"[{i}/{total}] FAILED: {filepath.name} - {message}")

    print("-" * 60)
    print(f"Complete: {success_count} succeeded, {fail_count} failed")

    if failures:
        print("\nFailures:")
        for name, msg in failures:
            print(f"  {name}: {msg}")
        sys.exit(1)


if __name__ == "__main__":
    main()
