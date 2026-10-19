# Weekly analyst outlooks

Analyst editions describe the outlook after the named week. They are released
on the following Tuesday at noon America/Chicago. Week 6 is due October 20,
2026 at noon CDT (17:00 UTC). The existing five-minute Cloudflare schedule
publishes an eligible edition after Yahoo marks the games final and final
player rosters are complete. No separate manual weekly upload is needed.

## Method and source limits

The ordering uses 65% projected legal starting-lineup strength and 35% win
percentage, expressed as league percentiles. Player estimates blend the
August 27 preseason half-PPR ADP prior with scoring available through the named
week. The model chooses a legal lineup for each remaining regular-season week,
accounts for byes, and uses bench replacements. IR players are assumed to miss
the next four weeks unless a dated availability override says otherwise. An
active player marked out is excluded from the next week in a newly captured
edition. Expected final wins use the remaining opponents as an additional
editorial diagnostic; they are not a separate ranking weight.

Yahoo's available roster responses contained actual player points, team weekly
projections, and live matchup win probabilities, but no archived player
rest-of-season projections. Weeks 1–5 are explicitly labelled reconstructions.
They use each archived weekly roster and scores through that week, exclude
current injury labels, and do not claim to reproduce old Yahoo forecasts.
Sixty separately written historical team assessments are stored in
`public/data/outlook-inputs.json` alongside the preseason prior inputs.

New editions save the publication roster, player estimates, injury availability,
record, rankings and analysis in `season.powerRankings[week]`. They are persisted
in the existing Durable Object and are not recomputed by later injuries, trades
or results. New writeups derive from that edition's position strength, scoring
luck, record, IR list and individual production. Late reconstructed editions are
labelled accordingly. No future results enter a past edition.

Jack's supplied lists remain independent. Each author's movement compares with
their own previous published edition. There is no browser editor or local
override of Jack's lists.

## Live matchup odds

The normalizer reads `win_probability` from Yahoo's team matchup data, preserving
0 and 1. Both matchup headers and the matchup selector show Yahoo's percentage
only for the current, unfinished fantasy week. Historical weeks do not show
percentages, and missing odds are left out rather than estimated.

## Validation and source upload

Run `node --test tests/*.test.mjs`. Tests cover temporal isolation, dated injury
availability, the effect of wins, Tuesday gating, final-roster gating, immutable
editions, legal lineups, and exact Yahoo probability values.

Run `node scripts/build-yahoo-bootstrap.mjs` after changing seeds or editorial
inputs to rebuild the immediate offline fallback. Cloudflare deploys the full
`public` directory with `npx wrangler deploy`.
