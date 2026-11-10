# Daily Runbook — executed every morning at 7:00 AM Central

Working root: `digital-dan/` in the workspace. Read `persona/dan-profile.md`
first, every run. Today = the run date; create `content/YYYY-MM-DD/`.

## 1. Research
- WebSearch across: arXiv, Stanford HAI, MIT Tech Review, Nature/Science news,
  OpenAI/DeepMind/Anthropic blogs, major tech press, and emerging discussions.
- Gather 4–8 candidate stories from the last few days.

## 2. Select ONE topic
Score candidates on: current interest, academic/scientific significance,
novelty, practical usefulness, time-saving potential, family-life impact,
curiosity/engagement. Do NOT default to the biggest headline.
Check `content/topics-log.md` — skip anything already covered unless there is
a genuinely new development. Append today's pick to the log.

## 3. Verify
Open the primary source (paper, official report). Every number or claim that
goes in the script must be verified there. Save source URLs + verbatim
snippets to `content/YYYY-MM-DD/sources.md`.

## 4. Write the script → `content/YYYY-MM-DD/script.md`
- 25–40 seconds spoken, ideally 65–90 words.
- Hook (0–5s) — vary openings, never reuse yesterday's.
- Plain-language middle: what happened, why it's interesting, what it means.
- Conclusion: connect to freedom / time / family / a bigger idea.
- Natural spiritual reflection only if it genuinely fits (see persona rules).
- Write for the ear, not the eye.

## 5. Voice + video (requires HeyGen API key in pipeline config)
- Generate audio with Dan's cloned voice via HeyGen.
- Generate 9:16 talking-head video of Dan's avatar, lip-synced.
- Until the key exists: save the script and mark video step PENDING in the
  report. Never fake it.

## 6. Captions + metadata
- Accurate captions, mobile-safe placement. Title, description, hashtags for
  YouTube Shorts and TikTok, including required AI-likeness disclosure.
  Save to `content/YYYY-MM-DD/metadata.md`.

## 7. Publish (requires YouTube/TikTok OAuth)
- Until authorized: deliver the finished video file and mark publishing
  PENDING with exact instructions. Never claim an upload that didn't happen.

## 8. Report → `content/YYYY-MM-DD/report.md`
Topic + why chosen, why it matters, the family connection, video link,
publishing status per platform, sources. On any failure: preserve all
completed work and say exactly what failed and why.

## Failure rules
- Retry transient failures once, then stop and report.
- Never publish defective video, false claims, or unlicensed footage.
- Never silently abandon a failed run.
