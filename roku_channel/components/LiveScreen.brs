' ============================================
' LiveScreen.brs - Fullscreen Video Player
' ============================================

sub init()
    m.videoPlayer = m.top.findNode("videoPlayer")
    m.errorOverlay = m.top.findNode("errorOverlay")
    m.controlsOverlay = m.top.findNode("controlsOverlay")
    m.playPauseIcon = m.top.findNode("playPauseIcon")
    m.progressFill = m.top.findNode("progressFill")
    
    m.isPlaying = false
    m.controlsVisible = false
    
    ' Auto-hide timer for controls
    m.hideTimer = CreateObject("roSGNode", "Timer")
    m.hideTimer.duration = 4
    m.hideTimer.observeField("fire", "hideControls")
    
    playVideoStream()
    m.top.videoReady = true
    
    print "LiveScreen: Fullscreen player initialized"
end sub

sub playVideoStream()
    if m.videoPlayer = invalid then return
    
    ' Fetch live stream URL from API
    m.streamTask = CreateObject("roSGNode", "ApiTask")
    m.streamTask.endpoint = "/tv/sync"
    m.streamTask.observeField("response", "onStreamUrlLoaded")
    m.streamTask.control = "run"
    
    print "LiveScreen: Fetching live stream URL from API"
end sub

sub onStreamUrlLoaded()
    if m.streamTask = invalid or m.streamTask.response = invalid then
        print "LiveScreen: Failed to get stream URL, using fallback"
        playFallbackStream()
        return
    end if
    
    response = m.streamTask.response
    videoUrl = response.video_url
    
    ' Check if it's a YouTube embed URL - Roku can't play these directly
    if videoUrl <> invalid and videoUrl.instr("youtube.com/embed/") >= 0
        print "LiveScreen: YouTube URL detected, using HLS fallback"
        playFallbackStream()
        return
    end if
    
    if videoUrl <> invalid and videoUrl <> ""
        playStream(videoUrl)
    else
        playFallbackStream()
    end if
end sub

sub playFallbackStream()
    videoUrl = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_4b7189d06d5211eb981d29252a61de03/index.m3u8"
    playStream(videoUrl)
end sub

sub playStream(videoUrl as string)
    if m.videoPlayer = invalid then return
    
    content = CreateObject("roSGNode", "ContentNode")
    content.url = videoUrl
    content.streamFormat = "hls"
    content.live = true
    
    m.videoPlayer.content = content
    m.videoPlayer.control = "play"
    m.videoPlayer.mute = false
    m.isPlaying = true
    
    if m.playPauseIcon <> invalid
        m.playPauseIcon.text = "❚❚"
    end if
    
    if m.errorOverlay <> invalid
        m.errorOverlay.visible = false
    end if
    
    m.videoPlayer.observeField("state", "onPlayerStateChange")
    
    print "LiveScreen: Video stream started with URL: " + videoUrl
end sub

sub onPlayerStateChange()
    state = m.videoPlayer.state
    print "LiveScreen: Player state = " + state
    
    if state = "error"
        if m.errorOverlay <> invalid then m.errorOverlay.visible = true
    else if state = "playing"
        m.isPlaying = true
        if m.playPauseIcon <> invalid
            m.playPauseIcon.text = "❚❚"
        end if
    else if state = "paused"
        m.isPlaying = false
        if m.playPauseIcon <> invalid
            m.playPauseIcon.text = "▶"
        end if
    end if
end sub

sub showControls()
    if m.controlsOverlay <> invalid
        m.controlsOverlay.visible = true
        m.controlsVisible = true
    end if
    
    ' Reset hide timer
    m.hideTimer.control = "stop"
    m.hideTimer.control = "start"
end sub

sub hideControls()
    if m.controlsOverlay <> invalid
        m.controlsOverlay.visible = false
        m.controlsVisible = false
    end if
end sub

function handleKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    
    print "LiveScreen: Key=" + key
    
    ' Show controls on any key
    showControls()
    
    if key = "OK" or key = "play"
        if m.isPlaying
            m.videoPlayer.control = "pause"
            m.isPlaying = false
        else
            m.videoPlayer.control = "resume"
            m.isPlaying = true
        end if
        return true
    end if
    
    if key = "replay"
        playVideoStream()
        return true
    end if
    
    if key = "left" or key = "back"
        ' Let parent handle - return to previous screen
        return false
    end if
    
    if key = "up" or key = "down" or key = "right"
        ' Consume but don't do anything (keep in fullscreen)
        return true
    end if
    
    return false
end function

function onKeyEvent(key as string, press as boolean) as boolean
    return handleKeyEvent(key, press)
end function
