# Costs per story

Numbers come from the Claude Code session logs (main session plus the sub-agent of each story), read with a script; assistant messages counted once each. Est. cost uses Sonnet list prices ($3 input, $3.75 cache write, $0.30 cache read, $15 output per million tokens) and is an estimate only; it differs from `/usage`, which showed $3.44 for about 112k output / 10.5m cache read / 425k cache write.

| Story | # Messages | Input tokens | Cache write | Cache read | Output tokens | Est. cost USD |
|-------|------------|--------------|-------------|------------|---------------|---------------|
| Interview + plan | 23 | 48 | 134,770 | 2,375,563 | 24,942 | 1.59 |
| S01 workspace skeleton | 47 | 94 | 166,728 | 5,540,401 | 61,284 | 3.21 |
