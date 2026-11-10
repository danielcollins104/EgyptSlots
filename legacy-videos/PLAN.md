# Legacy Video Project — "Love One Another"

**Owner:** Daniel
**Mission:** Leave a godly legacy — videos that glorify Christ and help people be more loving, forgiving, and kind in their relationships. Content that keeps ministering (and earning) long after it's made.

> "And let us consider how to stir up one another to love and good works." — Hebrews 10:24
> "By this everyone will know that you are my disciples, if you love one another." — John 13:35

---

## 1. Concept

A series of short (60–90 second) vertical videos for YouTube Shorts / TikTok / Instagram Reels,
plus longer 5–8 minute versions for YouTube. Each video:

1. Opens with a relatable relationship moment (a hurt, a grudge, a cold silence).
2. Brings one scripture to bear on it.
3. Gives one concrete, doable act of love / forgiveness / kindness for today.
4. Closes with a short prayer or blessing.

Tone: warm, humble, practical — never preachy. A friend, not a pulpit.

## 2. Series 1 — "The Forgiveness Project" (12 episodes)

| # | Title | Anchor Scripture | Theme |
|---|-------|------------------|-------|
| 01 | The Apology You Never Got | Romans 12:19 | Releasing the debt when they never say sorry |
| 02 | 70 x 7 Is Not a Spreadsheet | Matthew 18:21-22 | Forgiveness as a habit, not a score |
| 03 | The Last Text You Never Sent | Ephesians 4:26-27 | Don't let the sun go down on anger |
| 04 | Kindness When You're Right | Proverbs 15:1 | A gentle answer turns away wrath |
| 05 | Loving the Difficult One | Luke 6:32-33 | Love that costs something |
| 06 | The Grudge Journal | Colossians 3:13 | Writing it down, then letting it go |
| 07 | Speak Life | Proverbs 18:21 | Words that build vs. words that bury |
| 08 | The Marriage Reset | 1 Corinthians 13:4-7 | Love is patient, love is kind — line by line |
| 09 | Forgiving Your Parents | Exodus 20:12 / Ephesians 6:2-3 | Honor without pretending it didn't hurt |
| 10 | When They Apologize Badly | Luke 17:3-4 | Accepting imperfect repentance |
| 11 | The Friend Who Drifted | Proverbs 17:17 | Reaching first, keeping no record |
| 12 | Passing It Down | Deuteronomy 6:6-7 | Teaching kids mercy by modeling it |

## 3. Production pipeline (per episode)

1. **Script** → `scripts/EP##-<slug>.md` (voiceover text + shot list)
2. **Narration** → AI TTS (`audio_generation` plugin) → `audio/EP##.mp3`
3. **Visuals** → AI video clips (`video_generation` plugin) → `video/EP##-shotN.mp4`
4. **Assembly** → ffmpeg: clips + narration + subtitles + gentle music bed → `final/EP##.mp4`
5. **Personal clone (phase 2):** once Daniel provides a clear photo + 1–2 min voice
   sample, regenerate with his likeness/voice as the on-screen host.

## 4. Distribution & income (autopilot)

- Batch-produce episodes, schedule uploads (YouTube scheduled publish = free).
- Income streams: YouTube Partner Program ad revenue, a free "7 Days of Forgiveness"
  devotional PDF as email-list builder, print-on-demand devotional book compiled from scripts.
- Low-maintenance: evergreen content; scripture on relationships never goes stale.

## 5. Status

- [x] Project plan
- [x] EP01 script
- [ ] EP01 narration
- [ ] EP01 visuals
- [ ] EP01 assembly
- [ ] Daniel's photo + voice sample → personal clone
