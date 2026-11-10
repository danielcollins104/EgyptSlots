# Digital Dan — Autonomous Daily Video Channel

A daily 30-second vertical video in Dan Collins' voice and likeness: what's
trending in AI / tech / academic research, and how it gives ordinary people
their time back for family and what matters.

## Architecture

| Stage | Tool | Status |
|---|---|---|
| 1. Daily research + topic selection | Kimi cron job (WebSearch, arXiv, Stanford HAI, etc.) | Ready — awaiting enable confirmation |
| 2. Script writing (Dan's voice, 65–90 words) | Kimi cron job, guided by `persona/dan-profile.md` | Ready |
| 3. Voice audio | **HeyGen voice clone** (needs Dan's API key + voice consent) | Blocked on Dan |
| 4. Talking-head video (9:16, lip-synced) | **HeyGen video avatar API** (needs Dan's avatar + API key) | Blocked on Dan |
| 5. Captions / final render | ffmpeg locally (or HeyGen captions) | Ready once video exists |
| 6. Publish YouTube Shorts + TikTok | YouTube Data API + TikTok Content Posting API | Blocked on Dan's OAuth |
| 7. Daily report | Written to `content/YYYY-MM-DD/report.md` each run | Ready |

Design rule: every stage is swappable. If a better avatar/voice service
appears, only stages 3–4 change.

## Directory layout

- `persona/` — who Dan is: philosophy, humor, spiritual boundaries, voice rules
- `pipeline/runbook.md` — the exact checklist the daily job follows
- `content/YYYY-MM-DD/` — one folder per day: script, sources, audio, video, report
- `content/topics-log.md` — every covered topic, to prevent repetition

## What Dan must provide (one-time)

1. **HeyGen account** (Creator plan or higher for API access) + API key.
2. **Voice clone consent**: in HeyGen, record the short consent phrase and
   1–2 minutes of natural speech.
3. **Avatar**: 2 minutes of clean footage (or HeyGen photo avatar to start).
4. Later: YouTube + TikTok app credentials for auto-publishing. Until then,
   videos are delivered locally for one-click manual upload.
