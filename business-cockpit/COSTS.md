# Costs per story

Numbers come from the Claude Code session logs (main session plus the sub-agent of each story), read with a script; assistant messages counted once each. Est. cost uses the prices of Claude Sonnet 5.5 from https://platform.claude.com/docs/en/about-claude/pricing (the page claude.com/de/pricing shows no API table): $2 input, $2.50 cache write (5 min; 1 h would be $4), $0.10 cache read, $10 output per million tokens. It is an estimate and differs a little from `/usage`.

| Story | # Messages | Input tokens | Cache write | Cache read | Output tokens | Est. cost USD |
|-------|------------|--------------|-------------|------------|---------------|---------------|
| Interview + plan | 23 | 48 | 134,770 | 2,375,563 | 24,942 | 0.82 |
| S01 workspace skeleton | 47 | 94 | 166,728 | 5,540,401 | 61,284 | 1.58 |
| S02 backend + Keycloak login (sub-agent only) | 48 | 96 | 180,753 | 6,549,854 | 63,099 | 1.74 |
