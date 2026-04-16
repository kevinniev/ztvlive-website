' ============================================
' SplashScreen.brs - v6.6 Better Centered + Bigger Zoom
' Premium cinematic flow
' ============================================

sub init()
    m.bg = m.top.findNode("bg")
    m.logoImage = m.top.findNode("logoImage")
    m.textLine1 = m.top.findNode("textLine1")
    m.textLine2 = m.top.findNode("textLine2")
    
    ' Voice-over
    m.voiceOver = CreateObject("roSGNode", "Audio")
    m.voiceOver.content = CreateObject("roSGNode", "ContentNode")
    m.voiceOver.content.url = "pkg:/audio/intro_vo.mp3"
    m.top.appendChild(m.voiceOver)
    
    ' Animation timer (60fps for ultra smooth)
    m.animTimer = CreateObject("roSGNode", "Timer")
    m.animTimer.repeat = true
    m.animTimer.duration = 0.016  ' ~60fps
    m.animTimer.observeField("fire", "onAnimTick")
    
    m.frameCount = 0
    m.totalFrames = 300  ' 5 seconds at 60fps
    m.voPlayed = false
    
    ' Center coordinates for 1920x1080
    m.centerX = 960
    m.centerY = 540
    
    ' Logo dimensions
    m.logoW = 1920
    m.logoH = 1080
    
    m.animTimer.control = "start"
    
    print "SplashScreen v6.6: Better centered + bigger zoom"
end sub

' Ultra smooth easing
function easeOutExpo(t as float) as float
    if t >= 1.0
        return 1.0
    else
        return 1.0 - (2.0 ^ (-10.0 * t))
    end if
end function

function easeOutQuart(t as float) as float
    t = 1.0 - t
    return 1.0 - (t * t * t * t)
end function

function easeInOutCubic(t as float) as float
    if t < 0.5
        return 4.0 * t * t * t
    else
        p = -2.0 * t + 2.0
        return 1.0 - (p * p * p) / 2.0
    end if
end function

sub onAnimTick()
    m.frameCount = m.frameCount + 1
    
    if m.frameCount >= m.totalFrames
        m.animTimer.control = "stop"
        m.top.introComplete = true
        return
    end if
    
    ' ===== PREMIUM CINEMATIC TIMELINE =====
    ' Logo starts at 0.4x scale (smaller start = more dramatic zoom)
    ' Zooms to 1.05x (slightly bigger than full = impactful)
    ' Then settles to 1.0x
    
    ' === LOGO ZOOM (frames 0-180) ===
    if m.frameCount <= 180
        zoomProgress = m.frameCount / 180.0
        ease = easeOutExpo(zoomProgress)
        
        ' Zoom from 0.4x to 1.05x, then ease back to 1.0x
        if zoomProgress < 0.8
            ' Main zoom: 0.4 to 1.05
            subProgress = zoomProgress / 0.8
            scale = 0.4 + (0.65 * easeOutExpo(subProgress))
        else
            ' Settle: 1.05 to 1.0
            subProgress = (zoomProgress - 0.8) / 0.2
            scale = 1.05 - (0.05 * subProgress)
        end if
        
        m.logoImage.scale = [scale, scale]
        
        ' Keep PERFECTLY centered during zoom
        scaledW = m.logoW * scale
        scaledH = m.logoH * scale
        offsetX = (1920 - scaledW) / 2
        offsetY = (1080 - scaledH) / 2
        m.logoImage.translation = [offsetX, offsetY]
        
        ' Fade in (first 60 frames)
        if m.frameCount <= 60
            m.logoImage.opacity = m.frameCount / 60.0
        else
            m.logoImage.opacity = 1.0
        end if
    else
        ' Hold at final position
        m.logoImage.scale = [1.0, 1.0]
        m.logoImage.translation = [0, 0]
        m.logoImage.opacity = 1.0
    end if
    
    ' === VOICE-OVER at frame 50 ===
    if not m.voPlayed and m.frameCount = 50
        m.voiceOver.control = "play"
        m.voPlayed = true
    end if
    
    ' === TEXT (frames 70-150) ===
    if m.frameCount >= 70 and m.frameCount <= 150
        textProgress = (m.frameCount - 70) / 80.0
        if textProgress > 1.0 then textProgress = 1.0
        
        ease = easeOutQuart(textProgress)
        
        ' "THE WORLD IS" - centered, floats up
        m.textLine1.opacity = ease
        text1Y = 750 - (30 * ease)  ' 750 to 720
        m.textLine1.translation = [0, text1Y]
        
        ' "WATCHING" - slight delay
        delay = 0.12
        delayedProgress = textProgress - delay
        if delayedProgress < 0 then delayedProgress = 0
        if delayedProgress > 1.0 then delayedProgress = 1.0
        
        ease2 = easeOutQuart(delayedProgress)
        m.textLine2.opacity = ease2
        text2Y = 830 - (30 * ease2)  ' 830 to 800
        m.textLine2.translation = [0, text2Y]
    end if
    
    ' === HOLD (frames 150-240) ===
    if m.frameCount >= 150 and m.frameCount < 240
        m.textLine1.opacity = 1.0
        m.textLine1.translation = [0, 720]
        m.textLine2.opacity = 1.0
        m.textLine2.translation = [0, 800]
    end if
    
    ' === FADE OUT (frames 240-300) ===
    if m.frameCount >= 240
        fadeProgress = (m.frameCount - 240) / 60.0
        if fadeProgress > 1.0 then fadeProgress = 1.0
        
        fadeOut = 1.0 - easeInOutCubic(fadeProgress)
        
        m.logoImage.opacity = fadeOut
        m.textLine1.opacity = fadeOut
        m.textLine2.opacity = fadeOut
    end if
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if press
        if key = "OK" or key = "play" or key = "right"
            m.animTimer.control = "stop"
            m.voiceOver.control = "stop"
            m.top.introComplete = true
            return true
        end if
    end if
    return false
end function
