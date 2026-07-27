# 08 — Build Your Own PC Engine

The differentiating feature. Specified to beat `ai-pc-builder.digibuggy.com` on the dimension that matters: **it tells you the truth about whether the machine will actually work.**

**Depends on:** `01 Part B`, `06 §7`, `07`. **Feeds into:** `09`, `17`.

---

## 1. Design principles

| # | Principle | Consequence |
|---|---|---|
| 1 | **Prevent, don't scold.** | Incompatible parts are filtered or visibly disabled at selection time, with a reason. The reference app lets you pick an AM4 board under an AM5 CPU and complains afterwards. |
| 2 | **Specs are data, not text.** | `PartSpec` is authored/imported and Zod-validated. Nothing is regex-parsed from a marketing string at runtime. |
| 3 | **Physical fit is a first-class citizen.** | Case, GPU length, cooler height, radiator mounts, drive bays, PSU form factor, connectors. This is the entire reason the tool exists and the reference app checks none of it. |
| 4 | **Be honest about uncertainty.** | Every part carries `dataConfidence`. **`INFERRED` or `UNVERIFIED` data may never produce a blocking error** — only a caveated warning. A wrong hard block is worse than a soft one. |
| 5 | **Sell what we have.** | Parts are real variants with real stock and real NPR prices. Out-of-stock parts are shown, marked, and offered with an ETA or a substitute — never silently absent. |
| 6 | **No gate.** | Build, save, and share freely. Contact is captured at quote or checkout. |
| 7 | **Persistence is not optional.** | Autosave, permalinks, revisions, print, export. Losing a 20-minute build on refresh is unacceptable. |
| 8 | **Explain in plain language.** | "This graphics card is 358mm long. The case you picked fits 330mm." Not "GPU_LENGTH_CONSTRAINT_VIOLATION". |
| 9 | **Rules are data.** | Stored, versioned, testable, editable by an admin without a deploy. |
| 10 | **Fast.** | Validation is synchronous and < 300 ms p95. The picker is virtualised. |

---

## 2. Slot model

| Slot key | Part type | Required | Max qty | Notes |
|---|---|---|---|---|
| `cpu` | CPU | ✔ | 1 | |
| `motherboard` | MOTHERBOARD | ✔ | 1 | |
| `ram` | RAM | ✔ | 1 kit | Kit, with stick count |
| `gpu` | GPU | conditional | 1 | Optional if CPU has integrated graphics; required otherwise |
| `storage_1..4` | STORAGE | ✔ (slot 1) | 4 | |
| `psu` | PSU | ✔ | 1 | |
| `case` | CASE | ✔ | 1 | |
| `cpu_cooler` | CPU_COOLER | conditional | 1 | Optional if the CPU ships with an adequate stock cooler and TDP allows |
| `case_fan_1..6` | CASE_FAN | ✖ | 6 | |
| `monitor_1..3` | MONITOR | ✖ | 3 | Port matching against the GPU |
| `os` | OS | ✖ | 1 | |
| `expansion_1..3` | CAPTURE/SOUND/NETWORK CARD | ✖ | 3 | Consume PCIe slots |
| `peripherals` | ACCESSORY | ✖ | n | Keyboard, mouse, headset — no compatibility implications |
| `thermal_paste` | THERMAL_PASTE | ✖ | 1 | |
| `assembly` | — (not a `ComponentPart`) | auto | 1 | An order line item added at add-to-cart, priced from settings. It is **not** in the `partType` enum and takes no part in validation. |

**Completeness** = all required slots filled AND zero `ERROR`-severity issues. Only a complete build may be added to cart.

---

## 3. `PartSpec` schemas

Each `partType` has a Zod schema. Writes that fail validation are rejected — the import pipeline sends the row to a review queue rather than guessing.

### CPU
```
socket            enum  AM4|AM5|LGA1700|LGA1851|LGA1200|sTR5|...
brand             enum  AMD|INTEL
family, model
coreCount, pCoreCount?, eCoreCount?, threadCount
baseClockMhz, boostClockMhz
tdpWatts, maxTurboPowerWatts
supportedRamTypes     DDR4[]|DDR5[]
maxRamSpeedMhz, maxRamCapacityGb, memoryChannels
pcieVersion, pcieLanes
integratedGraphics    { present, model? }
includedCooler        { present, adequateUpToTdpWatts? }
requiresDiscreteGpu   bool
unlockedMultiplier    bool
performanceTier       1-10
```

### Motherboard
```
socket, chipset, formFactor  ATX|MICRO_ATX|MINI_ITX|E_ATX
ramType, ramSlots, maxRamCapacityGb, maxRamSpeedMhz (JEDEC + OC)
memoryChannels
pcieSlots[]      { version, lanes, physicalSize x16|x8|x4|x1, position, isFromCpu }
m2Slots[]        { key M|B|B+M, maxLengthMm 2242..22110, pcieVersion, lanes,
                   supportsSata, sharesBandwidthWith? }
sataPorts
usbHeaders       { usb2, usb3Gen1, usb3Gen2, typeC }
fanHeaders, argbHeaders, rgbHeaders
vrmTier          BASIC|STANDARD|ENHANCED|PREMIUM
vrmPhases?
maxCpuTdpRecommendedWatts
cpuPowerConnectors    [{type EPS_8PIN|EPS_4PIN, count}]
onboardWifi, onboardBluetooth, ethernetSpeedMbps
rearPorts[]
biosFlashback    bool     ← matters for AM5/AM4 cross-gen CPU support
supportedCpuList  string[]?   ← when known, authoritative over socket alone
```

### RAM
```
type DDR4|DDR5, speedMhz, casLatency
stickCount, capacityPerStickGb, totalCapacityGb
voltage, profileType XMP|EXPO|JEDEC, profileSpeedMhz
heightMm            ← cooler clearance
eccSupport, registered
```

### GPU
```
chipset, brand NVIDIA|AMD|INTEL, vramGb, vramType
lengthMm, heightMm, thicknessSlots  (2, 2.5, 3, 3.5, 4)
pcieVersion, pcieLanes
tdpWatts, transientPeakWatts, recommendedPsuWatts
powerConnectors  [{type PCIE_8PIN|PCIE_6PIN|PCIE_12VHPWR|PCIE_12V2X6, count}]
outputs          [{type HDMI|DISPLAYPORT|USB_C, version, count}]
maxDisplays
performanceTier 1-10, benchmark1080p/1440p/2160p (relative index)
coolerType BLOWER|OPEN_AIR|AIO|PASSIVE
```

### Storage
```
formFactor M2_2280|M2_2242|M2_22110|SATA_2_5|SATA_3_5|PCIE_AIC
interface  NVME_PCIE3|NVME_PCIE4|NVME_PCIE5|SATA3
m2Key M|B|B+M
capacityGb, seqReadMbs, seqWriteMbs, dramCache, tbwRating
heightMm  ← M.2 heatsink vs GPU backplate clearance
```

### PSU
```
wattage, efficiencyRating 80P_WHITE..80P_TITANIUM
formFactor ATX|SFX|SFX_L|TFX, lengthMm
modularity NON|SEMI|FULL
atx3Compliant, pcie5Ready
connectors [{type, count}]   ATX_24PIN, EPS_8PIN, PCIE_8PIN(6+2),
                             PCIE_12VHPWR, PCIE_12V2X6, SATA_POWER, MOLEX
singleRail, plus12vAmps, qualityTier BUDGET|STANDARD|GOOD|EXCELLENT
warrantyYears
```

### CPU Cooler
```
type AIR|AIO_LIQUID|CUSTOM_LOOP
supportedSockets[]
heightMm                      (air)
radiatorSizeMm 120|140|240|280|360|420   (AIO)
radiatorThicknessMm, fanCount, fanSizeMm
tdpRatingWatts
ramClearanceMm                ← max RAM height under the heatsink
noiseDb, requiresBackplate
```

### Case
```
formFactor FULL_TOWER|MID_TOWER|MINI_TOWER|SFF|HTPC
supportedMotherboardFormFactors[]
maxGpuLengthMm, maxGpuLengthWithFrontFanMm?, gpuSlotCount, verticalGpuSupport
maxCpuCoolerHeightMm
maxPsuLengthMm, psuFormFactors[]
radiatorSupport [{position TOP|FRONT|REAR|SIDE|BOTTOM,
                  sizes[] 120|140|240|280|360|420, maxThicknessMm}]
fanMounts       [{position, size, maxCount}]
includedFans
driveBays { m2ViaMobo, ssd25, hdd35 }
frontPanel [{type, count}]     USB3, USB_C, AUDIO
expansionSlots
psuPosition TOP|BOTTOM|CHAMBER
dimensionsMm { l, w, h }, weightKg
sidePanel TEMPERED_GLASS|MESH|SOLID
```

### Monitor
```
sizeInches, resolution, refreshRateHz, panelType IPS|VA|TN|OLED
responseTimeMs, aspectRatio, curved
inputs [{type HDMI|DISPLAYPORT|USB_C, version, count}]
adaptiveSync NONE|FREESYNC|GSYNC|GSYNC_COMPATIBLE
hdrTier, vesaMount, brightnessNits, colorGamut
```

---

## 4. Compatibility rule engine

### 4.1 Rule representation

Rules are rows in `CompatibilityRule` with a declarative JSONB `expression`. No rule logic is hardcoded.

```json
{
  "code": "CPU_MOBO_SOCKET",
  "severity": "ERROR",
  "subjectType": "CPU",
  "objectType": "MOTHERBOARD",
  "isPreventive": true,
  "isBlocking": true,
  "expression": {
    "op": "NEQ",
    "left":  { "ref": "subject.specs.socket" },
    "right": { "ref": "object.specs.socket" }
  },
  "messageTemplate": "The {{subject.model}} uses a {{subject.specs.socket}} socket, but the {{object.model}} motherboard has a {{object.specs.socket}} socket. They cannot fit together.",
  "fixHintTemplate": "Choose a motherboard with an {{subject.specs.socket}} socket, or a different processor.",
  "autoFixStrategy": "FILTER_OBJECT"
}
```

Supported operators: `EQ NEQ GT GTE LT LTE IN NOT_IN CONTAINS NOT_CONTAINS SUBSET_OF AND OR NOT EXISTS SUM_OF COUNT_OF CONNECTOR_SATISFIED FITS_WITHIN`.

Value refs may address `subject.*`, `object.*`, `build.*` (aggregates like `build.totalPowerWatts`), and `context.*` (target resolution, use case, budget).

**`isPreventive: true`** means the same expression is compiled into a *filter predicate* used to constrain the part picker before selection. This is the mechanism that delivers Principle 1.

### 4.2 Rule catalogue

Severity: **E** blocking error · **W** warning · **I** informational.

#### CPU ↔ Motherboard
| Code | Sev | Check |
|---|---|---|
| `CPU_MOBO_SOCKET` | E | Sockets identical |
| `CPU_MOBO_SUPPORTED_LIST` | W | When `supportedCpuList` exists and excludes the CPU → likely BIOS update needed; downgraded to I if `biosFlashback` is true |
| `CPU_MOBO_RAM_TYPE` | E | CPU `supportedRamTypes` ∋ board `ramType` |
| `CPU_MOBO_VRM` | W | CPU TDP > board `maxCpuTdpRecommendedWatts` |
| `CPU_MOBO_PCIE_GEN` | I | CPU PCIe gen < board PCIe gen (or vice versa) — link trains down |

#### RAM
| Code | Sev | Check |
|---|---|---|
| `RAM_MOBO_TYPE` | E | RAM type = board `ramType` |
| `RAM_MOBO_SLOTS` | E | `stickCount` ≤ `ramSlots` |
| `RAM_MOBO_CAPACITY` | E | `totalCapacityGb` ≤ board `maxRamCapacityGb` |
| `RAM_MOBO_SPEED` | I | RAM speed > board max → will downclock, state the resulting speed |
| `RAM_CPU_SPEED` | I | RAM speed > CPU max → will downclock |
| `RAM_XMP_REQUIRED` | I | `profileType` XMP/EXPO and speed > JEDEC → must be enabled in BIOS (the exact note the approved design shows) |
| `RAM_CHANNEL_SUBOPTIMAL` | W | 1 stick on a dual-channel platform, or 3 sticks |
| `RAM_COOLER_CLEARANCE` | E | RAM `heightMm` > cooler `ramClearanceMm` |

#### GPU
| Code | Sev | Check |
|---|---|---|
| `GPU_REQUIRED` | E | No GPU and CPU has no integrated graphics |
| `GPU_MOBO_SLOT` | E | Board has a free x16 physical slot |
| `GPU_CASE_LENGTH` | E | GPU `lengthMm` ≤ case `maxGpuLengthMm` (use the with-front-fan figure when front fans/radiator are selected) |
| `GPU_CASE_SLOTS` | E | GPU `thicknessSlots` ≤ case `gpuSlotCount` and ≤ remaining board slots |
| `GPU_CASE_HEIGHT` | W | GPU `heightMm` vs case side-panel clearance |
| `GPU_PCIE_GEN` | I | Version mismatch → bandwidth note, non-blocking |
| `GPU_PSU_CONNECTORS` | E | PSU provides every required connector at the required count (12VHPWR/12V2×6 native preferred; adapter → W) |
| `GPU_PSU_WATTAGE` | E | PSU wattage ≥ `recommendedPsuWatts` |
| `GPU_PSU_ATX3` | W | Transient-heavy GPU on a non-ATX 3.0 PSU |
| `GPU_MONITOR_PORTS` | W | Selected monitors' inputs intersect GPU outputs; count ≤ `maxDisplays` |

#### Storage
| Code | Sev | Check |
|---|---|---|
| `STORAGE_M2_SLOTS` | E | M.2 drive count ≤ available M.2 slots |
| `STORAGE_M2_KEY` | E | Drive key compatible with the slot key |
| `STORAGE_M2_LENGTH` | E | Drive form factor ≤ slot `maxLengthMm` |
| `STORAGE_M2_SATA_SUPPORT` | E | SATA M.2 drive in an NVMe-only slot |
| `STORAGE_LANE_SHARING` | W | Populating this M.2 disables SATA ports (`sharesBandwidthWith`) and a SATA drive is also selected |
| `STORAGE_SATA_PORTS` | E | SATA drive count ≤ board `sataPorts` (minus lane-shared losses) |
| `STORAGE_CASE_BAYS` | E | 2.5"/3.5" drive count ≤ case bays |
| `STORAGE_PSU_SATA_POWER` | E | PSU SATA power connectors ≥ SATA drive count |
| `STORAGE_PCIE_GEN` | I | Gen 5 drive on a Gen 4 slot → speed note |

#### Cooling
| Code | Sev | Check |
|---|---|---|
| `COOLER_SOCKET` | E | Cooler `supportedSockets` ∋ CPU socket |
| `COOLER_TDP` | W | Cooler `tdpRatingWatts` < CPU `maxTurboPowerWatts` |
| `COOLER_CASE_HEIGHT` | E | Air cooler `heightMm` ≤ case `maxCpuCoolerHeightMm` |
| `COOLER_RADIATOR_FIT` | E | Case `radiatorSupport` contains a position accepting this radiator size **and** thickness. **The rule the reference app most conspicuously lacks.** |
| `COOLER_RADIATOR_GPU_CONFLICT` | W | Front radiator + long GPU → recompute effective `maxGpuLengthMm` |
| `COOLER_REQUIRED` | W | No cooler and CPU ships none, or CPU TDP exceeds the stock cooler's rating |
| `COOLER_FAN_HEADERS` | W | Total fans > board fan headers (suggest a splitter/hub) |

#### Case & PSU
| Code | Sev | Check |
|---|---|---|
| `CASE_MOBO_FORM_FACTOR` | E | Case `supportedMotherboardFormFactors` ∋ board form factor |
| `CASE_PSU_FORM_FACTOR` | E | Case `psuFormFactors` ∋ PSU form factor |
| `CASE_PSU_LENGTH` | E | PSU `lengthMm` ≤ case `maxPsuLengthMm` |
| `CASE_FRONT_PANEL_HEADERS` | W | Case front panel needs a USB-C header the board lacks |
| `CASE_FAN_COUNT` | I | Fan mounts exceeded |
| `PSU_TOTAL_POWER` | E | See §5 |
| `PSU_QUALITY` | W | `BUDGET` tier PSU with a high-end GPU |
| `PSU_EFFICIENCY_LOAD` | I | Estimated load < 20% or > 80% of rated wattage |
| `PSU_EPS_CONNECTORS` | E | Board `cpuPowerConnectors` satisfied by PSU |

#### Cross-build
| Code | Sev | Check |
|---|---|---|
| `BUILD_BOTTLENECK` | W | See §6 |
| `BUILD_BUDGET_EXCEEDED` | I | Total > `Build.budgetPaisa` |
| `BUILD_STOCK_UNAVAILABLE` | W | A part is out of stock — show ETA and substitutes |
| `BUILD_PRICE_CHANGED` | I | A saved build's part price differs from the snapshot |
| `BUILD_UPGRADE_HEADROOM` | I | Free DIMM slots, free M.2 slots, PSU headroom — framed positively |
| `BUILD_USE_CASE_MISMATCH` | W | e.g. AI/ML use case with < 12 GB VRAM; 4K gaming with a tier-4 GPU |
| `BUILD_UNVERIFIED_DATA` | I | One or more parts have `dataConfidence != VERIFIED` — shown as a transparency note |

**Total: 45+ rules, against the reference app's 14 — and every physical-fit rule is new.**

### 4.3 Connector satisfaction

Rather than one rule per connector, a single generic check runs over `PartConnector`:

```
for each connectorType T:
    required(T) = Σ over all parts of REQUIRES quantity
    provided(T) = Σ over all parts of PROVIDES quantity
    if required(T) > provided(T):
        emit CONNECTOR_SHORTFALL(T, required, provided)
```
With an adapter table (`PCIE_8PIN ×2 → PCIE_12VHPWR` etc.) that downgrades the error to a warning and adds a "you'll need the included adapter" note.

### 4.4 Engine execution

```
validate(buildState) →
  1. Load all selected parts with specs and connectors (one query)
  2. Load active rules matching the present part types (cached, versioned)
  3. Evaluate each rule → Issue[]
  4. Run the power model (§5) → PowerReport
  5. Run the fit model (dimensional aggregate) → FitReport
  6. Run the balance model (§6) → BalanceReport
  7. Compute compatibilityScore = 100 − (errors×25) − (warnings×5), floored at 0
  8. Attach fixes: for each issue, query candidate parts satisfying the
     inverted constraint, ranked by price proximity and stock
  9. Return { issues, power, fit, balance, score, totals, upgradePaths }
```

Target: **p95 < 300 ms**. Rules and part specs are cached in Redis keyed by `engineVersion`; a rule change bumps the version and invalidates.

**Determinism requirement:** the same build state must always produce the same issue set. The engine is pure — no randomness, no wall-clock dependence, no network calls.

---

## 5. Power model

The reference app computes `CPU TDP + GPU max draw + 100W`. That is wrong in both directions and ignores connectors entirely.

### 5.1 Consumption

| Component | Contribution |
|---|---|
| CPU | `maxTurboPowerWatts` (fall back to `tdpWatts × 1.35` for Intel, `× 1.30` for AMD when unknown) |
| GPU | `tdpWatts` |
| Motherboard | 30 W (ATX) / 25 W (mATX) / 20 W (ITX) |
| RAM | 3 W per stick (DDR4), 5 W (DDR5) |
| NVMe SSD | 7 W each |
| SATA SSD | 3 W each |
| 3.5" HDD | 10 W each |
| Case fan | 3 W each |
| AIO pump | 10 W |
| RGB / peripherals | 15 W flat |
| Expansion card | 15 W each |

`baseLoad = Σ` of the above.

### 5.2 Transient headroom

Modern GPUs spike far above rated draw for microseconds. Ignoring this is the most common cause of a "good" PSU shutting down under load.

```
transientPeak = GPU.transientPeakWatts
              ?? GPU.tdpWatts × (GPU.transientMultiplier ?? 1.8)
peakLoad = baseLoad − GPU.tdpWatts + transientPeak
```

### 5.3 Recommendation

```
efficiencyTarget = 0.60          // aim for ~60% sustained load — the efficiency sweet spot
recommendedWatts = max(
    baseLoad / efficiencyTarget,
    peakLoad × 1.10
)
recommendedWatts = roundUpToStandard(recommendedWatts)   // 450,550,650,750,850,1000,1200,1600
```

### 5.4 Rules produced

| Condition | Severity | Message |
|---|---|---|
| `psu.wattage < peakLoad` | E | "This power supply is too small. Your parts can briefly draw up to {peak} W." |
| `psu.wattage < recommendedWatts` | W | "This will work, but a {recommended} W supply gives safer headroom and runs more efficiently." |
| `psu.wattage > recommendedWatts × 2` | I | "This power supply is much larger than you need — you could save money." |
| `baseLoad / psu.wattage < 0.20` | I | Efficiency note |
| Connector shortfall | E | Per §4.3 |
| Non-ATX-3.0 PSU + high-transient GPU | W | "Modern graphics cards spike hard. An ATX 3.0 supply handles this better." |

### 5.5 Display

The summary panel shows: **estimated typical draw** (baseLoad), **peak draw**, **recommended PSU**, and the **selected PSU with a load bar** — green 40–70%, amber 70–85%, red > 85% or below 20%.

---

## 6. Balance / bottleneck model

The reference app emits a text row. We produce a measurable, explainable figure.

```
cpuScore = cpu.performanceTier (1-10) normalised 0-100
gpuScore = gpu.benchmarkAtResolution(context.targetResolution) normalised 0-100

// Resolution shifts the burden toward the GPU
weight = { FHD: 0.55, QHD: 0.40, UHD: 0.25 }[targetResolution]   // CPU weight

balance = gpuScore − cpuScore        // −100 (CPU-limited) … +100 (GPU-limited)
adjusted = balance × (1 − weight)
```

| `|adjusted|` | Verdict | Presentation |
|---|---|---|
| ≤ 12 | Well matched | Green, no issue |
| 13–25 | Slight imbalance | Info |
| 26–40 | Noticeable | Warning + suggested part change |
| > 40 | Significant | Warning + a specific alternative with the price delta |

Rendered as a **balance meter** — a horizontal gauge with CPU at one end and GPU at the other and a marker showing where this build sits, plus one sentence: *"Your processor will hold back this graphics card at 1080p. Moving to a Ryzen 7 7700 (+रु 12,400) would unlock roughly 15–20% more frames."*

### Estimated performance

For the selected use case, show ranges — never a single fabricated number:

| Use case | Output |
|---|---|
| Gaming | Estimated FPS **range** at the target resolution for 3–5 popular titles, from a curated `gpu_performance_index` table |
| Content creation | Relative rendering-time index vs a named baseline |
| AI/ML | VRAM capacity verdict and the largest model class it comfortably runs |
| Office / programming | Simple qualitative verdict |

> **ASSUMPTION:** FPS figures come from a maintained internal reference table, not live benchmarking. Every estimate MUST carry the caveat "estimated — actual results vary with settings and drivers". Do not present estimates as measurements.

---

## 7. API contracts

### `GET /api/v1/builder/parts`

```
?type=MOTHERBOARD
&buildState=<opaque token or repeated slot=partId params>
&compatibleOnly=true
&filter[brand]=asus,msi
&filter[chipset]=B650,X670
&filter[price][lte]=30000
&availability=in_stock
&sort=-value            // value = performance per rupee
&page=1&perPage=24
```

Response — every row carries its compatibility verdict, so the picker can render disabled rows with a reason instead of hiding them:

```json
{
  "data": [
    {
      "id": "part_...", "partType": "MOTHERBOARD",
      "manufacturer": "MSI", "model": "B650 TOMAHAWK WIFI",
      "image": {...},
      "specHighlights": ["AM5", "B650", "ATX", "DDR5", "4 slots", "2× M.2"],
      "pricePaisa": 2849000,
      "availability": { "status": "IN_STOCK", "branches": ["new-road"] },
      "dataConfidence": "VERIFIED",
      "compatibility": {
        "status": "COMPATIBLE",
        "issues": []
      },
      "valueScore": 78
    },
    {
      "id": "part_...", "model": "B550-A PRO",
      "compatibility": {
        "status": "INCOMPATIBLE",
        "issues": [{ "ruleCode": "CPU_MOBO_SOCKET", "severity": "ERROR",
                     "message": "This board uses AM4. Your Ryzen 7 7800X3D needs AM5." }]
      }
    }
  ],
  "meta": { "pagination": {...}, "facets": {...},
            "compatibleCount": 24, "incompatibleCount": 61 }
}
```

Default `compatibleOnly=true`. A **"Show parts that don't fit"** toggle flips it — the escape hatch that keeps the tool honest without letting users stumble into a broken build.

### `POST /api/v1/builder/validate`

Request: `{ mode, useCase, targetResolution, budgetPaisa?, slots: { cpu: "part_x", ram: {partId, quantity: 2}, ... } }`

Response:
```json
{
  "data": {
    "engineVersion": 7,
    "isComplete": false,
    "canAddToCart": false,
    "compatibilityScore": 50,
    "issues": [
      {
        "ruleCode": "PSU_TOTAL_POWER",
        "severity": "ERROR",
        "slots": ["psu", "gpu", "cpu"],
        "title": "This power supply is too small",
        "message": "Your parts can briefly draw up to 812 W. The 750 W supply you picked may shut down under load.",
        "fixHint": "Choose an 850 W supply or larger.",
        "fixes": [
          { "type": "REPLACE_SLOT", "slot": "psu",
            "partId": "part_...", "model": "Corsair RM850x",
            "pricePaisa": 2290000, "priceDeltaPaisa": 640000 }
        ]
      },
      {
        "ruleCode": "COOLER_RADIATOR_FIT",
        "severity": "ERROR",
        "slots": ["cpu_cooler", "case"],
        "title": "This cooler won't fit in this case",
        "message": "The NZXT Kraken 360 needs space for a 360mm radiator. The Thermaltake Tower 200 supports up to 240mm at the side only.",
        "fixHint": "Choose a 240mm cooler, or a larger case.",
        "fixes": [
          { "type": "REPLACE_SLOT", "slot": "cpu_cooler",
            "partId": "part_...", "model": "NZXT Kraken 240",
            "pricePaisa": 1899000, "priceDeltaPaisa": -700000 },
          { "type": "REPLACE_SLOT", "slot": "case",
            "partId": "part_...", "model": "Lian Li Lancool 216",
            "pricePaisa": 1450000, "priceDeltaPaisa": 320000 }
        ]
      }
    ],
    "power": { "baseLoadWatts": 486, "peakLoadWatts": 812,
               "recommendedPsuWatts": 850, "selectedPsuWatts": 750,
               "loadPercent": 65, "verdict": "UNDERSIZED" },
    "balance": { "cpuScore": 72, "gpuScore": 88, "adjusted": 9.6,
                 "verdict": "WELL_MATCHED",
                 "summary": "Your processor and graphics card are well matched for 1440p." },
    "performance": { "gaming": [{ "title": "Cyberpunk 2077",
                                  "resolution": "QHD", "preset": "High",
                                  "fpsMin": 78, "fpsMax": 96,
                                  "estimated": true }] },
    "totals": { "subtotalPaisa": 24560000, "assemblyPaisa": 350000,
                "totalPaisa": 24910000, "budgetPaisa": 25000000,
                "withinBudget": true },
    "upgradePaths": [
      { "type": "FREE_DIMM_SLOTS", "message": "Two memory slots are free — you can add more RAM later." },
      { "type": "PSU_HEADROOM", "message": "Your power supply has room for a bigger graphics card in future." }
    ],
    "dataQuality": { "unverifiedParts": ["part_..."], "note": "..." }
  }
}
```

### `POST /api/v1/builder/autobuild`

`{ budgetPaisa, useCase, targetResolution, preferences: { brandCpu?, brandGpu?, quiet?, rgb?, smallForm? } }`

Algorithm:
1. Choose a budget allocation profile by use case (see §8).
2. Select the GPU first for gaming/3D, or the CPU first for productivity/AI — the anchor part.
3. Greedily fill remaining slots at the allocated budget, ranked by `valueScore`, filtered to in-stock.
4. **Run the full validator.** If any error → backtrack on the cheapest slot that resolves it.
5. Iterate up to 20 times; if unresolved, return the closest valid build plus an explanation of what the budget could not accommodate.
6. Redistribute leftover budget to the anchor part, then storage, then cooling.

**Hard requirement:** an auto-build MUST pass validation with zero errors before being returned. The reference app returns builds it has not checked (a 420 mm AIO with a case that cannot mount it). Ours does not ship an invalid suggestion.

### Other endpoints

| Endpoint | Notes |
|---|---|
| `POST /builder/recommend` | Given a partial build and a slot, return the top 3 with reasoning: RECOMMENDED / BEST_VALUE / PREMIUM |
| `POST /builder/builds` | Save. Returns `shortId`. Anonymous allowed. |
| `PATCH /builder/builds/{shortId}` | Owner or session token. Creates a `BuildRevision`. |
| `POST /builder/builds/{shortId}/clone` | Copy into the current session |
| `GET /builder/builds/{shortId}/pdf` | Branded quotation with the assembly journey (adopting the reference app's best idea) |
| `POST /builder/compare` | 2–4 builds side by side: totals, power, balance, per-slot diff |
| `POST /builder/import` | Paste text → fuzzy match to parts. Returns `matched[]`, `ambiguous[]`, `unmatched[]` — **never silently fills a slot the user didn't name.** |

---

## 8. Budget allocation profiles

Starting points, adjusted by the solver. Percentages of the parts budget (assembly and OS excluded).

| Use case | CPU | GPU | Mobo | RAM | Storage | PSU | Cooler | Case |
|---|---|---|---|---|---|---|---|---|
| Gaming (FHD) | 22 | 32 | 11 | 10 | 10 | 7 | 4 | 4 |
| Gaming (QHD/UHD) | 18 | 40 | 10 | 9 | 9 | 7 | 4 | 3 |
| Content creation | 26 | 24 | 11 | 14 | 13 | 6 | 3 | 3 |
| 3D rendering | 22 | 33 | 10 | 13 | 10 | 6 | 3 | 3 |
| Streaming | 24 | 28 | 11 | 12 | 11 | 6 | 4 | 4 |
| Programming | 30 | 12 | 13 | 18 | 15 | 6 | 3 | 3 |
| AI / ML | 20 | 42 | 9 | 12 | 8 | 6 | 2 | 1 |
| Office | 34 | 0 | 16 | 16 | 20 | 8 | 3 | 3 |

Adjustments: `quiet` +3% cooler/case, `smallForm` +4% case and constrains form factor, existing-monitor +0% (monitor excluded entirely).

---

## 9. UX specification

### Modes

| Mode | Audience | Shape |
|---|---|---|
| **Guided** | First-time builders | 6 questions in plain language → a complete validated build → review and swap. "What will you use it for?" not "Select a socket". |
| **Standard** | Most users | 10-step rail matching the approved design. Budget sidebar. Each step pre-filtered by prior choices. |
| **Expert** | Enthusiasts | Flat slot grid, all slots open, no gating, full filters and comparison. |

Mode is switchable at any time without losing the build.

### Prevention affordances

| Situation | Treatment |
|---|---|
| Part incompatible with the current build | Row is **visible but disabled**, greyed, with a short reason inline and a "why?" tooltip |
| "Show parts that don't fit" toggled on | Rows become selectable but carry a persistent red badge; selecting one raises the error immediately |
| Slot blocked by a missing prerequisite | Slot shows "Pick a processor first" rather than an empty list |
| Part goes out of stock mid-build | Amber banner on the slot with ETA and one-tap substitute |

### Issue presentation

Three surfaces, consistent with the approved design:
1. **Per-slot badge** — green check "Fits", amber "Check this", red "Won't work".
2. **Summary panel** — compatibility score, power meter, balance meter, issue count.
3. **Issue list** — grouped by severity, each row expandable into a **Fix drawer** listing candidate parts with price deltas.

Copy is plain language. Never a rule code, never a spec key, never "constraint violation".

### Part picker

Fixes every defect observed in the reference app: a drawer (not a dropdown), virtualised (a 513-row case list must not lag), with thumbnails, a spec column set per part type, debounced tokenised fuzzy search, faceted filters, sort including performance-per-rupee, a 2–4 way compare, stock status, and full keyboard + ARIA support.

### Mobile

The approved design has no mobile builder. Required:
- Horizontal scrollable step bar replacing the vertical rail.
- Slot cards full width, stacked.
- **Sticky bottom bar**: total, power, compatibility status, and "Review" — expanding into a sheet.
- Part picker is a full-screen sheet.
- Filters in a nested sheet.

### Persistence

| Behaviour | Detail |
|---|---|
| Autosave | Debounced 2 s to `localStorage`, and server-side every 30 s for logged-in users |
| Resume | On return, "Continue your build?" with a preview |
| Save | Named, listed under `/account/builds` |
| Share | `/build/{shortId}` — **`noindex,follow` by default** (`11 §4.11`). Structured data is emitted for social and AI unfurling. An owner-curated build is promoted to `/prebuilt` as a real `Product` with its own indexable page. |
| Revisions | Every save creates a `BuildRevision`; "what changed" diff available |
| Print | Dedicated print stylesheet |
| Export | PDF quotation, and JSON for the technically inclined |

### Shared build page

Public and shareable (`noindex,follow` by default — see `11 §4.11`), showing: parts with images and specs, price **then** (snapshot) vs **now**, compatibility verdict, power and balance, "Clone this build", "Add to cart", and the builder's name if they chose to show it. Owner-curated builds are promoted to `/prebuilt` as indexable products — that is where the organic value is captured, without the index bloat of thousands of near-duplicate user configurations.

---

## 10. Admin surface

| Screen | Purpose |
|---|---|
| **Buildable Parts** | List, filter by type and confidence, edit specs through a type-specific form (never raw JSON), bulk import from CSV/XLSX with a validation report, mark `VERIFIED` |
| **Build Rules** | List rules in plain language ("Processor and motherboard must use the same socket"), toggle active, adjust severity, edit the message. Advanced expression editing is behind a clearly-marked technical section. |
| **Rule Tester** | Pick sample parts, run the engine, see what fires. **Mandatory before a rule can be activated.** |
| **Customer Builds** | Browse saved builds, see funnel drop-off, convert a build into a phone quote |
| **Build Templates** | Curate presets and prebuilt SKUs |
| **Data Quality** | Parts with `UNVERIFIED` confidence, parts missing dimensions, parts not price-checked in 30 days |

---

## 11. Data sourcing and quality

| Aspect | Approach |
|---|---|
| Initial dataset | Manually authored for stocked parts; a curated seed for common parts not yet stocked |
| Import | CSV/XLSX with a strict per-type column schema. Rows failing Zod validation go to a review queue — **never coerced**. |
| Confidence | `VERIFIED` (a human checked the spec sheet) · `INFERRED` (derived from a trusted source) · `UNVERIFIED` (imported, unchecked) |
| Blocking | Only `VERIFIED` parts may trigger `ERROR` rules. Others degrade to `WARNING` with a transparency note. |
| Freshness | A job flags parts whose price or specs have not been reviewed in 30 days |
| Dimensions | A part missing `lengthMm`/`heightMm` cannot participate in fit rules; the UI says "we don't have the dimensions for this part yet" rather than falsely passing it |

> **RISK:** high. Component spec data is the single biggest ongoing cost of this feature. Mitigation: start with a narrow catalogue (the parts actually stocked), require `VERIFIED` before a part appears in the builder, and treat the review queue as a real operational task with an owner.

---

## 12. Testing requirements

| Type | Requirement |
|---|---|
| Unit | Every rule has ≥ 2 tests: one that fires, one that does not. Every power-model branch. Every balance band. |
| Golden builds | A fixture set of ~40 known-good and known-bad builds with expected issue sets, asserted on every commit. **Includes the exact invalid build the reference app accepted** (mATX board + 420 mm AIO + RTX 5090 in a Mini-ITX case) — it must produce at least 3 errors. |
| Property | Random valid builds never produce errors; random invalid builds always produce ≥ 1. |
| Determinism | Same input → same output, 1,000 iterations. |
| Performance | Validation p95 < 300 ms with the full rule set (45+) and a 12-slot build. Picker query p95 < 200 ms over 5,000 parts. |
| E2E | Complete a Guided build end-to-end; complete a Standard build; hit a compatibility error and resolve it via the Fix drawer; save, share, open the share link in a fresh session, clone, and add to cart. |
| Accessibility | Picker keyboard-navigable; issues announced via a live region. |

**Definition of done:** it is impossible, through the UI with `compatibleOnly` on, to add a build to the cart that a competent technician would refuse to assemble.
