# Evidence-Based User Persona Research: Fuel Subsidy Administration for Philippine Paratransit (TAPat)

**Geographic Scope:** Philippines (Primary: Metro Manila / National Capital Region; Supporting: Luzon, Visayas, Mindanao)  

## Introduction

### Why Identifying the Target User Matters
In public assistance programs, technical sophistication is meaningless if the delivery rail conflicts with the daily realities of its beneficiaries. Fuel subsidy programs in the Philippines are often designed around assumptions of formal bank accounts, constant smartphone connectivity, and bureaucratic patience. In reality, informal paratransit workers operate under razor-thin cash margins where a day spent in an administrative queue directly threatens household food security. Grounding our solution in an evidence-based persona ensures that technical architecture decisions—such as utilizing offline-capable Near Field Communication (NFC) cards over app-based digital wallets—solve real friction points rather than introducing new barriers.

### Research That Informed the Persona
The user persona was developed by synthesizing:
1. **Official State Audits and Program Data:** Commission on Audit (COA) Annual Audit Reports on Department of Transportation (DOTr) and Land Transportation Franchising and Regulatory Board (LTFRB) fuel subsidies; Department of Social Welfare and Development (DSWD) congressional testimonies; and Bangko Sentral ng Pilipinas (BSP) Financial Inclusion Surveys.
2. **Institutional Paratransit Studies:** Empirical research from the University of the Philippines National Center for Transportation Studies (UP NCTS), the Philippine Institute for Development Studies (PIDS), and Asian Development Bank (ADB) technical transport reports.
3. **Local Municipal Realities:** Local Government Unit (LGU) program data from the Quezon City Transport and Traffic Management Department (TTMD), field evaluations of the joint BSP-DILG *Paleng-QR Ph Plus* initiative, and recent 2024–2026 regional fuel subsidy rollouts across Luzon, the Visayas (Iloilo, Cebu), and Mindanao (Cagayan de Oro, Davao).

### Why the Selected Persona is Relevant to the Proposed Solution
The primary persona represents **Danilo "Mang Danny" Santos**, a 44-year-old non-owner tricycle driver in Metro Manila operating under the rental "boundary system." Mang Danny directly bears the full risk of volatile petroleum price spikes while earning a net take-home pay of only ₱300 to ₱500 per 12-hour shift. He encapsulates the documented failure modes of current aid delivery: exclusion due to minor clerical errors on municipal rosters, inability to afford continuous mobile data or maintain complex apps, and the economic penalty of forfeiting a day's wage in heat-exposed payout queues. TAPat's **Fund, Refuse, and Return** architecture directly resolves Mang Danny's operational barriers through automated price-shock escrows, zero-data NFC tap-to-pay at gas stations, and 1-minute field enrollment.

---

## 1. Project Overview

TAPat is an agentic, policy-controlled fuel-subsidy disbursement and reconciliation platform designed for Philippine Local Government Units (LGUs) and paratransit associations—specifically Tricycle Operators and Drivers Associations (TODAs). Built on the Stellar blockchain (Testnet), TAPat coordinates smart contracts deployed via Soroban (`device_registry`, `agent_registry`, and `payment_escrow` from the Noir protocol) alongside the Velo SDK to implement an automated **Fund, Refuse, and Return** lifecycle:

1. **Fund:** Autonomous price-monitoring agents (Bayesian Online Changepoint Detection - BOCPD) evaluate Department of Energy (DOE) petroleum price series, releasing targeted ₱1,500 fuel escrows per enrolled card only when fuel price shifts are sustained and confirmed within a Velo-verified LGU budget.
2. **Refuse:** Contactless Near Field Communication (NFC) cards allow drivers to tap and pay at fuel station Android terminals. Spending policies enforced directly on-chain cap individual transactions at ₱500, reject expired or unauthorized attempts, and automatically pause rogue or colluding stations using graph anomaly scoring (MIDAS-F streaming Count-Min Sketch).
3. **Return:** When the program period concludes, unspent card balances are programmatically swept back to the LGU's municipal treasury wallet on the same day, producing a cryptographic, transaction-hashed ledger that satisfies Commission on Audit (COA) transparency requirements.

### The Real-World Problem Addressed
Public transport fuel subsidies in the Philippines have historically been trapped in a destructive policy trade-off: **safe and slow, or fast and leaky**. When subsidies are disbursed rapidly as unconditional lump-sum cash, municipal and national registries suffer massive leakages to duplicate records and "ghost" beneficiaries. Conversely, when agencies institute stringent manual controls to prevent fraud, the administrative machinery grinds to a halt: hundreds of thousands of drivers are forced to wait months for aid, queue for hours under dangerous heat conditions, or lose their entitlements entirely due to administrative data errors and unliquidated bank returns.

TAPat replaces this broken manual apparatus with cryptographic spending policies, automated algorithmic screening, and low-barrier NFC tap payments.

---

## 2. Research Scope and Methodology

### 2.1 Geographic and Demographic Scope
- **Primary Geographic Focus:** **Metro Manila (National Capital Region - NCR)**. As the country's most densely populated urban agglomeration, Metro Manila represents the acute epicenter of transport congestion, high cost-of-living pressures, paratransit dependence, and municipal fuel subsidy experimentation (e.g., Quezon City, Manila, Pasay, Makati, Caloocan).
- **Supporting Geographical Context:**
  - **Luzon (Non-NCR):** Highlighting provinces in Central Luzon (Region III) and CALABARZON (Region IV-A), which harbor the highest statistical concentrations of registered motorized tricycles in the country and feature inter-municipal, long-route paratransit dynamics.
  - **Visayas:** Examining urban centers such as Iloilo City, Bacolod City, and Metro Cebu (Cebu City, Lapu-Lapu City), focusing on recent localized cash relief rollouts and the operational interplay between motorized tricycles and non-motorized pedal-trikes (*trisikads*).
  - **Mindanao:** Analyzing major gateways including Cagayan de Oro City (Northern Mindanao / Region X) and Davao City (Davao Region / Region XI), accounting for specialized local vehicle typologies (e.g., the 6-to-8 passenger *motorela*), local franchising divisions, and regional digital inclusion challenges.

### 2.2 Research Methodology and Evidence Hierarchy
This research was conducted under strict anti-hallucination protocols. Every quantitative metric, operational condition, and demographic attribute is grounded in verifiable evidence:
1. **Primary Government Records and Datasets:** Commission on Audit (COA) Annual Audit Reports; Bangko Sentral ng Pilipinas (BSP) Financial Inclusion Surveys (FIS); Philippine Statistics Authority (PSA) releases; Department of Energy (DOE) Oil Industry Management Bureau price monitors; and official LGU municipal transport registries.
2. **Institutional Transport Research:** Publications from the University of the Philippines National Center for Transportation Studies (UP NCTS), the Philippine Institute for Development Studies (PIDS), and the Asian Development Bank (ADB).
3. **Documented Administrative Precedents:** Official program documentation and press releases from the Department of Transportation (DOTr), Land Transportation Franchising and Regulatory Board (LTFRB), Department of Social Welfare and Development (DSWD), and Department of the Interior and Local Government (DILG).
4. **Distinction of Claims:**
   - **Verified Fact:** Directly extracted from cited government reports, statistical surveys, or official legislative testimonies.
   - **Research-Based Interpretation:** Logical deductions synthesizing transport economics, paratransit operational realities, and administrative workflows.
   - **Product Hypothesis:** Proposed capabilities within TAPat designed to solve documented empirical deficiencies.

---

## 3. Philippine Context

### 3.1 Metro Manila (Primary Focus)
Metro Manila's transport ecosystem is defined by a multi-tiered hierarchy. While mass transit lines (LRT-1, LRT-2, MRT-3, and the EDSA Busway) service primary arterial corridors, motorized tricycles serve as the **essential first-and-last-mile circulatory system**. Tricycles bridge the gap between high-capacity avenues and dense interior residential communities, public markets, schools, and informal settlements.

Key operational characteristics in Metro Manila include:
- **Franchising and Zoning:** Under Republic Act No. 7160 (Local Government Code of 1991), franchising authority over tricycles is decentralized to local city councils and managed via Motorized Tricycle Operator’s Permits (MTOP). In Metro Manila, strict limits are placed on routes; tricycles are prohibited by DILG directives from plying national highways, forcing them into short, stop-and-go neighborhood routes.
- **Municipal Scale:** Cities operate extensive paratransit networks. In Quezon City alone, the local government distributed **12,073 fleet cards** to registered TODA members across six legislative districts (Quezon City TTMD, 2025).
- **Economic Pressure & Boundary System:** Urban drivers in Metro Manila face fierce competition from colorum (unregistered) operators, high cost of living, and mandatory daily boundary (rental) payments paid to unit owners, leaving them exceptionally exposed to pump price swings.
- **Microclimate and Health Vulnerabilities:** Metro Manila suffers severe urban heat island effects. During the dry season (March–May), heat index ratings consistently exceed danger levels (38°C to 44°C). When municipal assistance programs demand personal appearance at open covered courts, drivers face physical collapse and heat exhaustion.

### 3.2 Luzon (Supporting Context: Central Luzon and CALABARZON)
Beyond the capital, Central Luzon (Region III) and CALABARZON (Region IV-A) represent the largest aggregate paratransit markets in the Philippines.
- **Fleet Volume:** Land Transportation Office (LTO) historical data indicates that Region III holds the highest volume of registered tricycles in the country, with approximately **283,000 units** (LTO / Statista baseline).
- **Route Topography:** In peri-urban and agricultural municipalities (e.g., Bulacan, Pampanga, Batangas, Cavite), tricycles operate over significantly longer route distances (often 5 to 15 kilometers between municipal centers and rural barangays) compared to Metro Manila's 1-to-3 kilometer trips. Consequently, fuel consumption per unit shift is substantially higher, accelerating the depletion of operating cash.
- **Mixed Livelihood Subsidies:** Municipalities frequently run hybrid assistance programs. For example, in Rosario, Cavite, municipal fuel subsidies were simultaneously distributed to 2,429 tricycle drivers and small fisherfolk (Manila Bulletin, April 2026), demonstrating that LGUs require flexible subsidy frameworks capable of handling varied transport and livelihood categories.

### 3.3 Visayas (Supporting Context: Western and Central Visayas)
In the Visayas region, urban hubs like Iloilo City and Metro Cebu exhibit a combination of motorized tricycles, multi-cabs, and pedal-powered *trisikads*:
- **Targeted Cash Aid Execution:** In April 2026, the DSWD Regional Field Office VI rolled out ₱5,000 Cash Relief Assistance (CRA) payouts for tricycle drivers across sports complexes in Iloilo City (including MH del Pilar Gym in Jaro and La Paz Gym), while the Iloilo City Government simultaneously issued localized fuel coupons (Philippine Information Agency, April 2026).
- **Central Visayas Hubs:** In Metro Cebu, large-scale subsidy distributions at sites like the Lapu-Lapu City Auditorium Gym served thousands of tricycle drivers navigating dense urban and island routes.
- **Operational Chokepoint:** Across both regions, local governments relied heavily on physical queuing and manual validation of paper franchise permits, creating administrative bottlenecks and service interruptions for commuters while drivers attended distribution sites.

### 3.4 Mindanao (Supporting Context: Northern Mindanao and Davao Region)
In Mindanao, paratransit exhibits distinctive vehicular typologies and administrative setups:
- **The Motorela in Northern Mindanao:** In Cagayan de Oro City and surrounding cities (El Salvador, Gingoog, Malaybalay, Valencia, Ozamiz), the dominant local transport vehicle is the *motorela*—a locally fabricated mini-carriage mounted on a motorcycle chassis carrying 6 to 8 passengers. In April 2026, DSWD Region X distributed ₱5,000 cash grants to thousands of tricycle and motorela drivers under the Assistance to Individuals in Crisis Situations (AICS) program (Inquirer, April 2026).
- **Davao City Municipal Franchising:** In Davao City, fuel subsidies are tightly coordinated through the City Transport and Traffic Management Office (CTTMO) and its Motorized Vehicle Franchising and Regulatory Division (MVFRD), enforcing rigorous pre-validation against active MTOP databases (Davao City Government, April 2026).
- **Connectivity Deficits:** Mindanao paratransit operators experience higher rates of unbanked status and poorer cellular data coverage in outlying districts, making app-only digital solutions unviable and reinforcing the need for low-infrastructure hardware redemption mechanisms.

---

## 4. Research Findings and Supporting Evidence

### 4.1 Demographic and Economic Profile of Tricycle Drivers

| Parameter | Verified Finding / Metric | Credible Source |
|---|---|---|
| **Workforce Gender & Age** | Over 90%–95% male; predominantly working age between 25 and 55 years old, with strong clustering in the **30 to 45 age bracket**; significant presence of older drivers (>50 years) relying on driving as an informal pension substitute. | UP Diliman / National Center for Transportation Studies (UP NCTS); Academic TODA surveys (IJRP, 2023) |
| **Educational Attainment** | High school level (complete or incomplete); limited tertiary education; high structural barriers to formal employment. | UP NCTS; PIDS Discussion Papers on Informal Labor |
| **Daily Gross Revenue** | **₱500 to ₱1,200** per 10–14 hour working shift, depending on passenger traffic density, weather, and peak school/office hours. | LTO / LTFRB Public Transport Studies; Asian Development Bank (ADB) |
| **Fuel Overhead Proportion** | **20% to 40%** of gross daily earnings (₱150 to ₱350+ per shift) is consumed purely by fuel costs; during international price surges, fuel overhead exceeds 45%. | Asian Development Bank (ADB); PIA Transport Sector Monitoring |
| **The Boundary (Rental) Burden** | A substantial proportion of drivers do not own their tricycles. They operate under the "boundary system," paying a fixed rental fee of **₱150 to ₱300 daily** to the fleet operator regardless of daily passenger volume. | ADB Sustainable Transport Reports; Philippine Labor Code Paratransit Case Studies |
| **Net Daily Take-Home Pay** | **₱300 to ₱600** daily after deducting fuel, boundary, and mandatory TODA terminal fees. Any unexpected pump price increase directly reduces food on the family table. | UP NCTS; Socioeconomic Profiles of Paratransit Operators (IJRP) |

### 4.2 Petroleum Price Dynamics in the Philippines
Philippine domestic pump prices are deregulated (Downstream Oil Industry Deregulation Act of 1998 / RA 8479) and exhibit volatile weekly fluctuations tracked by the Department of Energy (DOE) Oil Industry Management Bureau (OIMB). 
- In Metro Manila, common retail gasoline pump prices regularly fluctuate within the **₱65.00 to ₱88.00+ per liter** range, driven by Middle East geopolitical risks, Singapore MOPS (Mean of Platts Singapore) benchmark shifts, and peso-to-dollar exchange rate depreciation (DOE OIMB Weekly Price Monitors; Philstar, November 2026).
- Because tricycles operate small fuel tanks (typically 4 to 10 liters), drivers purchase fuel on a daily, cash-settled basis. A sudden increase of ₱2.50 to ₱3.50 per liter absorbs ₱25 to ₱35 of net daily margin—equivalent to the cost of a kilogram of subsidized NFA rice for their household.

### 4.3 Failures and Vulnerabilities in Existing Government Aid Programs

#### A. Massive Ghost Registries vs. Cash Leakage Risk (₱2.7 Billion)
When national relief programs attempted to disburse cash aid digitally without field validation, registry corruption became apparent. In congressional budget hearings, Department of Social Welfare and Development (DSWD) Secretary Rex Gatchalian testified that external lists submitted for transport and delivery driver assistance were rife with manipulated identities, altered names, and hundreds of thousands of duplicate and triplicate entries (Manila Bulletin, September 2024; DZRH News). DSWD revealed that disbursing funds directly through unvalidated e-wallets would have resulted in **₱2.7 billion leaking out to "ghost drivers" and fraudulent accounts**.

#### B. Audit Disallowance and Reverted Subsidies (₱709.88 Million)
The Commission on Audit (COA) Annual Audit Report on the DOTr/LTFRB revealed that **₱709.88 million** in public utility vehicle fuel subsidies failed to reach intended beneficiaries and expired or were returned to the National Treasury (COA AAR; GMA News Online; ASTIG.ph). 
- State auditors discovered that **₱179.96 million** had been processed but was never credited to beneficiaries due to transaction rejections by Land Bank of the Philippines and partner fintechs arising from erroneous beneficiary data (mismatched names, incorrect birthdays, or invalid account details). 
- **Tricycle drivers bore the largest share of this failure, accounting for approximately ₱120 million in rejected, uncredited aid** (COA Report / ASTIG.ph).

#### C. The Human Toll of Manual Payouts: Heat Exhaustion and Lost Wages
To prevent the ₱2.7 billion ghost leakage, the government reverted to manual, physical payouts at local municipal covered courts and sports centers (Daily Tribune; DSWD). This decision imposed extreme physical hardship:
- Thousands of drivers lined up starting at 4:00 AM to secure queue numbers.
- Drivers waited 6 to 10 hours in heat-exposed queues with heat index readings reaching 40°C+, leading to documented incidents where elderly and exhausted drivers **fainted and suffered severe heat exhaustion** (Daily Tribune; ABS-CBN News).
- Crucially, queuing for an entire day forced drivers to forfeit their daily earnings (an immediate loss of ₱400–₱600 in net income), creating an economic penalty just to collect their government assistance.

### 4.4 Technological and Financial Inclusion Realities

#### A. The Unbanked Baseline and E-Wallet Friction
According to the Bangko Sentral ng Pilipinas (BSP) Financial Inclusion Survey, e-money account ownership has grown to 36% of adults, significantly outpacing traditional formal bank accounts (23%). However, financial exclusion remains concentrated in the informal labor sector. 
- In the DSWD's UPLIFT social protection program, the agency documented that **only approximately 20% of eligible transport and informal beneficiaries owned verified, active e-wallets or bank accounts** (DSWD / Manila Bulletin). The remaining 80% possessed no formal financial rails.
- Drivers who do own mobile e-wallets (e.g., GCash or Maya) face steep **cash-out friction**. Converting virtual balances to physical cash requires visiting convenience stores or remittance agents that charge ₱10 to ₱20 per ₱1,000 withdrawn, eroding the net value of the subsidy.

#### B. Smartphone, Mobile Data, and Literacy Barriers (Paleng-QR Ph Studies)
Field research evaluating the BSP-DILG **Paleng-QR Ph Plus** initiative across Philippine public markets and tricycle terminals (UP Diliman; RSIS International, 2024) reveals critical operational roadblocks:
- **Cellular Data Costs:** Drivers operate on prepaid cellular plans and do not maintain active mobile data connections while driving. Expecting a driver to load mobile data simply to receive a fare or check a subsidy balance imposes an unacceptable recurring operational cost.
- **Hardware Fragility & Glare:** Utilizing smartphones at outdoor fuel stations exposes devices to rain, mechanical vibration on rough roads, theft, and blinding sunlight glare that prevents QR camera scanning.
- **Digital Literacy:** Older drivers (ages 45–60+) experience anxiety surrounding complex mobile app interfaces, software updates, and fears of fraudulent fund transfers or phishing scams.
- **The Power of Contactless NFC:** Conversely, physical NFC cards/tags require no battery, no mobile data, no screen interaction, and no user technical literacy. The driver simply taps the card against the fuel station's Android phone terminal.

---

## 5. Primary User Persona

### 5.1 Persona Overview and Segment Definition
While an LGU fuel subsidy system involves multiple administrative and commercial stakeholders (LGU program officers, TODA presidents, and fuel station attendants), the **ultimate success or failure of the program hinges on the end-beneficiary: the Tricycle Operator-Driver**. If the subsidy redemption instrument is too complex, demands expensive mobile data, requires grueling manual queues, or fails at the pump, the entire program collapses.

Therefore, the **Tricycle Operator-Driver** is designated as the **Primary User Persona**.

```
+-----------------------------------------------------------------------------------+
|                           PRIMARY USER PERSONA PROFILE                            |
+-----------------------------------------------------------------------------------+
|  Name: Danilo "Mang Danny" Santos                                                 |
|  Age: 44 years old                                                                |
|  Civil Status: Married, 3 dependent children (Ages 9, 14, 18)                     |
|  Location: Brgy. San Roque, District II, Quezon City, Metro Manila               |
|  Occupation: Motorized Tricycle Driver (San Roque TODA Member)                     |
|  Vehicle Ownership: Non-owner (Operates under daily boundary rental)              |
|  Working Hours: 5:30 AM - 6:30 PM (13-hour shift, 6 days/week)                   |
+-----------------------------------------------------------------------------------+
```

*(Note: "Danilo 'Mang Danny' Santos" is a representative fictional name utilized solely for human-centered identification, synthesized from verified demographic and empirical transport data).*

---

### 5.2 Demographic and Occupational Profile
- **Age:** 44 years old.
- **Location:** Resides in a dense informal/semi-formal community in Barangay San Roque, District II, Quezon City, Metro Manila. Plying intra-city secondary roads connecting housing areas to Commonwealth Avenue and local commercial markets.
- **Education:** High school graduate (public secondary school in Pangasinan, migrated to Metro Manila in 2008).
- **Employment Model:** Active member of the San Roque Tricycle Operators and Drivers Association (TODA). Drives a 2018 four-stroke 125cc motorcycle with sidecar under a fixed **daily boundary fee of ₱250.00** payable to the unit owner every evening.

### 5.3 Daily Financial Mechanics
- **Gross Shift Revenue:** ₱850.00 (averaging 35 to 45 short passenger trips at ₱15–₱30 per head).
- **Daily Fixed Deductions:**
  - Boundary Fee: -₱250.00
  - Fuel Consumption (Gasoline, ~4.2 Liters @ ₱68.50/L): -₱287.70 (33.8% of gross revenue)
  - TODA Terminal & Parking Dues: -₱30.00
- **Net Daily Take-Home Income:** **₱282.30 to ₱350.00**.
- **Household Context:** His spouse operates a home-based mini *sari-sari* stall earning ~₱150/day. The combined household income (~₱450/day) hovers right at the poverty threshold for a family of five in Metro Manila. Any ₱3.00/liter jump in gasoline prices instantly cuts his daily grocery budget by 10%.

### 5.4 Goals and Motivations
1. **Stabilize Daily Net Take-Home Pay:** Protect his daily ₱300–₱400 take-home income from being cannibalized by sudden, unpredictable weekly fuel price hikes.
2. **Eliminate Livelihood Disruption:** Receive government fuel assistance without having to sacrifice a full day's work (and lose ₱300+ in income) standing in administrative payout queues.
3. **Transparent Balance Tracking:** Know exactly how much fuel aid balance remains without dealing with opaque bureaucracy, hidden deductions, or expired credits.
4. **Secure Household Essentials:** Ensure that cash saved from fuel expenses is reliably diverted to his children's daily public school allowances (*baon*) and basic food staples.

### 5.5 Critical Pain Points (Backed by Research)
1. **Extreme Fuel Vulnerability:** Fuel is his largest volatile overhead. When pump prices increase, local city fare matrices remain frozen by law; he cannot unilaterally raise passenger fares without risking LGU sanctions and passenger disputes.
2. **The "Subsidy Queue Penalty":** During the previous national fuel cash distribution, Mang Danny spent 8 hours standing in an unshaded gymnasium under 39°C heat. He suffered dehydration, lost his entire day's earnings, only to be told that his name was misspelled on the municipal masterlist and had to be verified.
3. **Data Rejection in Bank Transfers:** He has never had a formal bank account. When previous transport subsidies were funneled through digital banking rails, his record was part of the ₱120 million in tricycle subsidies rejected by Landbank due to a typographic error in his middle name.
4. **Mobile Data and Technology Stress:** He does not have continuous mobile data. Solutions requiring him to install an app, enter OTPs, or scan digital QR codes on the road fail whenever his prepaid load expires or network coverage drops.

### 5.6 Technology Access, Adoption, and Limitations
- **Hardware:** Owns a four-year-old entry-level Android smartphone (2GB RAM, Android 10, cracked screen). The battery drains rapidly after 4 hours of outdoor use.
- **Connectivity:** Prepaid cellular SIM. Loads small "sachet" data promos (e.g., ₱20 for 1GB valid for 1 day) exclusively when necessary; operates on zero-data balance while driving. Relies on free barangay Wi-Fi or home connectivity at night.
- **Financial Applications:** Has an unverified/basic GCash account utilized occasionally to receive remittances from a sibling in the province, but keeps zero balance to avoid cash-out fees. Operates 99% in physical cash (*barya*).
- **Communication Channels:** Highly responsive to standard SMS text messages and Facebook Messenger. Infrequent user of Telegram, but family members assist him with digital links when clearly instructed.

---

### 5.7 Secondary Stakeholder Personas in the Ecosystem

To ensure comprehensive systems coverage, two supporting operational personas interact directly with Mang Danny:

#### Secondary Persona: The Administrative Buyer (LGU Program Officer)
- **Representative Identity:** **Engr. Marites "Tess" Reyes**, 38, Assistant Head of the City Transport and Traffic Management Department (TTMD) / Tricycle Regulation Division.
- **Environment:** Responsible for managing 12,000+ MTOP franchises across the city. Operates under intense pressure from the Mayor's office during oil crises.
- **Pain Points:** 
  - Overwhelmed by messy, duplicate-filled Excel and paper masterlists submitted by 50+ different TODA chapters.
  - Terrified of Commission on Audit (COA) disallowances or notices of suspension resulting from duplicate payments or unverified ghost beneficiaries.
  - Lacks technical data science staff to perform manual deduplication or algorithmic fraud detection.
- **Needs:** Automated intake screening (conformal risk control to approve high-confidence records and isolate uncertain entries); real-time visibility over spent vs. unspent funds; instant programmatic return of unspent balances; and 1-click COA audit export with blockchain transaction hashes.

#### Tertiary Persona: The Merchant Terminal Operator (Gas Station Attendant)
- **Representative Identity:** **Ronaldo "Kuya Ron" Cruz**, 29, Pump Attendant at a participating city gasoline station (e.g., Petron San Roque).
- **Environment:** High-stress, fast-moving service station lane serving 150+ motorbikes and tricycles per shift.
- **Pain Points:** 
  - Cannot tolerate slow checkout workflows; cannot wait 60 seconds for a driver to open an e-wallet, find cell signal, and scan a QR code while other vehicles queue behind him.
  - Worried about cash shortages or disputes if a paper coupon is counterfeit or rejected during weekly station reimbursement.
- **Needs:** A 3-second contactless tap; immediate on-screen approval or denial with clear, indisputable reason codes (e.g., "Over Cap", "Expired"); zero personal financial risk; and automatic batch settlement without handling paper vouchers.

---

## 6. User Pain Points and Needs

The following matrix connects empirical research findings to specific user pain points, operational needs, and their direct impact on paratransit livelihoods:

| Documented Empirical Evidence | User Pain Point | User Need / Requirement | Impact on Livelihood |
|---|---|---|---|
| **COA Report on DOTr Subsidies:** ₱179.96M processed but rejected by banks due to typographic name errors (₱120M belonging to tricycle drivers). | **Subsidy Exclusion via Data Mismatch:** Legitimate drivers are denied aid due to simple clerical errors on municipal rosters. | **Zero-Friction Identity Resolution:** A system that separates clear approvals from uncertain matches, allowing quick appeal with a single document. | Driver is completely excluded from ₱5,000 in fuel relief despite holding a valid franchise, driving him into debt. |
| **DSWD ₱2.7B Ghost Leakage & Payout Queues:** Drivers fainted and suffered heat exhaustion in 8-hour manual verification queues. | **The "Queue Penalty":** Drivers lose an entire day's gross earnings (₱800+) standing under dangerous heat to claim cash assistance. | **Rapid, Decentralized Enrollment:** A 1-minute field enrollment process at the local TODA terminal without municipal hall queues. | Sacrifices daily food budget; risks medical emergencies from extreme urban heat index (38°C–44°C). |
| **ADB & UP NCTS Studies:** Fuel consumes 20%–40% of daily gross income; boundary fees are fixed; fare increases are legally restricted. | **Pump Price Squeeze:** Unpredictable weekly fuel price spikes immediately cannibalize net income with no mechanism for rapid fare relief. | **Automated Price-Triggered Relief:** Fuel tranches released automatically when pump prices experience sustained upward shifts. | Daily take-home income drops below subsistence levels (under ₱300/day), forcing reliance on 20% high-interest "5-6" lenders. |
| **Paleng-QR Ph Studies:** Prepaid data load costs ₱20–₱50; weak cellular connectivity disrupts digital transactions; drivers fear phone damage. | **Digital Payment Barrier:** App-based e-wallets require active mobile data, smartphone battery, and digital literacy that drivers lack. | **Zero-Data Hardware Interface:** Contactless NFC card tap that requires no smartphone, no app, and no cellular data from the driver. | Driver abandons digital assistance programs entirely if they require continuous smartphone data or technical proficiency. |
| **COA Audit Disallowance Risks:** Unspent subsidies (₱709.88M) trapped in limbo for two years before reverting to the National Treasury. | **Opaque Balance Tracking:** Drivers do not know when their subsidy expires; unspent aid is abruptly frozen or reclaimed without notice. | **Transparent Programmable Expiry:** Explicit transaction receipts and deterministic sweep-back of unspent funds on a fixed, known date. | Mistrust between drivers, TODA leadership, and the LGU; skepticism toward future government assistance programs. |

---

## 7. How the Proposed Solution Addresses These Needs

The TAPat repository features directly match the documented needs of Mang Danny and municipal program administrators:

```
+----------------------------------------------------------------------------------------------------+
|                                    TAPAT SOLUTION ARCHITECTURE                                     |
+----------------------------------------------------------------------------------------------------+
|  [ LGU Masterlist CSV / OCR ]                                                                      |
|             │                                                                                      |
|             ▼                                                                                      |
|  [ F1: Intake Screening ] ──► Conformal Risk Control ──► Auto-Approve Genuine (λ_hi)                |
|                                                      ──► One-Tap Appeal via Telegram (Uncertain)   |
|                                                      ──► Reject Underage / Duplicate Plates (λ_lo) |
|             │                                                                                      |
|             ▼                                                                                      |
|  [ F2: 1-Minute Enrollment ] ──► TODA Phone Terminal: Scan Plate + Read NFC UID ──► On-Chain Card  |
|             │                                                                                      |
|             ▼                                                                                      |
|  [ F3: Tranche Agent ] ──► BOCPD Model Monitors DOE Fuel Prices ──► Releases ₱1,500 Escrow        |
|             │                                                                                      |
|             ▼                                                                                      |
|  [ F4: Station Tap-to-Pay ] ──► Driver Taps NFC Card at Pump ──► Noir Contract Simulation           |
|                                 (₱500 per-tap cap, nonce protection, zero driver data required)   |
|             │                                                                                      |
|             ▼                                                                                      |
|  [ F5: Freeze Agent ] ──► MIDAS-F Anomaly Detection ──► Freezes Suspicious Stations (Stops Fraud)  |
|             │                                                                                      |
|             ▼                                                                                      |
|  [ F6: Program Sweep ] ──► Unspent Escrow Swept to LGU ──► Single-Click Cryptographic COA CSV      |
+----------------------------------------------------------------------------------------------------+
```

### 7.1 F1 — Intake & Masterlist Screening (Solving the ₱2.7B Ghost Leakage & Name Rejections)
- **Technical Capability:** Implements Name Matching, Hard Rules (`UNDERAGE`, `DUPLICATE_PLATE`, `PLATE_MULTI_NAME`), and Conformal Risk Control (CRC) calibrated to bound wrongful-denial risk at $\alpha = 0.05$ and ghost-admission risk at $\beta = 0.02$.
- **Direct User Benefit:** High-confidence genuine drivers are approved automatically without standing in municipal queues. Genuinely uncertain records (e.g., typographical name errors) are isolated into an `evidence_requested` queue, where the driver can resolve the discrepancy by submitting a single photo of their OR/CR via Telegram, completely bypassing the in-person verification crowd.

### 7.2 F2 — One-Minute Field Enrollment (Eliminating the "Queue Penalty")
- **Technical Capability:** TODA enrollment officers use an Android smartphone (`/enroll`) to read a blank NFC card's UID via Web NFC and capture one photo of the tricycle plate. The system generates a cryptographic device hash (`SHA-256(salt:UID)`), establishes an agent keypair, and executes `device_registry.register` and `agent_registry.register_agent` on Stellar Testnet.
- **Direct User Benefit:** Mang Danny enrolls at his home TODA terminal in 60 seconds. He loses zero hours on the road, pays zero fees, and walks away with a durable NFC fuel card tied to his verified vehicle.

### 7.3 F3 — Price-Triggered Tranche Agent (Solving Pump Price Shock)
- **Technical Capability:** A Bayesian Online Changepoint Detection (BOCPD) agent continuously tracks fuel price series (`fixtures/prices/doe-diesel-sim.json`). When the posterior changepoint probability satisfies $P(r_t < 10) \ge 0.9$ and the sustained segment mean crosses the threshold (₱65.00), the Tranche Agent automatically funds a ₱1,500 escrow per active card via `payment_escrow.fund_escrow()`.
- **Direct User Benefit:** Subsidies are disbursed when international fuel spikes actually hit the pump, rather than waiting months for a delayed fiscal release. Mang Danny receives fuel relief precisely during the week his household budget is under greatest strain.

### 7.4 F4 — Tap-to-Pay at Station Phones (Solving Data, Battery, and Literacy Barriers)
- **Technical Capability:** Participating gas stations use an Android smartphone running the `/station/[id]` Web NFC interface. The attendant enters the amount; the driver taps the NFC card. The Fastify backend simulates `payment_escrow.authorize()` via the `@noirx402/agent-sdk`. Noir smart contracts autonomously enforce a strict ₱500 per-tap cap, verify nonces, check policy expiry, and confirm escrow balance.
- **Direct User Benefit:** Mang Danny needs **zero mobile data, zero battery, and zero smartphone literacy**. The card works instantly at the pump. The ₱500 cap prevents rogue attendants from draining his balance, and an automated Telegram notification provides a receipt if his phone is online.

### 7.5 F5 — Freeze Agent (Protecting Program Funds Against Merchant Collusion)
- **Technical Capability:** A real-time MIDAS-F streaming graph anomaly detector processes card-to-station edges using a Count-Min Sketch with time decay. If a fuel station colludes with bad actors to execute rapid burst taps (e.g., draining 20 cards in 30 seconds) or repeatedly charges near the ₱500 cap, the Freeze Agent flags the anomaly and sets the station to `frozen`.
- **Direct User Benefit:** Prevents corrupt merchants from skimming Mang Danny's card or draining community aid allocations. Settlement claims are held until the LGU reviews the anomaly.

### 7.6 F6 — Program Sweep and Single-Click COA Audit (Solving the ₱709M Unspent Reversion)
- **Technical Capability:** At program conclusion, the sweep runner executes `agent_registry.revoke_agent()` and `payment_escrow.sweep_on_revoke()`, transferring unspent escrow balances back to the LGU Program Wallet on the same day. `GET /api/export/coa.csv` exports every fund, authorize, claim, and sweep event with its exact Stellar transaction hash.
- **Direct User Benefit:** The LGU avoids audit disallowances and unliquidated funds. Every centavo of public aid is accounted for, ensuring that municipal councils have the confidence and audit compliance necessary to fund future subsidy cycles for Mang Danny.

---

## 8. References and Sources

The following formal citations document every empirical statistic, government audit finding, demographic marker, and administrative precedent utilized in this research:

1. **Commission on Audit (COA) Annual Audit Report on the DOTr & LTFRB**
   - *Author/Organization:* Commission on Audit (COA), Republic of the Philippines
   - *Publication Date:* July 2023 / Updated Audit Tracking 2024
   - *Direct URL:* [https://www.gmanetwork.com/news/topstories/nation/875086/coa-p709m-fuel-subsidy-funds-idle/story/](https://www.gmanetwork.com/news/topstories/nation/875086/coa-p709m-fuel-subsidy-funds-idle/story/) (See also [ASTIG.ph Audit Summary](https://astig.ph/p709-88-million-dotr-fuel-subsidy-funds-idle-uncredited-coa/))
   - *Relevant Finding:* Documented ₱709.88 million in unspent, expired, or uncredited fuel subsidies; confirmed ₱179.96 million processed but rejected by banks due to erroneous beneficiary data, with tricycle drivers accounting for approximately ₱120 million.
   
4. **Quezon City Local Government Unit TODA Fleet Card Distribution**
   - *Author/Organization:* Quezon City Government, Transport and Traffic Management Department (TTMD) / Tricycle Regulation Division
   - *Publication Date:* April 2025 / Manila Bulletin
   - *Direct URL:* [https://quezoncity.gov.ph/departments/tf-transport-and-traffic-management/](https://quezoncity.gov.ph/departments/tf-transport-and-traffic-management/) (See also [Manila Bulletin Report](https://mb.com.ph/2025/04/22/qc-distributes-12073-toda-fuel-cards))
   - *Relevant Finding:* Confirmed distribution of 12,073 fuel subsidy fleet cards to registered TODA members across six legislative districts (District I: 1,314; District II: 3,402; District III: 1,521; District IV: 2,061; District V: 1,719; District VI: 2,056).

5. **Bangko Sentral ng Pilipinas (BSP) Financial Inclusion Survey (FIS)**
   - *Author/Organization:* Bangko Sentral ng Pilipinas (BSP)
   - *Publication Date:* Benchmark 2021 Survey (Released 2022) / 2023–2024 Retail Payment Updates
   - *Direct URL:* [https://www.bsp.gov.ph/Inclusive%20Finance/Financial%20Inclusion%20Reports%20and%20Publications/2021/2021FISToplineReport.pdf](https://www.bsp.gov.ph/Inclusive%20Finance/Financial%20Inclusion%20Reports%20and%20Publications/2021/2021FISToplineReport.pdf)
   - *Relevant Finding:* Established baseline of 36% e-money account ownership vs. 23% bank account ownership; identified lack of documentation and volatile low income as primary barriers to formal financial inclusion among informal workers.

6. **DSWD-GCash UPLIFT Digital Disbursement Assessment**
   - *Author/Organization:* Department of Social Welfare and Development (DSWD)
   - *Publication Date:* June 2024 / Official Agency Release
   - *Direct URL:* [https://www.dswd.gov.ph/dswd-gcash-partner-for-digital-payout-of-uplift-cash-assistance/](https://www.dswd.gov.ph/dswd-gcash-partner-for-digital-payout-of-uplift-cash-assistance/)
   - *Relevant Finding:* Established that only approximately 20% of eligible informal transport and social assistance beneficiaries held personal, active digital accounts, necessitating manual fallbacks.

