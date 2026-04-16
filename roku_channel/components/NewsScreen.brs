' ============================================
' NewsScreen.brs - CNN-style News layout
' ============================================

sub init()
    m.newsVideo = m.top.findNode("newsVideo")
    m.featuredFocus = m.top.findNode("featuredFocus")
    
    ' Story list
    m.storyFocuses = []
    m.storyPosters = []
    for i = 0 to 2
        m.storyFocuses.push(m.top.findNode("storyFocus" + i.toStr()))
        m.storyPosters.push(m.top.findNode("storyPoster" + i.toStr()))
    end for
    
    ' Category buttons
    m.catFocuses = []
    m.catBgs = []
    for i = 0 to 5
        m.catFocuses.push(m.top.findNode("catFocus" + i.toStr()))
        m.catBgs.push(m.top.findNode("catBg" + i.toStr()))
    end for
    
    ' More stories
    m.moreFocuses = []
    m.morePosters = []
    for i = 0 to 3
        m.moreFocuses.push(m.top.findNode("moreFocus" + i.toStr()))
        m.morePosters.push(m.top.findNode("morePoster" + i.toStr()))
    end for
    
    ' Focus: 0=featured, 1=stories, 2=categories, 3=more
    m.focusArea = 0
    m.storyIndex = 0
    m.catIndex = 0
    m.moreIndex = 0
    
    updateFocusVisuals()
    startVideo()
    loadContent()
    
    print "NewsScreen: CNN-style initialized"
end sub

sub startVideo()
    if m.newsVideo = invalid then return
    
    videoUrl = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_4b7189d06d5211eb981d29252a61de03/index.m3u8"
    
    content = CreateObject("roSGNode", "ContentNode")
    content.url = videoUrl
    content.streamFormat = "hls"
    content.live = true
    
    m.newsVideo.content = content
    m.newsVideo.control = "play"
    m.newsVideo.mute = false
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
        ' Load story posters
        for i = 0 to 2
            if i < items.count() and m.storyPosters[i] <> invalid
                item = items[i]
                if item.thumbnail <> invalid
                    if type(item.thumbnail) = "roAssociativeArray"
                        m.storyPosters[i].uri = item.thumbnail.url
                    else
                        m.storyPosters[i].uri = item.thumbnail
                    end if
                end if
            end if
        end for
        ' Load more posters
        for i = 0 to 3
            idx = 3 + i
            if idx < items.count() and m.morePosters[i] <> invalid
                item = items[idx]
                if item.thumbnail <> invalid
                    if type(item.thumbnail) = "roAssociativeArray"
                        m.morePosters[i].uri = item.thumbnail.url
                    else
                        m.morePosters[i].uri = item.thumbnail
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
    
    for i = 0 to 2
        if m.storyFocuses[i] <> invalid
            m.storyFocuses[i].visible = (m.focusArea = 1 and m.storyIndex = i)
        end if
    end for
    
    for i = 0 to 5
        if m.catFocuses[i] <> invalid
            m.catFocuses[i].visible = (m.focusArea = 2 and m.catIndex = i)
        end if
        if m.catBgs[i] <> invalid
            if m.focusArea = 2 and m.catIndex = i
                m.catBgs[i].color = "#CC0000"
            else
                m.catBgs[i].color = "#333333"
            end if
        end if
    end for
    
    for i = 0 to 3
        if m.moreFocuses[i] <> invalid
            m.moreFocuses[i].visible = (m.focusArea = 3 and m.moreIndex = i)
        end if
    end for
end sub

function handleKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    
    print "NewsScreen: Key=" + key + " area=" + m.focusArea.toStr()
    
    if m.focusArea = 0
        if key = "right"
            m.focusArea = 1
            m.storyIndex = 0
            updateFocusVisuals()
            return true
        else if key = "down"
            m.focusArea = 2
            m.catIndex = 0
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
            if m.storyIndex < 2
                m.storyIndex = m.storyIndex + 1
                updateFocusVisuals()
            else
                m.focusArea = 2
                m.catIndex = 0
                updateFocusVisuals()
            end if
            return true
        else if key = "up"
            if m.storyIndex > 0
                m.storyIndex = m.storyIndex - 1
                updateFocusVisuals()
            end if
            return true
        else if key = "OK"
            m.top.goToLive = true
            return true
        end if
    else if m.focusArea = 2
        if key = "up"
            m.focusArea = 0
            updateFocusVisuals()
            return true
        else if key = "down"
            m.focusArea = 3
            m.moreIndex = 0
            updateFocusVisuals()
            return true
        else if key = "left"
            if m.catIndex > 0
                m.catIndex = m.catIndex - 1
                updateFocusVisuals()
            else
                return false
            end if
            return true
        else if key = "right"
            if m.catIndex < 5
                m.catIndex = m.catIndex + 1
                updateFocusVisuals()
            end if
            return true
        else if key = "OK"
            return true
        end if
    else
        if key = "up"
            m.focusArea = 2
            updateFocusVisuals()
            return true
        else if key = "left"
            if m.moreIndex > 0
                m.moreIndex = m.moreIndex - 1
                updateFocusVisuals()
            else
                return false
            end if
            return true
        else if key = "right"
            if m.moreIndex < 3
                m.moreIndex = m.moreIndex + 1
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
