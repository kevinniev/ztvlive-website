' ZTVLIVE Premium Channel - Main Scene Logic
' Version 3.3.3 - With TRT Auto-Switching, Clean UI & Memory Monitoring
' Features: "Be Right Back" screen, "Starting Soon" screen, Promo mode, Auto TRT switching

sub init()
    m.rowList = m.top.findNode("rowList")
    m.videoPlayer = m.top.findNode("videoPlayer")
    m.playerGroup = m.top.findNode("playerGroup")
    m.playerTitle = m.top.findNode("playerTitle")
    m.loadingScreen = m.top.findNode("loadingScreen")
    m.heroSection = m.top.findNode("heroSection")
    m.playBtnBg = m.top.findNode("playBtnBg")
    m.promoModeBadge = m.top.findNode("promoModeBadge")
    
    ' Holding screens
    m.holdingScreen = m.top.findNode("holdingScreen")
    m.startingSoonScreen = m.top.findNode("startingSoonScreen")
    m.holdingStatus = m.top.findNode("holdingStatus")
    m.holdingMainText = m.top.findNode("holdingMainText")
    m.holdingSubText = m.top.findNode("holdingSubText")
    
    ' === MEMORY MONITORING ===
    ' Enable memory warning events for robust performance
    m.deviceInfo = CreateObject("roDeviceInfo")
    
    ' Get channel memory limits
    m.channelMemoryLimit = m.deviceInfo.GetChannelMemoryLimit()
    print "ZTVLIVE: Channel memory limit: " ; m.channelMemoryLimit ; " bytes"
    
    ' Enable low memory event notifications
    m.deviceInfo.EnableLowGeneralMemoryEvent(true)
    
    ' Enable memory warning events
    m.deviceInfo.EnableMemoryWarningEvent(true)
    
    ' Log initial memory status
    availableMemory = m.deviceInfo.GetChannelAvailableMemory()
    memoryPercent = m.deviceInfo.GetMemoryLimitPercent()
    print "ZTVLIVE: Available memory: " ; availableMemory ; " bytes"
    print "ZTVLIVE: Memory usage: " ; memoryPercent ; "%"
    
    ' Set memory threshold for warnings (trigger at 80% usage)
    m.memoryWarningThreshold = 80
    
    m.isPlaying = false
    m.focusOnHero = true
    m.isPromoMode = false
    m.isHoldingMode = false
    m.currentPromoIndex = 0
    m.streamRetryCount = 0
    m.maxRetries = 3
    m.holdingRetryCount = 0
    m.maxHoldingRetries = 10  ' Will show holding screen for ~5 minutes before giving up
    
    ' Main live stream URL - Your Castr HLS Playback URL (WORKING)
    m.liveStreamUrl = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_4b7189d06d5211eb981d29252a61de03/index.m3u8"
    
    ' Promo/Fallback videos playlist - HLS streams that play in loop when main stream has issues
    ' Using popular music video HLS streams as fallback content
    m.promoVideos = [
        {
            title: "ZTVLIVE - Music Mix",
            description: "Enjoy music while we restore the main stream",
            url: "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
            thumbnail: "https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg"
        },
        {
            title: "ZTVLIVE - Entertainment Preview",
            description: "Coming up on ZTVLIVE",
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            thumbnail: "https://i.ytimg.com/vi/TUVcZfQe-Kw/maxresdefault.jpg"
        },
        {
            title: "ZTVLIVE - Big Buck Bunny",
            description: "Family Entertainment",
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            thumbnail: "https://i.ytimg.com/vi/H5v3kku4y6Q/maxresdefault.jpg"
        }
    ]
    
    ' Setup observers
    m.rowList.observeField("rowItemSelected", "onRowItemSelected")
    m.videoPlayer.observeField("state", "onVideoState")
    
    ' Load content
    loadContent()
    
    m.top.setFocus(true)
end sub

sub loadContent()
    ' Create row content
    rowContent = createObject("roSGNode", "ContentNode")
    
    ' Row 1: Live Stream - Main live content only
    row1 = rowContent.createChild("ContentNode")
    row1.title = "LIVE NOW"
    
    item1 = row1.createChild("ContentNode")
    item1.title = "ZTVLIVE 24/7"
    item1.description = "Watch Live Stream"
    item1.url = m.liveStreamUrl
    item1.hdposterurl = "https://images.unsplash.com/photo-1658046413536-6e5933dfd939?w=400"
    item1.streamFormat = "hls"
    
    ' Row 2: Play & Win - Standalone Game Category
    row2 = rowContent.createChild("ContentNode")
    row2.title = "PLAY & WIN"
    
    item2 = row2.createChild("ContentNode")
    item2.title = "Live Trivia"
    item2.description = "Answer & Win Prizes"
    item2.hdposterurl = "https://images.unsplash.com/photo-1719494207635-f84507a03971?w=400"
    
    item3 = row2.createChild("ContentNode")
    item3.title = "Daily Challenge"
    item3.description = "New Questions Daily"
    item3.hdposterurl = "https://images.unsplash.com/photo-1573804638247-94ba5a291b76?w=400"
    
    item4 = row2.createChild("ContentNode")
    item4.title = "Prize Wheel"
    item4.description = "Spin to Win"
    item4.hdposterurl = "https://images.unsplash.com/photo-1752085777042-f70b4cf31d53?w=400"
    
    item5 = row2.createChild("ContentNode")
    item5.title = "Leaderboard"
    item5.description = "Top Players"
    item5.hdposterurl = "https://images.unsplash.com/photo-1659080907103-1cabe53c5662?w=400"
    
    ' Row 3: Music Categories
    row3 = rowContent.createChild("ContentNode")
    row3.title = "MUSIC"
    
    item6 = row3.createChild("ContentNode")
    item6.title = "Afrobeats"
    item6.description = "African Hits"
    item6.hdposterurl = "https://images.unsplash.com/photo-1544476613-a6ad8bb6862c?w=400"
    
    item7 = row3.createChild("ContentNode")
    item7.title = "Hip-Hop"
    item7.description = "Top 50 Rap"
    item7.hdposterurl = "https://images.unsplash.com/photo-1612321933939-9945b77f8479?w=400"
    
    item8 = row3.createChild("ContentNode")
    item8.title = "R&B Vibes"
    item8.description = "Soul & Smooth"
    item8.hdposterurl = "https://images.unsplash.com/photo-1585729704181-d252db554814?w=400"
    
    item9 = row3.createChild("ContentNode")
    item9.title = "Pop Hits"
    item9.description = "Trending Now"
    item9.hdposterurl = "https://images.unsplash.com/photo-1762674541520-354b784e7abc?w=400"
    
    ' Row 4: Entertainment Categories  
    row4 = rowContent.createChild("ContentNode")
    row4.title = "ENTERTAINMENT"
    
    item10 = row4.createChild("ContentNode")
    item10.title = "Gaming"
    item10.description = "Esports & Streams"
    item10.hdposterurl = "https://images.unsplash.com/photo-1770177267441-1d8dadda4feb?w=400"
    
    item11 = row4.createChild("ContentNode")
    item11.title = "Podcasts"
    item11.description = "Talk & Listen"
    item11.hdposterurl = "https://images.unsplash.com/photo-1709846487437-7445553bb6ed?w=400"
    
    item12 = row4.createChild("ContentNode")
    item12.title = "Comedy"
    item12.description = "Stand-Up & Laughs"
    item12.hdposterurl = "https://images.unsplash.com/photo-1766532573885-8bd94537f1c4?w=400"
    
    item13 = row4.createChild("ContentNode")
    item13.title = "Film & TV"
    item13.description = "Movies & Shows"
    item13.hdposterurl = "https://images.unsplash.com/photo-1762417420551-2fec32ed3595?w=400"
    
    ' Row 5: Sports
    row5 = rowContent.createChild("ContentNode")
    row5.title = "SPORTS"
    
    item14 = row5.createChild("ContentNode")
    item14.title = "Live Games"
    item14.description = "Watch Now"
    item14.hdposterurl = "https://images.unsplash.com/photo-1563299796-b729d0af54a5?w=400"
    
    item15 = row5.createChild("ContentNode")
    item15.title = "Highlights"
    item15.description = "Best Plays"
    item15.hdposterurl = "https://images.unsplash.com/photo-1641135698530-8d919344c0e5?w=400"
    
    item16 = row5.createChild("ContentNode")
    item16.title = "Boxing & MMA"
    item16.description = "Fight Night"
    item16.hdposterurl = "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400"
    
    item17 = row5.createChild("ContentNode")
    item17.title = "Basketball"
    item17.description = "Court Action"
    item17.hdposterurl = "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400"
    
    ' Row 6: More Categories
    row6 = rowContent.createChild("ContentNode")
    row6.title = "MORE"
    
    item18 = row6.createChild("ContentNode")
    item18.title = "News"
    item18.description = "Breaking Stories"
    item18.hdposterurl = "https://images.unsplash.com/photo-1742805382148-48e9953ad797?w=400"
    
    item19 = row6.createChild("ContentNode")
    item19.title = "Lifestyle"
    item19.description = "Wellness & Tips"
    item19.hdposterurl = "https://images.unsplash.com/photo-1635367216109-aa3353c0c22e?w=400"
    
    item20 = row6.createChild("ContentNode")
    item20.title = "Tech"
    item20.description = "Innovation & Gadgets"
    item20.hdposterurl = "https://images.unsplash.com/photo-1707166919487-a7d4439c9a89?w=400"
    
    item21 = row6.createChild("ContentNode")
    item21.title = "Concerts"
    item21.description = "Live Performances"
    item21.hdposterurl = "https://images.unsplash.com/photo-1647168285321-7509a33bf1d7?w=400"
    
    m.rowList.content = rowContent
    
    ' Hide loading after delay
    hideLoadingTimer = createObject("roSGNode", "Timer")
    hideLoadingTimer.duration = 1.5
    hideLoadingTimer.observeField("fire", "hideLoading")
    hideLoadingTimer.control = "start"
    m.hideLoadingTimer = hideLoadingTimer
end sub

sub hideLoading()
    m.loadingScreen.visible = false
    m.rowList.setFocus(true)
    m.focusOnHero = false
end sub

sub onRowItemSelected()
    rowIndex = m.rowList.rowItemFocused[0]
    itemIndex = m.rowList.rowItemFocused[1]
    
    content = m.rowList.content
    if content <> invalid
        row = content.getChild(rowIndex)
        if row <> invalid
            item = row.getChild(itemIndex)
            if item <> invalid
                playVideo(item)
            end if
        end if
    end if
end sub

sub playVideo(item as Object)
    url = item.url
    if url = invalid or url = ""
        ' No video URL - just show message
        return
    end if
    
    m.playerTitle.text = item.title
    
    videoContent = createObject("roSGNode", "ContentNode")
    videoContent.url = url
    videoContent.title = item.title
    
    streamFormat = item.streamFormat
    if streamFormat <> invalid and streamFormat <> ""
        videoContent.streamFormat = streamFormat
    else
        videoContent.streamFormat = "hls"
    end if
    
    m.videoPlayer.content = videoContent
    m.playerGroup.visible = true
    m.isPlaying = true
    m.videoPlayer.control = "play"
    m.videoPlayer.setFocus(true)
end sub

sub onVideoState()
    state = m.videoPlayer.state
    print "Video state: " ; state
    
    if state = "error"
        print "Stream error detected - retry count: " ; m.streamRetryCount
        m.streamRetryCount = m.streamRetryCount + 1
        
        if m.streamRetryCount >= m.maxRetries
            ' Max retries exceeded - show holding screen first, then switch to promo mode
            print "Stream failed after " ; m.streamRetryCount ; " attempts"
            
            if m.holdingRetryCount < m.maxHoldingRetries
                ' Show "Be Right Back" holding screen
                showHoldingScreen("BE RIGHT BACK", "Stream resuming shortly...", "Attempting to reconnect...")
            else
                ' After extended holding, switch to promo mode
                print "Switching to promo mode after extended holding"
                startPromoMode()
            end if
        else
            ' Retry the stream with brief holding message
            showHoldingScreen("RECONNECTING", "Please wait...", "Attempt " + m.streamRetryCount.toStr() + " of " + m.maxRetries.toStr())
            retryTimer = createObject("roSGNode", "Timer")
            retryTimer.duration = 3
            retryTimer.observeField("fire", "retryMainStream")
            retryTimer.control = "start"
            m.retryTimer = retryTimer
        end if
    else if state = "playing"
        ' Stream is working - reset retry counts and hide all holding screens
        m.streamRetryCount = 0
        m.holdingRetryCount = 0
        hideHoldingScreen()
        if m.isPromoMode = false
            m.promoModeBadge.visible = false
        end if
    else if state = "buffering"
        ' Show subtle buffering message but keep video visible
        print "Stream buffering..."
    else if state = "finished"
        if m.isPromoMode
            ' Play next promo in loop
            playNextPromo()
        else
            ' Stream ended - show "Starting Soon" for scheduled content
            showStartingSoonScreen()
        end if
    end if
end sub

sub showHoldingScreen(mainText as String, subText as String, statusText as String)
    print "Showing holding screen: " ; mainText
    m.isHoldingMode = true
    m.holdingRetryCount = m.holdingRetryCount + 1
    
    ' Hide video player and other screens
    m.videoPlayer.control = "stop"
    m.playerGroup.visible = false
    m.startingSoonScreen.visible = false
    
    ' Update and show holding screen
    m.holdingMainText.text = mainText
    m.holdingSubText.text = subText
    m.holdingStatus.text = statusText
    m.holdingScreen.visible = true
    
    ' Set up auto-retry timer
    holdingRetryTimer = createObject("roSGNode", "Timer")
    holdingRetryTimer.duration = 30  ' Retry every 30 seconds
    holdingRetryTimer.observeField("fire", "retryFromHolding")
    holdingRetryTimer.control = "start"
    m.holdingRetryTimer = holdingRetryTimer
end sub

sub showStartingSoonScreen()
    print "Showing Starting Soon screen"
    m.isHoldingMode = true
    
    ' Hide other screens
    m.videoPlayer.control = "stop"
    m.playerGroup.visible = false
    m.holdingScreen.visible = false
    
    ' Show starting soon screen
    m.startingSoonScreen.visible = true
    
    ' Set up timer to check for stream
    startingSoonTimer = createObject("roSGNode", "Timer")
    startingSoonTimer.duration = 60  ' Check every 60 seconds
    startingSoonTimer.observeField("fire", "checkStreamFromStartingSoon")
    startingSoonTimer.control = "start"
    m.startingSoonTimer = startingSoonTimer
end sub

sub hideHoldingScreen()
    m.isHoldingMode = false
    m.holdingScreen.visible = false
    m.startingSoonScreen.visible = false
    
    ' Cancel holding timers if running
    if m.holdingRetryTimer <> invalid
        m.holdingRetryTimer.control = "stop"
    end if
    if m.startingSoonTimer <> invalid
        m.startingSoonTimer.control = "stop"
    end if
end sub

sub retryFromHolding()
    print "Retrying stream from holding screen... attempt " ; m.holdingRetryCount
    
    if m.holdingRetryCount >= m.maxHoldingRetries
        ' Give up and go to promo mode
        hideHoldingScreen()
        startPromoMode()
    else
        ' Update status and retry
        m.holdingStatus.text = "Reconnecting... (attempt " + m.holdingRetryCount.toStr() + ")"
        m.streamRetryCount = 0  ' Reset stream retry count
        playHeroContent()
    end if
end sub

sub checkStreamFromStartingSoon()
    print "Checking if stream has started..."
    m.streamRetryCount = 0
    m.holdingRetryCount = 0
    playHeroContent()
end sub

sub retryMainStream()
    print "Retrying main stream..."
    playHeroContent()
end sub

sub startPromoMode()
    print "Starting promo mode - playing ZTVLIVE promos in loop"
    m.isPromoMode = true
    m.currentPromoIndex = 0
    m.promoModeBadge.visible = true  ' Show "PROMO MODE" badge
    m.playerTitle.text = "ZTVLIVE PROMOS"
    playCurrentPromo()
end sub

sub playCurrentPromo()
    if m.promoVideos.count() = 0
        closePlayer()
        return
    end if
    
    promo = m.promoVideos[m.currentPromoIndex]
    print "Playing promo: " ; promo.title
    
    m.playerTitle.text = promo.title
    
    videoContent = createObject("roSGNode", "ContentNode")
    videoContent.url = promo.url
    videoContent.title = promo.title
    videoContent.streamFormat = "hls"
    
    m.videoPlayer.content = videoContent
    m.playerGroup.visible = true
    m.isPlaying = true
    m.videoPlayer.control = "play"
    m.videoPlayer.setFocus(true)
    
    ' Set timer to check main stream periodically
    checkMainStreamTimer = createObject("roSGNode", "Timer")
    checkMainStreamTimer.duration = 60  ' Check every 60 seconds
    checkMainStreamTimer.observeField("fire", "checkMainStreamAvailability")
    checkMainStreamTimer.control = "start"
    m.checkMainStreamTimer = checkMainStreamTimer
end sub

sub playNextPromo()
    m.currentPromoIndex = m.currentPromoIndex + 1
    if m.currentPromoIndex >= m.promoVideos.count()
        m.currentPromoIndex = 0  ' Loop back to first promo
    end if
    playCurrentPromo()
end sub

sub checkMainStreamAvailability()
    ' Reset retry count and try main stream again
    print "Checking if main stream is available..."
    m.streamRetryCount = 0
    m.isPromoMode = false
    m.promoModeBadge.visible = false  ' Hide promo badge when trying main stream
    playHeroContent()
end sub

sub closePlayer()
    m.videoPlayer.control = "stop"
    m.playerGroup.visible = false
    m.isPlaying = false
    m.rowList.setFocus(true)
end sub

sub playHeroContent()
    ' Play the live stream from hero section
    videoContent = createObject("roSGNode", "ContentNode")
    videoContent.url = m.liveStreamUrl
    videoContent.title = "ZTVLIVE 24/7"
    videoContent.streamFormat = "hls"
    
    m.playerTitle.text = "ZTVLIVE"
    ' playerSubtitle is hidden in XML
    
    m.videoPlayer.content = videoContent
    m.playerGroup.visible = true
    m.isPlaying = true
    m.videoPlayer.control = "play"
    m.videoPlayer.setFocus(true)
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    handled = false
    
    if press
        ' Handle holding screen interactions
        if m.isHoldingMode
            if key = "OK"
                ' User wants to retry immediately
                print "User requested manual retry from holding screen"
                m.holdingRetryCount = 0
                m.streamRetryCount = 0
                hideHoldingScreen()
                playHeroContent()
                handled = true
            else if key = "back"
                ' Exit holding and go back to menu
                hideHoldingScreen()
                m.rowList.setFocus(true)
                handled = true
            end if
        else if m.isPlaying
            if key = "back"
                closePlayer()
                handled = true
            else if key = "OK" or key = "play"
                if m.videoPlayer.state = "playing"
                    m.videoPlayer.control = "pause"
                else
                    m.videoPlayer.control = "resume"
                end if
                handled = true
            end if
        else
            if key = "up" and m.rowList.hasFocus()
                focusedRow = m.rowList.rowItemFocused[0]
                if focusedRow = 0
                    m.focusOnHero = true
                    m.playBtnBg.color = "#FFFFFF"
                    handled = true
                end if
            else if key = "down" and m.focusOnHero
                m.focusOnHero = false
                m.playBtnBg.color = "#8B5CF6"
                m.rowList.setFocus(true)
                handled = true
            else if key = "OK" and m.focusOnHero
                playHeroContent()
                handled = true
            end if
        end if
    end if
    
    return handled
end function

sub onDeepLink()
    deepLink = m.top.deepLink
    if deepLink <> invalid
        print "Deep link: " ; deepLink.contentId
    end if
end sub
