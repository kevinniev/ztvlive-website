' ============================================
' MainScene.brs - v7.1 Clean Logo and Navigation
' Fixed: Better category navigation, stable transitions
' ============================================

sub init()
    m.splashScreen = m.top.findNode("splashScreen")
    m.splashScreen.observeField("introComplete", "onIntroComplete")
    
    m.mainApp = m.top.findNode("mainApp")
    m.sidebar = m.top.findNode("sidebar")
    m.headerBar = m.top.findNode("headerBar")
    m.contentArea = m.top.findNode("contentArea")
    m.loadingGroup = m.top.findNode("loadingGroup")
    
    ' Category elements (backgrounds, accents, text)
    m.catBgs = []
    m.catAccents = []
    m.catTexts = []
    for i = 0 to 5
        m.catBgs.push(m.top.findNode("catBg" + i.toStr()))
        m.catAccents.push(m.top.findNode("catAccent" + i.toStr()))
        m.catTexts.push(m.top.findNode("catText" + i.toStr()))
    end for
    
    m.categoryNames = ["music", "movies", "sports", "news", "schedule", "game"]
    
    m.categoryIndex = 0
    m.focusOnSidebar = true
    m.currentScreen = invalid
    m.introComplete = false
    m.isFullscreen = false
    
    m.top.setFocus(true)
    
    print "MainScene v7.1 - Clean Logo and Navigation Initialized"
end sub

sub onIntroComplete()
    print "MainScene: Intro complete"
    
    m.splashScreen.visible = false
    m.mainApp.visible = true
    m.introComplete = true
    
    updateSidebarVisuals()
    loadContent("music")
end sub

sub updateSidebarVisuals()
    ' Hide/show UI based on fullscreen
    if m.sidebar <> invalid
        m.sidebar.visible = not m.isFullscreen
    end if
    if m.headerBar <> invalid
        m.headerBar.visible = not m.isFullscreen
    end if
    
    ' Adjust content area (80px header in v5.8)
    if m.contentArea <> invalid
        if m.isFullscreen
            m.contentArea.translation = [0, 0]
        else
            m.contentArea.translation = [220, 80]
        end if
    end if
    
    ' Update category styling
    for i = 0 to 5
        if m.catBgs[i] <> invalid
            if i = m.categoryIndex
                m.catBgs[i].color = "#E50914"
            else
                m.catBgs[i].color = "#0D0D0D"
            end if
        end if
        
        if m.catAccents[i] <> invalid
            if i = m.categoryIndex
                m.catAccents[i].visible = true
                m.catAccents[i].color = "#E50914"
            else
                m.catAccents[i].visible = false
            end if
        end if
        
        if m.catTexts[i] <> invalid
            if i = m.categoryIndex
                m.catTexts[i].color = "#FFFFFF"
            else
                m.catTexts[i].color = "#666666"
            end if
        end if
    end for
end sub

sub loadContent(category as string)
    print "MainScene: Loading - " + category
    m.top.currentPage = category
    m.loadingGroup.visible = true
    
    stopAllVideos()
    
    while m.contentArea.getChildCount() > 0
        m.contentArea.removeChild(m.contentArea.getChild(0))
    end while
    
    screen = invalid
    if category = "music"
        screen = CreateObject("roSGNode", "HomeScreen")
        screen.category = category
        screen.observeField("contentLoaded", "onContentLoaded")
        screen.observeField("goToLive", "onGoToLive")
    else if category = "movies"
        screen = CreateObject("roSGNode", "MoviesScreen")
        screen.observeField("contentLoaded", "onContentLoaded")
        screen.observeField("goToLive", "onGoToLive")
    else if category = "sports"
        screen = CreateObject("roSGNode", "SportsScreen")
        screen.observeField("contentLoaded", "onContentLoaded")
        screen.observeField("goToLive", "onGoToLive")
    else if category = "news"
        screen = CreateObject("roSGNode", "NewsScreen")
        screen.observeField("contentLoaded", "onContentLoaded")
        screen.observeField("goToLive", "onGoToLive")
    else if category = "schedule"
        screen = CreateObject("roSGNode", "ScheduleScreen")
        screen.observeField("scheduleLoaded", "onContentLoaded")
    else if category = "game"
        screen = CreateObject("roSGNode", "GameScreen")
        screen.observeField("gameLoaded", "onContentLoaded")
    end if
    
    if screen <> invalid
        m.contentArea.appendChild(screen)
        m.currentScreen = screen
    end if
end sub

sub stopAllVideos()
    if m.currentScreen = invalid then return
    
    videoNodes = ["heroVideo", "videoPlayer", "sportsVideo", "newsVideo", "gameVideo", "movieVideo"]
    for each nodeName in videoNodes
        video = m.currentScreen.findNode(nodeName)
        if video <> invalid then video.control = "stop"
    end for
end sub

sub onContentLoaded()
    m.loadingGroup.visible = false
end sub

sub onGoToLive()
    print "MainScene: Entering fullscreen"
    
    stopAllVideos()
    
    while m.contentArea.getChildCount() > 0
        m.contentArea.removeChild(m.contentArea.getChild(0))
    end while
    
    m.isFullscreen = true
    m.focusOnSidebar = false
    updateSidebarVisuals()
    
    screen = CreateObject("roSGNode", "LiveScreen")
    screen.observeField("videoReady", "onContentLoaded")
    m.contentArea.appendChild(screen)
    m.currentScreen = screen
    
    m.top.currentPage = "live"
end sub

sub exitFullscreen()
    print "MainScene: Exiting fullscreen"
    
    m.isFullscreen = false
    m.focusOnSidebar = true
    updateSidebarVisuals()
    
    loadContent(m.categoryNames[m.categoryIndex])
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    
    if not m.introComplete
        if key = "OK" or key = "play" or key = "right"
            return true
        end if
        return true
    end if
    
    print "MainScene: Key=" + key + " fullscreen=" + m.isFullscreen.toStr()
    
    if m.isFullscreen
        if key = "left" or key = "back"
            exitFullscreen()
            return true
        else
            if m.currentScreen <> invalid
                handled = m.currentScreen.callFunc("handleKeyEvent", key, press)
                if handled = true then return true
            end if
        end if
        return true
    end if
    
    if m.focusOnSidebar
        if key = "up"
            if m.categoryIndex > 0
                m.categoryIndex = m.categoryIndex - 1
                updateSidebarVisuals()
                loadContent(m.categoryNames[m.categoryIndex])
            end if
            return true
        else if key = "down"
            if m.categoryIndex < 5
                m.categoryIndex = m.categoryIndex + 1
                updateSidebarVisuals()
                loadContent(m.categoryNames[m.categoryIndex])
            end if
            return true
        else if key = "right" or key = "OK"
            m.focusOnSidebar = false
            updateSidebarVisuals()
            return true
        end if
    else
        if key = "left"
            if m.currentScreen <> invalid
                handled = m.currentScreen.callFunc("handleKeyEvent", key, press)
                if handled = true then return true
            end if
            m.focusOnSidebar = true
            updateSidebarVisuals()
            return true
        else if key = "back"
            m.focusOnSidebar = true
            updateSidebarVisuals()
            return true
        else
            if m.currentScreen <> invalid
                handled = m.currentScreen.callFunc("handleKeyEvent", key, press)
                if handled = true then return true
            end if
        end if
    end if
    
    return false
end function
