## What is actually wrong

**1. Rankings include non-qualifying neighborhoods.** The intensity rank in the copy is `payload.rank.manhattanRank`, taken straight from the pipeline, which ranks every neighborhood it sees. That is why Lenox Hill reads 16th, Upper West Side 18th, and Lincoln Square 19th when only 14 neighborhoods clear the 11-contract floor. The volume rank is already registry-based, but it says "of Manhattan's 10 tracked luxury markets" because it counts only the published top 10 board.

Fix: both ranks get recomputed from the luxury registry, over qualified neighborhoods only.
- Intensity rank = position by luxury share among qualified rows.
- Volume rank = position by 52-week luxury dollar volume among qualified rows.
- Wording becomes "of Manhattan's 14 qualifying luxury markets" (the count follows the registry, so it moves on its own if the feed widens).
- If a neighborhood is not itself qualified, the rank sentence is dropped rather than published with a made-up position.
- Tribeca lands at 1st on intensity and the SoHo tie disappears once the tie is resolved on the underlying unrounded share, which matches Heather's note.

**2. Bedroom label mismatch.** The labels in the copy were right. The debugger's own pattern match was reading the connector word ("while Studio") as part of the segment name and reporting a mismatch. That pattern was corrected in the last pass. I will re-run every neighborhood through the audit to confirm the flags are gone, and add a guard so both the dollar series and the count series are canonicalized before either the copy or the audit touches them, so a new upstream spelling cannot reopen this.

**3. "Calls the rank dollar volume; manhattanRank measures luxury intensity."** That is not copy and it never appears on a public page. It is a message from the debugger's audit rules, the internal checker that compares each sentence against the numbers behind it. It was a stale rule written when the sentence quoted only one rank. It now checks against whichever rank the sentence actually quotes. After fix 1 it gets rewritten again to check both ranks against the qualified registry.

**4. Vague benchmark language.** Lines like "your segment sets the dollar benchmark" and "expect company at the table" say nothing a reader can act on. Replacement pattern names the numbers:

Current:
> 4+ Beds residences drove most of West Village's luxury dollars this month, while Studio residences accounted for the most deals. Size concentrates the dollars; the smaller sizes carry the activity. Sellers of 4+ Beds residences: your segment sets the dollar benchmark. Buyers at Studio: that is the busiest segment, so expect company at the table.

Proposed:
> 4+ Beds residences accounted for 48% of West Village's luxury dollars this month on 6 contracts. Studio residences were the most frequent trade, with 14 contracts. Sellers of 4+ Beds should price against the small set of comparable large-format sales, not the neighborhood median. Buyers at Studio are competing in the deepest part of this market, so assume other offers on well-priced units.

Same structure everywhere: share and count first, then one concrete instruction per side. No "benchmark", no "company at the table", no em dashes.

## Also found, not in your notes

West Chelsea's contract line reads "Running above its 3-month and 12-month pace. A solid month" and then "The underlying pace has also cooled 20% versus a year ago." Those two halves fight each other on a 1-deal base. I would suppress the year-over-year clause when the sample is below the small-sample floor. Say if you want that in this pass.

## Technical notes

- `src/lib/lux-registry.server.ts` gains a qualified-only ranked view; `src/lib/neighborhood-report.functions.ts` reads intensity and volume rank from it instead of `payload.rank.manhattanRank`.
- `src/lib/sowhat.ts`: rank template rewritten for qualified totals; `computeUnitMixSowhat` rewritten to carry share and count.
- `src/lib/sowhat-audit.ts`: rank rules audit against registry ranks; unit-mix rules audit share and count claims.
- Nothing ships to the live neighborhood pages until you have reviewed the output on `/sowhat-debug`.

## Sequence

1. Land the four fixes behind the debugger and show you every regenerated sentence.
2. You approve, then it goes live on the neighborhood pages.
3. Then build the neighborhood archive system and load the July pages.
