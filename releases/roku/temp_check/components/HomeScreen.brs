' ============================================
' HomeScreen.brs - Professional Samsung-style Layout
' NOW PLAYING hero + thumbnails + trending row
' ============================================

sub init()
    m.heroVideo = m.top.findNode("heroVideo")
    m.heroFocus = m.top.findNode("heroFocus")
    m.nowPlayingLabel = m.top.findNode("nowPlayingLabel")
    m.trendingLabel = m.top.findNode("trendingLabel")
    
    ' Thumbnail posters and focus indicators
    m.thumbPosters = []
    m.thumbFocuses = []
    for i = 0 to 3
        m.thumbPosters.push(m.top.findNode("poster" + i.toStr()))
        m.thumbFocuses.push(m.top.findNode("focus" + i.toStr()))
    end for
    
    ' Trending posters and focus indicators
    m.trendPosters = []
    m.trendFocuses = []
    for i = 0 to 5
        m.trendPosters.push(m.top.findNode("trendPoster" + i.toStr()))
        m.trendFocuses.push(m.top.findNode("trendFocus" + i.toStr()))
    end for
    
    ' Focus state: 0=hero, 1=thumbs, 2=trending
    m.focusArea = 0
    m.thumbIndex = 0  ' 0-3 for 2x2 grid
    m.trendIndex = 0  ' 0-5 for trending row
    
    updateFocusVisuals()
    loadFeedData()
    startHeroVideo()
    
    print "HomeScreen: Professional layout initialized"
end sub

sub startHeroVideo()
    if m.heroVideo = invalid then return
    
    videoUrl = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_4b7189d06d5211eb981d29252a61de03/index.m3u8"
    
    content = CreateObject("roSGNode", "ContentNode")
    content.url = videoUrl
    content.streamFormat = "hls"
    content.live = true
    
    m.heroVideo.content = content
    m.heroVideo.control = "play"
    m.heroVideo.mute = false
    
    print "HomeScreen: Hero video started"
end sub

sub loadFeedData()
    m.feedTask = CreateObject("roSGNode", "ApiTask")
    m.feedTask.endpoint = "/roku-feed/"
    m.feedTask.observeField("response", "onFeedLoaded")
    m.feedTask.control = "run"
end sub

sub onFeedLoaded()
    feed = m.feedTask.response
    
    if feed <> invalid and feed.error = invalid and feed.shortFormVideos <> invalid
        items = feed.shortFormVideos
        
        ' Load thumbnails (first 4)
        for i = 0 to 3
            if i < items.count() and m.thumbPosters[i] <> invalid
                item = items[i]
                if item.thumbnail <> invalid
                    if type(item.thumbnail) = "roAssociativeArray"
                        m.thumbPosters[i].uri = item.thumbnail.url
                    else
                        m.thumbPosters[i].uri = item.thumbnail
                    end if
                end if
            end if
        end for
        
        ' Load trending (items 4-9)
        for i = 0 to 5
            idx = 4 + i
            if idx < items.count() and m.trendPosters[i] <> invalid
                item = items[idx]
                if item.thumbnail <> invalid
                    if type(item.thumbnail) = "roAssociativeArray"
                        m.trendPosters[i].uri = item.thumbnail.url
                    else
                        m.trendPosters[i].uri = item.thumbnail
                    end if
                end if
            end if
        end for
        
        print "HomeScreen: Feed loaded - " + items.count().toStr() + " items"
    end if
    
    m.top.contentLoaded = true
end sub

sub updateFocusVisuals()
    ' Hero focus
    if m.heroFocus <> invalid
        m.heroFocus.visible = (m.focusArea = 0)
    end if
    
    ' Thumbnail focuses
    for i = 0 to 3
        if m.thumbFocuses[i] <> invalid
            m.thumbFocuses[i].visible = (m.focusArea = 1 and m.thumbIndex = i)
        end if
    end for
    
    ' Trending focuses
    for i = 0 to 5
        if m.trendFocuses[i] <> invalid
            m.trendFocuses[i].visible = (m.focusArea = 2 and m.trendIndex = i)
        end if
    end for
end sub

function handleKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    
    print "HomeScreen: Key=" + key + " area=" + m.focusArea.toStr()
    
    if m.focusArea = 0
        ' Hero is focused
        if key = "down"
            m.focusArea = 2  ' Jump to trending
            m.trendIndex = 0
            updateFocusVisuals()
            return true
        else if key = "right"
            m.focusArea = 1  ' Move to thumbnails
            m.thumbIndex = 0
            updateFocusVisuals()
            return true
        else if key = "OK"
            ' Go to fullscreen live
            if m.heroVideo <> invalid
                m.heroVideo.control = "stop"
            end if
            m.top.goToLive = true
            return true
        else if key = "left"
            return false  ' Let parent handle
        end if
    else if m.focusArea = 1
        ' Thumbnails focused (2x2 grid)
        if key = "up"
            if m.thumbIndex >= 2
                m.thumbIndex = m.thumbIndex - 2
                updateFocusVisuals()
            else
                m.focusArea = 0
                updateFocusVisuals()
            end if
            return true
        else if key = "down"
            if m.thumbIndex < 2
                m.thumbIndex = m.thumbIndex + 2
                updateFocusVisuals()
            else
                m.focusArea = 2
                m.trendIndex = 0
                updateFocusVisuals()
            end if
            return true
        else if key = "left"
            if m.thumbIndex = 1 or m.thumbIndex = 3
                m.thumbIndex = m.thumbIndex - 1
                updateFocusVisuals()
            else
                m.focusArea = 0
                updateFocusVisuals()
            end if
            return true
        else if key = "right"
            if m.thumbIndex = 0 or m.thumbIndex = 2
                m.thumbIndex = m.thumbIndex + 1
                updateFocusVisuals()
            end if
            return true
        else if key = "OK"
            m.top.goToLive = true
            return true
        end if
    else if m.focusArea = 2
        ' Trending row focused
        if key = "up"
            m.focusArea = 0
            updateFocusVisuals()
            return true
        else if key = "left"
            if m.trendIndex > 0
                m.trendIndex = m.trendIndex - 1
                updateFocusVisuals()
            else
                return false  ' Let parent handle
            end if
            return true
        else if key = "right"
            if m.trendIndex < 5
                m.trendIndex = m.trendIndex + 1
                updateFocusVisuals()
            end if
            return true
        else if key = "OK"
            m.top.goToLive = true
            return true
        end if
    end if
    
    return false
end function

function onKeyEvent(key as string, press as boolean) as boolean
    return handleKeyEvent(key, press)
end function
