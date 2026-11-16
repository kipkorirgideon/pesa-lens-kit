# PesaLens — product spec

## What it is
A single-user web app. The user exports their phone's SMS with an "SMS Backup" app, drops the file into PesaLens, and gets a dashboard of where their M-PESA money goes. Everything runs **in the browser**. Nothing is uploaded, nothing is stored except settings.

## Input file
JSON, extension `.sms` (also accept `.json`), roughly 5–10 MB and about 17,000 messages:
```json
{ "listSms": [ { "adress": "MPESA", "body": "…", "name": "MPESA", "read": 0, "time": 1794831664214, "type": 1 } ] }
```
(`adress` is spelled that way by the backup app.) Use only messages where `adress` is `MPESA` or `M-PESA`. `time` is epoch milliseconds; display everything in Africa/Nairobi time (UTC+3, no DST).

## Parsing rules
Collapse all whitespace runs to one space and trim first. A leading `Congratulations! ` may come before the code. The code is the first 10 alphanumeric characters (upper-case it). **The first matching rule wins, in this order.** De-duplicate by (category, code): the same code legitimately appears in two categories, for example a payment and its Fuliza draw.

All examples below are **synthetic** (invented names, numbers and codes).

| # | category | example (synthetic) | extract |
|---|---|---|---|
| 1 | `send_paybill` | `QAB1CD2EF3 Confirmed. Ksh1,300.00 sent to Equity Paybill Account for account 1234 on 14/11/26 at 8:08 PM New M-PESA balance is Ksh0.00. Transaction cost, Ksh15.00.` | amount, payee, account, cost, balance |
| 2 | `send_person` | `QAB1CD2EF4 Confirmed. Ksh1,000.00 sent to JANE DOE 0712345678 on 16/11/26 at 6:42 AM. New M-PESA balance is Ksh0.00. Transaction cost, Ksh13.00.` | amount, name, phone (`0\d{9}` or `+?254\d{9}`) |
| 3 | `send_pochi` | `QAB1CD2EF5 Confirmed. Ksh150.00 sent to John Kamau on 15/11/26 at 4:00 PM. New M-PESA balance is Ksh0.00. Transaction cost, Ksh0.00.` | amount, name (no phone; Pochi la Biashara) |
| 4 | `till` | `QAB1CD2EF6 Confirmed. Ksh120.00 paid to MAMA JANE CAFE. on 16/11/26 at 3:20 PM.New M-PESA balance is Ksh0.00. Transaction cost, Ksh0.00.` | amount, payee (strip trailing dots) |
| 5 | `recv_person` / `recv_business` | `QAB1CD2EF7 Confirmed.You have received Ksh500.00 from JANE DOE 0712***678 on 26/9/26 at 8:04 AM New M-PESA balance is Ksh500.00.` (`at` may be missing) | amount, sender. Use `recv_person` if the sender ends with a full or masked phone (`[0-9*]{7,}` after `0` or `254`), else `recv_business` (for example `Sample Bank Bulk Account 123456`, `Hustler Fund`) |
| 6 | `withdraw` | `QAB1CD2EF8 Confirmed.on 21/9/26 at 8:24 PMWithdraw Ksh1,500.00 from 012345 - Sample Agent Shop New M-PESA balance is Ksh1,000.00. Transaction cost, Ksh29.00.` | amount, agent, cost |
| 7 | `airtime` | `QAB1CD2EF9 confirmed.You bought Ksh10.00 of airtime on 13/10/26 at 3:20 PM.` | amount |
| 8 | `fuliza_draw` | `QAB1CD2EF6 Confirmed. Fuliza M-PESA amount is Ksh 120.00. Access Fee charged Ksh 1.20. Total Fuliza M-PESA outstanding amount is …` (older wording: `Interest charged`) | amount, fee. The code matches the payment it funded |
| 9 | `reversal` | `QAB1CD2EG1 confirmed. Reversal of transaction QAB1CD2EG0 has been successfully reversed on … and Ksh100.00 is credited to your M-PESA account.` (also `Your original transaction X in favour of NAME has been reversed … Ksh400.00 has been credited`) | amount, original code |
| 10 | `deposit` | `QAB1CD2EG2 Confirmed. On 11/10/26 at 2:36 PM Give Ksh10,000.00 cash to Sample Agent New M-PESA balance is …` | amount |
| 11 | `fuliza_repay` | `QAB1CD2EG3 Confirmed. Ksh 500.00 from your M-PESA has been used to partially pay your outstanding Fuliza M-PESA.` (also `fully`; older: `… confirmed. Ksh440.18 paid on 10/11/23 at 12:01 PM. Fuliza Loan repayment successful.`) | amount |
| 12 | `kcb_from` | `QAB1CD2EG4 Confirmed. You have transfered Ksh500.00 from your KCB M-PESA account on …` | amount |
| 13 | `kcb_to` | `QAB1CD2EG5 Confirmed. Ksh20,000.00 transfered to KCB M-PESA account on …` | amount |
| 14 | `kcb_repay` | `QAB1CD2EG6 Confirmed. Your loan repayment of Ksh5,000.00 from your M-PESA account to KCB M-PESA on … is successful.` | amount |
| 15 | `mshwari_from` | `QAB1CD2EG7 Confirmed.Ksh1,000.00 transferred from M-Shwari account on …` | amount |
| 16 | `mshwari_to` | `QAB1CD2EG8 Confirmed.Ksh1,500.00 transferred to M-Shwari account on …` | amount |
| 17 | `hustler_repay` | `QAB1CD2EG9 Confirmed. You have sent Ksh1,005.00 to Hustler Fund on 03/11/2026 at 11:22 AM.` | amount |

Also extract `Transaction cost, Ksh X` → cost (default 0) and `New M-PESA balance is Ksh X` → balance (nullable). Amount regex: `Ksh\s?([\d,]+\.\d{1,2})`.

Counters (from unmatched messages): insufficient funds `/insufficient|not have sufficient/i`; wrong PIN `/wrong PIN/i`; lock-outs `/PIN is locked|account has been locked/i`; KCB loan requests = messages containing `KCB M-PESA loan request`, de-duplicated by their first 10 characters.

## Definitions
- **Money out:** send_person, send_pochi, send_paybill, till, withdraw, airtime, kcb_to, mshwari_to, kcb_repay, hustler_repay, fuliza_repay.
- **Money in:** recv_person, recv_business, kcb_from, mshwari_from, reversal, deposit. Fuliza draws are reported separately, not as money in.
- **People:** merge send_person + send_pochi (sent) with recv_person (received) by name, upper-cased with whitespace collapsed. Show up to 2 unmasked phone numbers. Per person: sent amount and count, received amount and count, net (received − sent), first and last activity.
- **Payees:** send_paybill + till, keyed by upper-cased name (trailing dots stripped) + type. Rank within each type, and overall.
- **Bars & restaurants**, classified from the payee name:
  - Bars & lounges: `\bBAR\b` (not "MILK BAR"), `LOUNGE` (not "KINYOZI"), `\bPUB\b`, `WINES?`, `LIQUOR`, `SPIRITS`, `\bCLUB\b`, `GARDENS`, `ROOFTOP`, `RESORT`
  - Butcheries: `BUTCHER`, `MEAT POINT`, `FISH MONGER`
  - Restaurants & food: `RESTAURANT`, `HOTEL`, `CAFE`, `CAFFE`, `KITCHEN`, `CATERER`, `FOODS?`, `PIZZA`, `KFC`, `CHICKEN`, `JAVA`, `GRILL`, `CHOMA`, `ROAST`, `EATERY`, `SNACK`, `MILK BAR`, `DINE`, `\bREST\b`, `FISH PALACE`
  - Exclude names containing SUPERMARKET, SACCO, BANK, KITCHENWARE, TYRES, KINYOZI.
  - Bar rules are checked before butchery rules, which are checked before food rules.
  - The user can tag extra payees as bars in Settings, and can merge several tills into one venue (for example three tills of the same bar).
  - "Night of week": payments before 05:00 count toward the previous evening.
- **Money drains (people):** net out (sent − received) ≥ KSh 10,000, excluding people listed in Settings. Warning tags:
  - never sent anything back
  - returned < 25%
  - a single send ≥ 20k
  - ≥ 30 sends
  - rising (last-12-months sent > 1.5 × the prior 12 months, and ≥ 10k)
  - ≥ 5 sends in the last 90 days

  Windows are counted back from the latest transaction.
- **Money drains (bars):** per bar:
  - total; last 12 months vs the prior 12 months; nights; per night; % after 22:00; biggest night
  - tags: spending rising / new; ≥ 50% after 10 PM; ≥ 5k after midnight; one night ≥ 8k; ≥ 5 payments in the last 90 days
- **Red flags** (each has severity, title, value, unit, and a detail sentence generated from the data). Excluded people never appear or count in any flag.

  | Severity | Flags |
  |---|---|
  | High | Fuliza dependence (draws, total, months used, peak month, access fees); wallet drained to zero (% of outgoing payments leaving balance ≤ 0); recurring digital borrowing (KCB loan requests and repayments, Hustler borrowed vs repaid, Fuliza repayments); bar spending climbing (last 12 months vs prior, % change); money sent to people who never send back (count and total, net ≥ 10k, received = 0); borrowing on Fuliza to give money away (Fuliza draws whose code matches a send to a person) |
  | Medium | months where spending beat income; transaction fees; people who ask often (≥ 30 sends or ≥ 5 in the last 90 days, mostly unreturned) |
  | Low | tiny bundle purchases (Safaricom offers/data bundles); late-night spending (00:00–04:59); failed and blocked transactions (counters); betting (Betika/SportPesa/Odibets/Mozzart/etc. staked vs won); credit bureau payments; agent withdrawal fees; reversals (sent to the wrong number) |

## Pages (tabs)
1. **Upload:** drag-and-drop or file picker. Parse in a Web Worker with a progress/spinner. Friendly error for a wrong file. Clear privacy note: "Processed on this device. Never uploaded."
2. **Overview:**
   - KPI tiles: money in, money out, sent to people, paybill & till, Fuliza borrowed, fees
   - one-sentence takeaway
   - monthly money in vs out, with Fuliza drawn shown below the axis
   - where the money went (by category)
   - payments by hour
3. **Red flags & drains:**
   - flag cards, with severity as coloured **text** (High red, Medium amber, Low grey)
   - drain lists for bars (chart of last 12 months vs prior, plus a table) and people (table)
   - warning tags and net-out amounts in red text
4. **People:**
   - top-15 chart of sent (left) vs received (right)
   - a table that toggles between "Top 200 by sent" and "Top 200 by received". Each row shows sent amount and count next to received amount and count, then net (red when negative, unless the person is excluded) and last activity
   - search, sortable columns
5. **Paybills & tills:**
   - Top 100 with an All / Paybill / Till filter; each filter ranks 1–100 within itself
   - charts by weekday and by hour (stacked paybill/till)
   - weekday × hour heat map
   - time-of-day table
   - top 3 payees per weekday
6. **Bars & restaurants:**
   - takeaway sentence and category table
   - charts by year, night of week, hour and month (stacked bars / restaurants / butcheries)
   - top venues and the biggest nights out
7. **Fuliza & loans:** takeaway sentence, a monthly stacked chart (Fuliza drawn, KCB repayments, Hustler borrowed), and a product table.
8. **Settings:**
   - excluded people (family), picked from the people list
   - extra bars and venue merges, picked from the payee list
   - stored in localStorage; changes re-run the analysis instantly

Everywhere:
- Light theme.
- `KSh 12,345` formatting, with short forms only on chart axes.
- Exact-value tooltips on charts.
- A CSV export on every table.
- Works at 400 px wide.
- Header shows the date range and transaction count; the tab bar is sticky.

## Non-goals
No accounts, no backend, no cloud storage, no sharing of data. Deploying to Vercel only serves the static app.
