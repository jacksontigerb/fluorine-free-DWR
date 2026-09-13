# Data behind the results page

`observations.csv` holds every swatch and every drop plotted on the
[results page](https://jacksontigerb.github.io/fluorine-free-DWR/results.html). It comes
straight from the lab exports, built by `tools/build_data.py`. Nothing in it was read off a figure.

One row is one measurement: one drop on one swatch at one stage.

| Column | Meaning |
|---|---|
| `dataset` | `wca_baseline` (contact angle before wear, 29 Jun 2026), `rolloff_small` (roll off with a smaller drop, 1 Jul), `rolloff_durability` (roll off with the larger drop, before wear on 2 Jul and at every durability stage), `wca_durability` (contact angle at every durability stage) |
| `sample` | `C-A1`, `C-B3`, `C-C3` on cotton; `F-A1`, `F-DWR` on Finisterre fabric |
| `fabric` | `cotton` or `finisterre` (the same Finisterre cloth for F-A1 and F-DWR, supplied without and with the commercial finish) |
| `coating` | `A1` emulsion only, `B3` emulsion with 3 wt% bare anatase, `C3` emulsion with 3 wt% silane (VTMS) treated anatase, `DWR` Finisterre's commercial finish |
| `particle` | Particle treatment in words |
| `test` | `wca` contact angle or `rolloff` roll off angle |
| `exposure` | `none` (before wear), `wash` or `abrasion` |
| `cycles` | Wash cycles (0, 1, 5, 10, 20) or abrasion passes (0, 10, 30, 50, 100, 200) |
| `swatch` | Swatch 1 to 3 within a sample. Durability rows use the same 1.5 cm swatches at every stage. Baseline contact angle swatches were measured before the swatches were cut down, so swatch numbers are not linked across datasets |
| `drop` | Drop number on that swatch (the smaller drop test used 3 drops per F-DWR swatch) |
| `drop_volume` | `about 33 uL` for the larger drop roll off; the smaller drop and the contact angle drop volumes were not recorded |
| `value_deg` | Angle in degrees. Empty when the drop had not moved by 90 degrees |
| `status` | `measured` (contact angle), `released` or `no_release_90` (roll off) |
| `session` | Date where known |
| `source` | File in the lab folder the row came from |

## How the numbers were made

- **Contact angle, before wear.** Ossila goniometer, 30 frames per second. Each side of the drop is
  kept only where its fit RMSE is at most 1.0, the two sides averaged, then smoothed with a 15 frame
  rolling median. The swatch value is the median over 2 to 10 s after the drop lands.
- **Contact angle, durability.** The lab's median reduction file. The before wear values in it differ
  from the `wca_baseline` rows by at most 1.5 degrees, because it was reduced separately.
- **Roll off.** Tilting stage read from an angle gauge, maximum 90 degrees. A drop that had not moved by
  then is recorded as `no_release_90`. The charts never average these in as 90; a mean that leaves one
  out is marked.
- **Wash cycle.** 10 minutes in 500 mL deionised water with 2.5 g Alcojet at 40 °C, stirred at 300 rpm,
  rinsed and air dried overnight with no heat.
- **Abrasion pass.** One 10 cm hand stroke of a 1.5 cm swatch under 157 g (about 6.8 kPa) across 1000 grit
  sandpaper.

Three swatches per condition, all from one coated batch. The full method and statistics are in the
[dissertation](../assets/docs/brocklebank-2026-fluorine-free-dwr-dissertation.pdf).

## Rebuilding

From the repo root, with the lab folder available (defaults to the OneDrive path; set `DWR_LAB_ROOT`
otherwise):

    uv run --with pandas --with numpy --with matplotlib --with pillow tools/build_data.py
