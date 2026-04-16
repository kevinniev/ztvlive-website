' ============================================
' ApiHelper.brs - ZTVLIVE API Integration (v2.1)
' ============================================
' All API calls to the ZTVLIVE backend
' Base URL is configurable, defaults to production

sub init()
    m.baseUrl = "https://www.ztvlivestream.com/api"
end sub

' Set custom base URL (useful for dev/staging)
sub setBaseUrl(url as string)
    m.baseUrl = url
end sub

' Get the API base URL
function getBaseUrl() as string
    return m.baseUrl
end function

' ============================================
' CONTENT FEED APIs
' ============================================

' Get main Roku content feed
function getFeed() as object
    url = getBaseUrl() + "/roku-feed/"
    return httpGet(url)
end function

' Get live streams
function getLiveFeeds() as object
    url = getBaseUrl() + "/roku-feed/live"
    return httpGet(url)
end function

' Get content by category
function getContentByCategory(category as string) as object
    url = getBaseUrl() + "/roku-feed/content/" + category
    return httpGet(url)
end function

' ============================================
' LIVE TV SYNC APIs
' ============================================

' Get current TV sync (what's playing now)
function getTvSync() as object
    url = getBaseUrl() + "/tv/sync"
    return httpGet(url)
end function

' ============================================
' GAME/SURVEY APIs
' ============================================

' Get current game state
function getGameState() as object
    url = getBaseUrl() + "/live-survey/state"
    return httpGet(url)
end function

' Submit an answer
function submitAnswer(answer as string, playerId as string) as object
    url = getBaseUrl() + "/live-survey/answer"
    body = {
        "answer": answer,
        "player_id": playerId
    }
    return httpPost(url, body)
end function

' Join the game
function joinGame(playerName as string) as object
    url = getBaseUrl() + "/live-survey/join"
    body = {
        "player_name": playerName
    }
    return httpPost(url, body)
end function

' Get leaderboard
function getLeaderboard() as object
    url = getBaseUrl() + "/live-survey/leaderboard"
    return httpGet(url)
end function

' ============================================
' SCHEDULE APIs
' ============================================

' Get weekly schedule
function getSchedule() as object
    url = getBaseUrl() + "/roku-feed/schedule"
    return httpGet(url)
end function

' ============================================
' TRANSLATION APIs
' ============================================

' Get UI strings for a language
function getUiStrings(lang as string) as object
    url = getBaseUrl() + "/translation/ui/" + lang
    return httpGet(url)
end function

' Get supported languages
function getLanguages() as object
    url = getBaseUrl() + "/translation/languages"
    return httpGet(url)
end function

' ============================================
' HTTP HELPER FUNCTIONS
' ============================================

function httpGet(url as string) as object
    http = CreateObject("roUrlTransfer")
    http.SetUrl(url)
    
    ' IMPORTANT: Set certificates for HTTPS
    http.SetCertificatesFile("common:/certs/ca-bundle.crt")
    http.InitClientCertificates()
    
    http.AddHeader("Content-Type", "application/json")
    http.AddHeader("Accept", "application/json")
    http.SetPort(CreateObject("roMessagePort"))
    
    ' Enable cookies for session management
    http.EnableCookies()
    
    ' Make the request
    if http.AsyncGetToString()
        event = wait(10000, http.GetPort())
        if type(event) = "roUrlEvent"
            statusCode = event.GetResponseCode()
            response = event.GetString()
            
            if statusCode = 200
                parsed = ParseJson(response)
                if parsed <> invalid
                    return parsed
                else
                    return { error: true, message: "Failed to parse JSON response" }
                end if
            else
                return { error: true, statusCode: statusCode, message: "HTTP " + statusCode.toStr() }
            end if
        end if
    end if
    
    return { error: true, message: "Request timeout or network error" }
end function

function httpPost(url as string, body as object) as object
    http = CreateObject("roUrlTransfer")
    http.SetUrl(url)
    
    ' IMPORTANT: Set certificates for HTTPS
    http.SetCertificatesFile("common:/certs/ca-bundle.crt")
    http.InitClientCertificates()
    
    http.AddHeader("Content-Type", "application/json")
    http.AddHeader("Accept", "application/json")
    http.SetPort(CreateObject("roMessagePort"))
    http.SetRequest("POST")
    
    ' Convert body to JSON
    jsonBody = FormatJson(body)
    
    ' Make the request
    if http.AsyncPostFromString(jsonBody)
        event = wait(10000, http.GetPort())
        if type(event) = "roUrlEvent"
            statusCode = event.GetResponseCode()
            response = event.GetString()
            
            if statusCode = 200 or statusCode = 201
                parsed = ParseJson(response)
                if parsed <> invalid
                    return parsed
                else
                    return { error: true, message: "Failed to parse JSON response" }
                end if
            else
                return { error: true, statusCode: statusCode, message: "HTTP " + statusCode.toStr() }
            end if
        end if
    end if
    
    return { error: true, message: "Request timeout or network error" }
end function
