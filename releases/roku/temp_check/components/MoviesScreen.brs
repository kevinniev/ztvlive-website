' ============================================
' MoviesScreen.brs - Netflix-style Movies layout
' ============================================

sub init()
    m.heroVideo = m.top.findNode("heroVideo")
    m.heroFocus = m.top.findNode("heroFocus")
    m.playBtnBg = m.top.findNode("playBtnBg")
    
    m.trendPosters = []
    m.trendFocuses = []
    for i = 0 to 5
        m.trendPosters.push(m.top.findNode("trendPoster" + i.toStr()))
        m.trendFocuses.push(m.top.findNode("trendFocus" + i.toStr()))
    end for
    
    ' Focus state: 0=hero, 1=trending row
    m.focusArea = 0
    m.trendIndex = 0
    
    updateFocusVisuals()
    startHeroVideo()
    loadContent()
    
    print "MoviesScreen: Netflix-style initialized"
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
end sub

sub loadContent()
    m.feedTask = CreateObject("roSGNode", "ApiTask")
    m.feedTask.endpoint = "/roku-feed/"
    m.feedTask.observeField("response", "onFeedLoaded")
    m.feedTask.control = "run"
end sub

sub onFeedLoaded()
    feed = m.feedTask.response
    if feed <> invalid and feed.shortFormVideos <> invalid
        items = feed.shortFormVideos
        for i = 0 to 5
            if i < items.count() and m.trendPosters[i] <> invalid
                item = items[i]
                if item.thumbnail <> invalid
                    if type(item.thumbnail) = "roAssociativeArray"
                        m.trendPosters[i].uri = item.thumbnail.url
                    else
                        m.trendPosters[i].uri = item.thumbnail
                    end if
                end if
            end if
        end for
    end if
    m.top.contentLoaded = true
end sub

sub updateFocusVisuals()
    ' Hero focus
    if m.heroFocus <> invalid
        m.heroFocus.visible = (m.focusArea = 0)
    end if
    
    ' Play button highlight
    if m.playBtnBg <> invalid
        if m.focusArea = 0
            m.playBtnBg.color = "#FFFFFF"
        else
            m.playBtnBg.color = "#AAAAAA"
        end if
    end if
    
    ' Trending focuses
    for i = 0 to 5
        if m.trendFocuses[i] <> invalid
            m.trendFocuses[i].visible = (m.focusArea = 1 and m.trendIndex = i)
        end if
    end for
end sub

function handleKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    
    print "MoviesScreen: Key=" + key + " area=" + m.focusArea.toStr()
    
    if m.focusArea = 0
        ' Hero focused
        if key = "down"
            m.focusArea = 1
            m.trendIndex = 0
            updateFocusVisuals()
            return true
        else if key = "OK"
            m.top.goToLive = true
            return true
        else if key = "left"
            return false
        end if
    else
        ' Trending row
        if key = "up"
            m.focusArea = 0
            updateFocusVisuals()
            return true
        else if key = "left"
            if m.trendIndex > 0
                m.trendIndex = m.trendIndex - 1
                updateFocusVisuals()
            else
                return false
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
