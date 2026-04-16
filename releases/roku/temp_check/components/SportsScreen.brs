' ============================================
' SportsScreen.brs - ESPN-style Sports layout
' ============================================

sub init()
    m.sportsVideo = m.top.findNode("sportsVideo")
    m.featuredFocus = m.top.findNode("featuredFocus")
    
    ' Up next items
    m.upFocuses = []
    m.upPosters = []
    for i = 0 to 3
        m.upFocuses.push(m.top.findNode("upFocus" + i.toStr()))
        m.upPosters.push(m.top.findNode("upPoster" + i.toStr()))
    end for
    
    ' Highlights
    m.hlFocuses = []
    m.hlPosters = []
    for i = 0 to 3
        m.hlFocuses.push(m.top.findNode("hlFocus" + i.toStr()))
        m.hlPosters.push(m.top.findNode("hlPoster" + i.toStr()))
    end for
    
    ' Focus: 0=featured, 1=upcoming, 2=highlights
    m.focusArea = 0
    m.upIndex = 0
    m.hlIndex = 0
    
    updateFocusVisuals()
    startVideo()
    loadContent()
    
    print "SportsScreen: ESPN-style initialized"
end sub

sub startVideo()
    if m.sportsVideo = invalid then return
    
    videoUrl = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_4b7189d06d5211eb981d29252a61de03/index.m3u8"
    
    content = CreateObject("roSGNode", "ContentNode")
    content.url = videoUrl
    content.streamFormat = "hls"
    content.live = true
    
    m.sportsVideo.content = content
    m.sportsVideo.control = "play"
    m.sportsVideo.mute = false
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
        ' Load up next posters
        for i = 0 to 3
            if i < items.count() and m.upPosters[i] <> invalid
                item = items[i]
                if item.thumbnail <> invalid
                    if type(item.thumbnail) = "roAssociativeArray"
                        m.upPosters[i].uri = item.thumbnail.url
                    else
                        m.upPosters[i].uri = item.thumbnail
                    end if
                end if
            end if
        end for
        ' Load highlight posters
        for i = 0 to 3
            idx = 4 + i
            if idx < items.count() and m.hlPosters[i] <> invalid
                item = items[idx]
                if item.thumbnail <> invalid
                    if type(item.thumbnail) = "roAssociativeArray"
                        m.hlPosters[i].uri = item.thumbnail.url
                    else
                        m.hlPosters[i].uri = item.thumbnail
                    end if
                end if
            end if
        end for
    end if
    m.top.contentLoaded = true
end sub

sub updateFocusVisuals()
    if m.featuredFocus <> invalid
        m.featuredFocus.visible = (m.focusArea = 0)
    end if
    
    for i = 0 to 3
        if m.upFocuses[i] <> invalid
            m.upFocuses[i].visible = (m.focusArea = 1 and m.upIndex = i)
        end if
        if m.hlFocuses[i] <> invalid
            m.hlFocuses[i].visible = (m.focusArea = 2 and m.hlIndex = i)
        end if
    end for
end sub

function handleKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    
    print "SportsScreen: Key=" + key + " area=" + m.focusArea.toStr()
    
    if m.focusArea = 0
        if key = "right"
            m.focusArea = 1
            m.upIndex = 0
            updateFocusVisuals()
            return true
        else if key = "down"
            m.focusArea = 2
            m.hlIndex = 0
            updateFocusVisuals()
            return true
        else if key = "OK"
            m.top.goToLive = true
            return true
        else if key = "left"
            return false
        end if
    else if m.focusArea = 1
        if key = "left"
            m.focusArea = 0
            updateFocusVisuals()
            return true
        else if key = "down"
            if m.upIndex < 3
                m.upIndex = m.upIndex + 1
                updateFocusVisuals()
            else
                m.focusArea = 2
                m.hlIndex = 0
                updateFocusVisuals()
            end if
            return true
        else if key = "up"
            if m.upIndex > 0
                m.upIndex = m.upIndex - 1
                updateFocusVisuals()
            end if
            return true
        else if key = "OK"
            m.top.goToLive = true
            return true
        end if
    else
        if key = "up"
            m.focusArea = 0
            updateFocusVisuals()
            return true
        else if key = "left"
            if m.hlIndex > 0
                m.hlIndex = m.hlIndex - 1
                updateFocusVisuals()
            else
                return false
            end if
            return true
        else if key = "right"
            if m.hlIndex < 3
                m.hlIndex = m.hlIndex + 1
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
