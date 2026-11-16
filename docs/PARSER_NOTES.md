# Parser notes (from the Python → TypeScript port)

`npx tsx scripts/verify.ts backups/sms.sms` is the golden test: it runs the parser on your real backup and compares against `reference/expected/*.json` (both git-ignored, kept only on your machine).

`npx tsx scripts/verify.ts` (add `--details` to print every flag sentence) passes every section against
`reference/expected/*.json`, within ±1 KSh. Where the TS output differs from the Python, or where the Python's
numbers were typed in by hand:
- **Types**: added one optional field, `ParseResult.kcbLoanRequestTs` (the SMS time of each distinct KCB loan request), which `loans.monthly.kcb_requests` needs. Nothing was renamed.
- **Dedupe key**: like the Python, it uses the *rule* name plus the code, so `recv`/`recv_alt` and `fuliza_repay2`/`fuliza_repay` dedupe separately. `Txn.cat` maps them to `recv_person|recv_business` and `fuliza_repay`.
- **Months**: TS lists every month from the first to the last transaction. The Python listed only months that had at least one transaction. Both give the same 52 months on this backup.
- **loans flag**: the Python value counted raw SMS containing "KCB M-PESA loan request" with no dedupe. TS uses the deduped count (`counters.kcbLoanRequests`). Both are 159 here.
- **oneway** (hand-written 48 in flags2.py, which read only the top-40 drain list): TS counts the full drain list (net out ≥ 10k, nothing received, excluded people left out). That gives 48 people and KSh 1.47M, the same as the hand-written values. A person gets a "(Sep–Oct 2026)" month span only when all of their sends fall within the last 90 days. Excluded people are never named in flags.
- **bars_rising**: value = round(100·(last 12m / prior 12m − 1)) = 86, which matches. The Python sentence said "most of it is paid after 10 PM". Measured over the last 12 months, the late share is **46%** (the all-time figure is 54%), so TS says "46% of it". Venue names keep their data spelling. The title softens if spending is not rising.
- **borrow_give**: rule = Fuliza draws whose transaction code equals a send_person/send_pochi code to a non-excluded person. That gives 839 draws and KSh 255,418.94, which rounds to 255,419 and matches. The detail now also states the fees on those draws (KSh 2,547).
- **frequent** (hand-picked 3 names in flags2.py): TS rule = drain-list person with ≥ 40 sends who is still active (≥ 5 sends in the last 90 days, or the drains "rising" rule) and got back < 60%. I chose this rule so it picks the same 3 people, so treat it as a heuristic. Rows are ordered by net out; each now shows sends, % returned, net out and recency.
- **withdraw / reversal**: computed and they match (230 withdrawals, KSh 9,057; 11 reversals, 4 in the latest year). "in 2026" is now "in <latest year in the data>".
- **betting**: brand names come from the matched text (build.py's BET list). "since 2025" is now "since <latest year − 1>". The "(mostly stopped)" title appears only when ≤ 10% of bets fall in that window.
- **Excluded people** are dropped from `drains.people` and from the oneway, borrow_give and frequent flags. They are matched by exact normalized name, whereas the Python used a substring regex; this gives the same result here. Wallet-level flags (fuliza, zero, night, cost, overspend) still count payments made *to* excluded people, as the Python did. Those flags count payments, not people, and the expected values depend on it.
- **List lengths**: `people` and `payees` are full lists. `drains.people` is the full threshold list (60 rows here), while the Python kept only 40, so verify checks just the first 40. As in the Python, `fb.venues` keeps the top 100, `fb.nights` the top 15 and `drains.bars` the top 20.
- **Payee display name** is the first spelling seen (as in biz100.py; agg.py used the last spelling seen).
- **extraBars** matches payee names case-insensitively (a `type|name` key is also accepted). It overrides the non-food exclusion regex and feeds fb.*, drains.bars and bars_rising.
- Python's half-to-even `round()` and `str.title()` are emulated (`pyRound`, `pyTitle` in `src/lib/classify.ts`), so the drain warning text matches character for character.
