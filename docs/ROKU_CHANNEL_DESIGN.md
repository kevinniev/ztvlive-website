# ZTVLIVE Roku Channel - Design & Implementation Guide

## Overview
A premium streaming experience designed to compete with Netflix, Hulu, and Prime Video. Features modern UI, smooth navigation, and 24/7 content streaming with intelligent fallback.

## Channel Architecture

### 1. Home Screen Layout (Netflix-Style)
```
┌─────────────────────────────────────────────────────────────┐
│  [ZTVLIVE LOGO]                    [Search] [Settings]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │              HERO - LIVE NOW or FEATURED           │   │
│  │         (Full-width video with auto-play)          │   │
│  │                                                     │   │
│  │   [▶ WATCH NOW]    [+ MY LIST]    [ℹ INFO]        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  CONTINUE WATCHING                               See All >  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │    │ │    │ │    │ │    │ │    │ │    │               │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘               │
│                                                             │
│  TRENDING NOW                                    See All >  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │    │ │    │ │    │ │    │ │    │ │    │               │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘               │
│                                                             │
│  CATEGORIES: Sports | Music | Podcasts | Gaming | Film     │
└─────────────────────────────────────────────────────────────┘
```

### 2. Color Palette (Matching Website)
```
Primary:       #DC2626 (ZTVLIVE Red)
Background:    #09090B (Near Black)
Surface:       #18181B (Zinc 900)
Surface Hover: #27272A (Zinc 800)
Text Primary:  #FFFFFF
Text Secondary:#A1A1AA (Zinc 400)
Accent Gold:   #F59E0B (For premium/earnings)
Live Badge:    #DC2626 with pulse animation
```

### 3. Channel Manifest (manifest.json)
```json
{
  "name": "ZTVLIVE",
  "version": "2.0.0",
  "major_version": 2,
  "minor_version": 0,
  "build_version": "00001",
  "splash_screen_hd": "pkg:/images/splash_hd.png",
  "splash_screen_fhd": "pkg:/images/splash_fhd.png",
  "splash_min_time": 1500,
  "ui_resolutions": "fhd",
  "bs_const": {
    "DEBUG": "false"
  },
  "mm_icon_focus_hd": "pkg:/images/icon_focus_hd.png",
  "mm_icon_focus_fhd": "pkg:/images/icon_focus_fhd.png",
  "mm_icon_side_hd": "pkg:/images/icon_side_hd.png",
  "mm_icon_side_fhd": "pkg:/images/icon_side_fhd.png"
}
```

## API Endpoints for Roku Feed

### Base URL
`https://ztvlivestream.com/api/roku` (or your deployed URL)

### Endpoints Required

#### 1. GET /api/roku/feed
Main content feed in Roku Direct Publisher format:
```json
{
  "providerName": "ZTVLIVE",
  "lastUpdated": "2026-03-10T14:00:00Z",
  "language": "en",
  "liveFeeds": [
    {
      "id": "ztvlive-main",
      "title": "ZTVLIVE 24/7",
      "shortDescription": "Non-stop trending content",
      "thumbnail": "https://ztvlivestream.com/roku/live_thumb.jpg",
      "content": {
        "dateAdded": "2026-03-10",
        "videos": [{
          "url": "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_b8b938d0c6b811eab6745b4605902bfa/index.m3u8",
          "quality": "HD",
          "videoType": "HLS"
        }]
      }
    }
  ],
  "movies": [],
  "series": [],
  "shortFormVideos": [
    {
      "id": "promo-001",
      "title": "ZTVLIVE - Create. Stream. Earn.",
      "shortDescription": "Join ZTVLIVE and get paid more",
      "thumbnail": "https://ztvlivestream.com/roku/promo_thumb.jpg",
      "releaseDate": "2026-03-10",
      "tags": ["promo", "featured"],
      "content": {
        "dateAdded": "2026-03-10",
        "videos": [{
          "url": "https://ztvlivestream.com/ztvlive_promo_premium.mp4",
          "quality": "HD",
          "videoType": "MP4"
        }],
        "duration": 12
      }
    }
  ],
  "categories": [
    {"name": "Live", "query": "live", "order": "most_recent"},
    {"name": "Trending", "query": "trending", "order": "most_popular"},
    {"name": "Sports", "query": "sports", "order": "most_recent"},
    {"name": "Music", "query": "music", "order": "most_recent"},
    {"name": "Gaming", "query": "gaming", "order": "most_recent"},
    {"name": "Podcasts", "query": "podcasts", "order": "most_recent"}
  ]
}
```

#### 2. GET /api/roku/live-status
Check if live stream is active:
```json
{
  "isLive": true,
  "streamUrl": "https://shanahan.akamaized.net/.../index.m3u8",
  "fallbackPlaylist": [
    {"url": "/ztvlive_promo_premium.mp4", "title": "ZTVLIVE Promo"},
    {"url": "/ztvlive_gaming_promo.mp4", "title": "Gaming Promo"},
    {"url": "/ztvlive_music_promo.mp4", "title": "Music Promo"}
  ],
  "currentTitle": "ZTVLIVE 24/7",
  "viewerCount": 1250
}
```

#### 3. GET /api/roku/categories/{category}
Get videos by category:
```json
{
  "category": "trending",
  "videos": [
    {
      "id": "vid-001",
      "title": "Video Title",
      "thumbnail": "https://...",
      "duration": 180,
      "url": "https://..."
    }
  ]
}
```

## SceneGraph Components

### 1. HomeScene.xml
```xml
<?xml version="1.0" encoding="utf-8" ?>
<component name="HomeScene" extends="Scene">
  <interface>
    <field id="contentLoaded" type="boolean" value="false"/>
  </interface>
  
  <children>
    <!-- Background -->
    <Rectangle id="background" width="1920" height="1080" color="#09090B"/>
    
    <!-- Header -->
    <Group id="header" translation="[60, 40]">
      <Poster id="logo" uri="pkg:/images/ztvlive_logo.png" width="200" height="50"/>
    </Group>
    
    <!-- Hero Player -->
    <Group id="heroSection" translation="[0, 120]">
      <Video id="heroVideo" width="1920" height="600"/>
      <Rectangle id="heroGradient" width="1920" height="600" color="#000000" opacity="0.5"/>
      <Label id="heroTitle" translation="[60, 450]" font="font:LargeBoldSystemFont" color="#FFFFFF"/>
      <Label id="heroSubtitle" translation="[60, 500]" font="font:MediumSystemFont" color="#A1A1AA"/>
      
      <!-- Live Badge -->
      <Group id="liveBadge" translation="[60, 140]">
        <Rectangle width="80" height="30" color="#DC2626" cornerRadius="4"/>
        <Label text="● LIVE" translation="[12, 5]" font="font:SmallBoldSystemFont" color="#FFFFFF"/>
      </Group>
    </Group>
    
    <!-- Content Rows -->
    <RowList id="contentRows" translation="[0, 740]" itemSize="[1920, 280]"/>
  </children>
  
  <script type="text/brightscript" uri="HomeScene.brs"/>
</component>
```

### 2. ContentRow.xml (Horizontal Scroller)
```xml
<?xml version="1.0" encoding="utf-8" ?>
<component name="ContentRow" extends="Group">
  <children>
    <Label id="rowTitle" translation="[60, 0]" font="font:MediumBoldSystemFont" color="#FFFFFF"/>
    <MarkupGrid id="rowContent" translation="[60, 50]" 
      itemSize="[300, 180]" 
      itemSpacing="[20, 0]" 
      numColumns="6"
      numRows="1"/>
  </children>
</component>
```

### 3. VideoCard.xml
```xml
<?xml version="1.0" encoding="utf-8" ?>
<component name="VideoCard" extends="Group">
  <interface>
    <field id="itemContent" type="node" onChange="onContentChanged"/>
  </interface>
  
  <children>
    <Rectangle id="cardBg" width="300" height="180" color="#18181B" cornerRadius="8"/>
    <Poster id="thumbnail" width="300" height="170" translation="[0, 0]"/>
    <Rectangle id="overlay" width="300" height="50" translation="[0, 130]" color="#000000" opacity="0.8"/>
    <Label id="title" translation="[10, 140]" width="280" font="font:SmallSystemFont" color="#FFFFFF"/>
    <Label id="duration" translation="[250, 10]" font="font:SmallSystemFont" color="#FFFFFF"/>
    
    <!-- Focus indicator -->
    <Rectangle id="focusBorder" width="304" height="184" translation="[-2, -2]" 
      color="#DC2626" visible="false" cornerRadius="10"/>
  </children>
</component>
```

## BrightScript Logic

### Main.brs
```brightscript
sub Main(args as Dynamic)
    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.SetMessagePort(m.port)
    
    scene = screen.CreateScene("HomeScene")
    screen.Show()
    
    ' Load content
    scene.callFunc("loadContent")
    
    while true
        msg = wait(0, m.port)
        msgType = type(msg)
        
        if msgType = "roSGScreenEvent"
            if msg.isScreenClosed()
                return
            end if
        end if
    end while
end sub
```

### HomeScene.brs
```brightscript
sub init()
    m.heroVideo = m.top.findNode("heroVideo")
    m.contentRows = m.top.findNode("contentRows")
    m.liveBadge = m.top.findNode("liveBadge")
    
    ' Set up observers
    m.top.observeField("focusedChild", "onFocusChanged")
    
    ' Check live status
    checkLiveStatus()
end sub

sub loadContent()
    ' Fetch main feed
    task = createObject("roSGNode", "ContentTask")
    task.url = "https://ztvlivestream.com/api/roku/feed"
    task.observeField("response", "onFeedLoaded")
    task.control = "run"
end sub

sub checkLiveStatus()
    task = createObject("roSGNode", "LiveStatusTask")
    task.url = "https://ztvlivestream.com/api/roku/live-status"
    task.observeField("response", "onLiveStatusLoaded")
    task.control = "run"
end sub

sub onLiveStatusLoaded(event as Object)
    response = event.getData()
    
    if response.isLive = true
        ' Play live stream
        m.heroVideo.content = createVideoNode(response.streamUrl, "ZTVLIVE 24/7 - LIVE")
        m.heroVideo.control = "play"
        m.liveBadge.visible = true
    else
        ' Play fallback playlist
        playFallbackPlaylist(response.fallbackPlaylist)
        m.liveBadge.visible = false
    end if
end sub

sub playFallbackPlaylist(playlist as Object)
    m.fallbackIndex = 0
    m.fallbackPlaylist = playlist
    playNextFallback()
end sub

sub playNextFallback()
    if m.fallbackPlaylist <> invalid AND m.fallbackPlaylist.count() > 0
        video = m.fallbackPlaylist[m.fallbackIndex]
        m.heroVideo.content = createVideoNode(video.url, video.title)
        m.heroVideo.control = "play"
        
        ' Loop to next video when current ends
        m.heroVideo.observeField("state", "onVideoStateChanged")
    end if
end sub

sub onVideoStateChanged(event as Object)
    state = event.getData()
    if state = "finished"
        m.fallbackIndex = (m.fallbackIndex + 1) MOD m.fallbackPlaylist.count()
        playNextFallback()
    end if
end sub

function createVideoNode(url as String, title as String) as Object
    videoContent = createObject("roSGNode", "ContentNode")
    videoContent.url = url
    videoContent.title = title
    videoContent.streamFormat = "mp4"
    return videoContent
end function
```

## Required Assets

### Images (Upload to Roku Developer Dashboard)
1. **Channel Icon (Focus)** - 540x405 PNG
2. **Channel Icon (Side)** - 108x81 PNG
3. **Splash Screen HD** - 1280x720 PNG
4. **Splash Screen FHD** - 1920x1080 PNG
5. **Logo** - 400x100 PNG (transparent)

### Splash Screen Design
```
┌─────────────────────────────────────────────────┐
│                                                 │
│               [ZTVLIVE LOGO]                    │
│                                                 │
│           "Never Miss A Viral Moment"           │
│                                                 │
│              [Loading Animation]                │
│                                                 │
│         ▓▓▓▓▓▓░░░░░░░░░░ Loading...            │
│                                                 │
└─────────────────────────────────────────────────┘
Background: #09090B
Logo: White with red accent
Loading bar: #DC2626
```

## Fallback Behavior (When Not Broadcasting)

1. **Primary**: Check if HLS stream is active via `/api/roku/live-status`
2. **If offline**: Loop through promo videos:
   - ztvlive_promo_premium.mp4 (12s)
   - ztvlive_gaming_promo.mp4 (8s)
   - ztvlive_music_promo.mp4 (8s)
   - ztvlive_podcast_promo.mp4 (8s)
3. **Show "Coming Soon" overlay** with next broadcast time
4. **Display content library** for on-demand viewing

## Deep Linking Support
```brightscript
' Handle deep links from Roku search
sub handleDeepLink(args as Object)
    if args.contentId <> invalid
        ' Play specific content
        playContent(args.contentId)
    else if args.mediaType = "live"
        ' Jump to live stream
        playLiveStream()
    end if
end sub
```

## Analytics Integration
```brightscript
' Track viewing events
sub trackEvent(eventName as String, params as Object)
    ' Send to your analytics endpoint
    task = createObject("roSGNode", "AnalyticsTask")
    task.url = "https://ztvlivestream.com/api/analytics/roku"
    task.eventName = eventName
    task.params = params
    task.control = "run"
end sub
```

## Testing Checklist
- [ ] Channel launches without errors
- [ ] Live stream plays when broadcasting
- [ ] Fallback playlist loops when offline
- [ ] Navigation works with remote (up/down/left/right/OK/back)
- [ ] Video playback controls work (play/pause/seek)
- [ ] Categories load content correctly
- [ ] Deep links work from Roku search
- [ ] Channel icons display correctly in store

## Deployment Steps
1. Package channel using Roku Developer tools
2. Upload to Roku Developer Dashboard
3. Submit for certification
4. Once approved, publish to Channel Store

---
© ZTVLIVE 2026 - Compete with the Best
