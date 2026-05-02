---
name: weather
description: "Get current weather and forecasts (no API key required)."
description_zh: "查询天气预报，无需 API 密钥"
description_en: "Weather forecasts, no API key needed"
version: 1.0.0
allowed-tools: Read, Bash, WebFetch
---


# Weather

Get current weather and forecasts using free services (no API key required).

**IMPORTANT**: After fetching weather data, present the result to the user. Do NOT call additional tools once you have the data — just show the weather information directly.

## wttr.in (primary)

Fetch via WebFetch or Bash:
- `https://wttr.in/London?format=3` — short text output
- `https://wttr.in/London?format=%l:+%c+%t+%h+%w` — custom format
- `https://wttr.in/London?T` — with local time

Format codes: `%c` condition, `%t` temp, `%h` humidity, `%w` wind, `%l` location

Tips:
- Use `+` for spaces: `wttr.in/New+York`
- Airport codes: `wttr.in/JFK`
- Metric: `?m` | USCS: `?u`
- Today only: `?1`, Current only: `?0`

## Open-Meteo (fallback, JSON)

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=-0.12&current_weather=true"
```

## Workflow

1. Identify the city from the user's request.
2. Fetch weather using **one** method (WebFetch or Bash — pick just one).
3. **Present the result to the user directly.** Do not call additional tools after receiving weather data.
