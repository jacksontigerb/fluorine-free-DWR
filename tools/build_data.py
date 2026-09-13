"""Build data/observations.csv from the lab exports in the Research_Project folder.

Run from the repo root (needs pandas, numpy, matplotlib and pillow, because it imports
the lab's own figlib to reduce the contact angle videos exactly as fig02 did):

    uv run --with pandas --with numpy --with matplotlib --with pillow tools/build_data.py

The lab folder defaults to Jackson's OneDrive; override with DWR_LAB_ROOT.
The output is the only thing the site reads. Nothing here is reconstructed from figures.
"""
import csv
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get(
    "DWR_LAB_ROOT",
    Path.home() / "Library/CloudStorage/OneDrive-UniversityCollegeLondon/Research_Project",
))
LAB = ROOT / "Lab tests"
OUT = Path(__file__).resolve().parent.parent / "data" / "observations.csv"

sys.path.insert(0, str(ROOT / "scripts"))
import numpy as np  # noqa: E402
from figlib import wca_clean  # noqa: E402  (the lab's RMSE gated reduction)

FABRIC = {"C": "cotton", "F": "finisterre"}
PARTICLE = {"U": "none", "A1": "none", "B3": "bare anatase", "C3": "VTMS anatase", "DWR": "commercial"}
SAMPLES = ["C-A1", "C-B3", "C-C3", "F-A1", "F-DWR"]
LARGE_DROP = "about 33 uL"
SMALL_DROP = "smaller (not recorded)"


def stage_exposure(stage):
    """Initial -> (none, 0); W20 -> (wash, 20); AB200 -> (abrasion, 200)."""
    if stage == "Initial":
        return "none", 0
    if stage.startswith("AB"):
        return "abrasion", int(stage[2:])
    return "wash", int(stage[1:])


def base(sample):
    fab, coat = sample.split("-")
    return {"sample": sample, "fabric": FABRIC[fab], "coating": coat, "particle": PARTICLE[coat]}


rows = []

# 1. Baseline contact angle, 29/06, the fig02 reduction: per swatch median of the
#    RMSE gated, smoothed angle over 2 to 10 s after the drop lands.
for s in SAMPLES:
    for rep in (1, 2, 3):
        path = LAB / "WCA" / "WCA_29.06" / f"2{s}.{rep}.csv"
        t, a = wca_clean(path)
        win = (t >= 2) & (t <= 10)
        rows.append({**base(s), "dataset": "wca_baseline", "test": "wca", "exposure": "none",
                     "cycles": 0, "swatch": rep, "drop": 1, "drop_volume": "not recorded",
                     "value_deg": round(float(np.median(a[win])), 2), "status": "measured",
                     "session": "2026-06-29", "source": f"WCA/WCA_29.06/2{s}.{rep}.csv"})

# 2. Roll off with the smaller drop, 01/07 (the only session not repeated in the
#    durability file).
with open(LAB / "ROA" / "RollOff_angles.csv") as f:
    for r in csv.DictReader(f):
        if r["session"] != "2026-07-01":
            continue
        released = r["rolled"].strip().lower() == "true"
        rows.append({**base(r["sample"]), "dataset": "rolloff_small", "test": "rolloff",
                     "exposure": "none", "cycles": 0, "swatch": int(r["replicate"]),
                     "drop": int(r["droplet"]), "drop_volume": SMALL_DROP,
                     "value_deg": r["angle_deg"] if released else "",
                     "status": "released" if released else "no_release_90",
                     "session": r["session"], "source": "ROA/RollOff_angles.csv"})

# 3. Roll off with the larger drop: baseline (02/07, before washing) and every
#    durability stage, same 1.5 cm swatches throughout.
with open(LAB / "ROA" / "ROA_durability_long.csv") as f:
    for r in csv.DictReader(f):
        exposure, cycles = stage_exposure(r["stage"])
        released = r["rolled"].strip().lower() == "true"
        rows.append({**base(r["sample"]), "dataset": "rolloff_durability", "test": "rolloff",
                     "exposure": exposure, "cycles": cycles, "swatch": int(r["replicate"]),
                     "drop": 1, "drop_volume": LARGE_DROP,
                     "value_deg": r["angle_deg"] if released else "",
                     "status": "released" if released else "no_release_90",
                     "session": "2026-07-02" if r["stage"] == "Initial" else "",
                     "source": "ROA/ROA_durability_long.csv"})

# 4. Contact angle through the durability series, median reduction. The lab file
#    repeats the Initial rows once per track, so keep one copy.
seen = set()
with open(LAB / "WCA" / "WCA_durability_long_median.csv") as f:
    for r in csv.DictReader(f):
        if r["sample"] not in SAMPLES:
            continue
        key = (r["stage"], r["sample"], r["replicate"])
        if key in seen:
            continue
        seen.add(key)
        exposure, cycles = stage_exposure(r["stage"])
        rows.append({**base(r["sample"]), "dataset": "wca_durability", "test": "wca",
                     "exposure": exposure, "cycles": cycles, "swatch": int(r["replicate"]),
                     "drop": 1, "drop_volume": "not recorded",
                     "value_deg": round(float(r["wca_deg"]), 2), "status": "measured",
                     "session": "", "source": "WCA/WCA_durability_long_median.csv"})

COLS = ["dataset", "sample", "fabric", "coating", "particle", "test", "exposure", "cycles",
        "swatch", "drop", "drop_volume", "value_deg", "status", "session", "source"]
OUT.parent.mkdir(exist_ok=True)
with open(OUT, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=COLS, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)

counts = {}
for r in rows:
    counts[r["dataset"]] = counts.get(r["dataset"], 0) + 1
print(f"wrote {OUT} ({len(rows)} rows): {counts}")
