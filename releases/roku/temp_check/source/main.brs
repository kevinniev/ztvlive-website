' ============================================
' ZTVLIVE ROKU CHANNEL - MAIN ENTRY POINT
' ============================================
' 24/7 Live Streaming Platform with Interactive Game Show
' API Base: https://best-bites-live.preview.emergentagent.com/api

sub main(args as dynamic)
    screen = CreateObject("roSGScreen")
    m.port = CreateObject("roMessagePort")
    screen.setMessagePort(m.port)
    
    ' Create the main scene
    scene = screen.CreateScene("MainScene")
    screen.show()
    
    ' Handle deep linking if launched with content
    if args.contentId <> invalid
        scene.deepLinkContentId = args.contentId
    end if
    if args.mediaType <> invalid
        scene.deepLinkMediaType = args.mediaType
    end if
    
    ' Main message loop
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
