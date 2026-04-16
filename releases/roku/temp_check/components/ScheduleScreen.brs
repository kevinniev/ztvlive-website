' ============================================
' ScheduleScreen.brs - Premium schedule layout
' ============================================

sub init()
    m.itemFocuses = []
    m.itemPosters = []
    m.itemBgs = []
    
    for i = 0 to 4
        m.itemFocuses.push(m.top.findNode("itemFocus" + i.toStr()))
        m.itemPosters.push(m.top.findNode("itemPoster" + i.toStr()))
        m.itemBgs.push(m.top.findNode("itemBg" + i.toStr()))
    end for
    
    m.currentItem = 0
    
    updateFocus()
    loadScheduleData()
    updateLastUpdated()
    
    print "ScheduleScreen: Premium layout initialized"
end sub

sub updateFocus()
    for i = 0 to 4
        if m.itemFocuses[i] <> invalid
            m.itemFocuses[i].visible = (i = m.currentItem)
        end if
        if m.itemBgs[i] <> invalid
            if i = m.currentItem
                m.itemBgs[i].color = "#E5091430"
            else if i = 0
                m.itemBgs[i].color = "#E5091420"
            else
                m.itemBgs[i].color = "#1A1A1A"
            end if
        end if
    end for
end sub

sub loadScheduleData()
    m.feedTask = CreateObject("roSGNode", "ApiTask")
    m.feedTask.endpoint = "/roku-feed/"
    m.feedTask.observeField("response", "onFeedLoaded")
    m.feedTask.control = "run"
end sub

sub onFeedLoaded()
    feed = m.feedTask.response
    if feed <> invalid and feed.shortFormVideos <> invalid
        items = feed.shortFormVideos
        for i = 0 to 4
            if i < items.count() and m.itemPosters[i] <> invalid
                item = items[i]
                if item.thumbnail <> invalid
                    if type(item.thumbnail) = "roAssociativeArray"
                        m.itemPosters[i].uri = item.thumbnail.url
                    else
                        m.itemPosters[i].uri = item.thumbnail
                    end if
                end if
            end if
        end for
    end if
    m.top.scheduleLoaded = true
end sub

sub updateLastUpdated()
    dt = CreateObject("roDateTime")
    dt.ToLocalTime()
    m.top.findNode("lastUpdated").text = "Last updated: Just now"
    
    ' Update date label with current date
    dateLabel = m.top.findNode("dateLabel")
    if dateLabel <> invalid
        months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        monthName = months[dt.GetMonth() - 1]
        dateLabel.text = "Today, " + monthName + " " + dt.GetYear().toStr()
    end if
end sub

function handleKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    
    print "ScheduleScreen: Key=" + key
    
    if key = "down"
        if m.currentItem < 4
            m.currentItem = m.currentItem + 1
            updateFocus()
        end if
        return true
    else if key = "up"
        if m.currentItem > 0
            m.currentItem = m.currentItem - 1
            updateFocus()
            return true
        else
            return false
        end if
    else if key = "left"
        return false
    else if key = "OK"
        updateLastUpdated()
        loadScheduleData()
        return true
    end if
    
    return false
end function

function onKeyEvent(key as string, press as boolean) as boolean
    return handleKeyEvent(key, press)
end function
