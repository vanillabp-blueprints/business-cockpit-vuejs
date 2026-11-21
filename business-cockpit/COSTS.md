# Costs per story

Numbers come from the Claude Code session logs (main session plus the sub-agent of each story), read with a script; assistant messages counted once each. Est. cost uses the prices of Claude Sonnet 5.5 from https://platform.claude.com/docs/en/about-claude/pricing (the page claude.com/de/pricing shows no API table): $2 input, $2.50 cache write (5 min; 1 h would be $4), $0.10 cache read, $10 output per million tokens. It is an estimate and differs a little from `/usage`.

| Story | # Messages | Input tokens | Cache write | Cache read | Output tokens | Est. cost USD |
|-------|------------|--------------|-------------|------------|---------------|---------------|
| Interview + plan | 23 | 48 | 134,770 | 2,375,563 | 24,942 | 0.82 |
| S01 workspace skeleton | 47 | 94 | 166,728 | 5,540,401 | 61,284 | 1.58 |
| S02 backend + Keycloak login (sub-agent only) | 48 | 96 | 180,753 | 6,549,854 | 63,099 | 1.74 |
| S03 login and frame (sub-agent only) | 44 | 88 | 146,970 | 4,923,029 | 62,074 | 1.48 |
| S04 task list (sub-agent only) | 64 | 130 | 216,381 | 10,050,971 | 83,322 | 2.38 |
| S05 closed tasks and row looks (sub-agent only) | 16 | 32 | 54,830 | 933,685 | 9,067 | 0.32 |
| S06 large lists (sub-agent only) | 53 | 112 | 572,029 | 6,945,036 | 81,372 | 2.94 |
