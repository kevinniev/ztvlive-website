# ZTVLIVE Roku Channel

24/7 Live Streaming Platform with Interactive Game Show

## Quick Start

1. **Extract** this folder into your Roku SDK project
2. **Add channel icons** to the `/images` folder (see requirements below)
3. **Sideload** to your Roku device for testing
4. **Submit** to Roku Developer Portal for certification

## File Structure

```
ztvlive-roku-channel/
├── manifest                      # Channel configuration
├── source/
│   └── main.brs                  # Entry point
├── components/
│   ├── MainScene.xml/brs         # Main navigation
│   ├── ApiHelper.xml/brs         # API integration
│   ├── HomeScreen.xml/brs        # Netflix-style home
│   ├── LiveScreen.xml/brs        # Synchronized live player
│   ├── GameScreen.xml/brs        # Interactive survey game
│   ├── ScheduleScreen.xml/brs    # Weekly schedule
│   └── LanguageSelector.xml/brs  # 20 language support
├── images/                       # Channel icons (YOU MUST ADD)
│   ├── icon_focus_fhd.png        # 540x405
│   ├── icon_focus_sd.png         # 290x218
│   ├── splash_fhd.png            # 1920x1080
│   └── splash_sd.png             # 720x480
└── README.md
```

## API Endpoints

**Base URL:** `https://www.ztvlivestream.com/api`
(Configurable in ApiTask.xml and ApiHelper.xml)

| Endpoint | Description |
|----------|-------------|
| `/roku-feed/` | Main content feed |
| `/roku-feed/live` | Live streams |
| `/roku-feed/schedule` | Weekly schedule |
| `/tv/sync` | Current video + position (synchronized playback) |
| `/live-survey/state` | Game state (question, countdown, answers) |
| `/live-survey/answer` | Submit game answer |
| `/live-survey/join` | Join game session |
| `/translation/ui/{lang}` | UI translations (20 languages) |
| `/translation/languages` | Supported languages list |

## Features

### Home Screen
- Hero billboard with featured content
- "Live Now" banner with viewer counts
- Content rows organized by category
- Netflix-style navigation

### Live Screen
- **Synchronized playback** - everyone sees the same frame
- Auto-sync with server every 5 seconds
- Drift correction (re-syncs if >10 seconds off)
- Progress bar and program info

### Game Screen
- **50-second countdown** per question
- **Answer locking** at <5 seconds remaining
- Real-time player count
- Top 4 answers revealed at countdown zero
- Score tracking

### Schedule Screen
- Weekly programming grid
- Current time indicator
- Live show highlighting
- Timezone display

### Language Support
20 languages with instant UI translation:
- English, Spanish, French, German, Italian, Portuguese
- Russian, Chinese, Japanese, Korean, Arabic, Hindi
- Turkish, Polish, Dutch, Vietnamese, Thai
- Indonesian, Malay, Filipino

## Required Images

Before submitting to Roku, add these images to `/images`:

| File | Size | Description |
|------|------|-------------|
| `icon_focus_fhd.png` | 540x405 | FHD channel icon |
| `icon_focus_sd.png` | 290x218 | SD channel icon |
| `icon_side_hd.png` | 108x81 | Side panel icon HD |
| `icon_side_sd.png` | 54x41 | Side panel icon SD |
| `splash_fhd.png` | 1920x1080 | FHD splash screen |
| `splash_hd.png` | 1280x720 | HD splash screen |
| `splash_sd.png` | 720x480 | SD splash screen |

## Testing

### Sideloading
1. Enable Developer Mode on your Roku (Home 3x, Up 2x, Right, Left, Right, Left, Right)
2. Note your Roku's IP address
3. Zip this folder (exclude README)
4. Upload to `http://[ROKU_IP]:8060`

### Test Checklist
- [ ] Channel loads without errors
- [ ] Home screen shows content from API
- [ ] Live video plays and syncs correctly
- [ ] Game countdown works, answers submit
- [ ] Schedule displays correctly
- [ ] Language selector changes UI text
- [ ] D-pad navigation works on all screens
- [ ] Back button returns to previous screen

## Submission

1. Create account at [developer.roku.com](https://developer.roku.com)
2. Package channel (Settings > Developer > Package)
3. Upload to Developer Portal
4. Submit for certification

## Support

- **API Docs:** See `/app/ROKU_API_DOCUMENTATION.md`
- **Game API Docs:** See `/app/ROKU_GAME_API_DOCUMENTATION.md`
- **Platform:** ZTVLIVE - https://www.ztvlivestream.com

## Version History

- **7.1.0** - Fixed API base URL configuration, GameScreen JSON body format, dynamic schedule date, trending row overflow, version sync
- **7.0.0** - Premium UI with ESPN sports, CNN news, Netflix movies layouts
- **6.6** - Enhanced splash screen animations
- **1.0.0** - Initial release with Home, Live, Game, Schedule screens
