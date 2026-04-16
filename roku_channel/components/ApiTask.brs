' ============================================
' ApiTask.brs - Background Task for API Calls (v2.3)
' Supports configurable base URL and proper HTTPS
' ============================================

sub init()
    m.top.functionName = "executeRequest"
end sub

sub executeRequest()
    endpoint = m.top.endpoint
    method = m.top.method
    body = m.top.body
    
    ' Use the base URL from interface field, fallback to production
    baseUrl = m.top.baseUrl
    if baseUrl = invalid or baseUrl = ""
        baseUrl = "https://www.ztvlivestream.com/api"
    end if
    
    url = baseUrl + endpoint
    
    print "ApiTask: Fetching " + url
    
    http = CreateObject("roUrlTransfer")
    http.SetUrl(url)
    
    ' CRITICAL: Set certificates for HTTPS
    http.SetCertificatesFile("common:/certs/ca-bundle.crt")
    http.InitClientCertificates()
    
    http.AddHeader("Content-Type", "application/json")
    http.AddHeader("Accept", "application/json")
    
    ' Make synchronous request
    response = ""
    
    if method = "POST"
        response = http.PostFromString(body)
    else
        response = http.GetToString()
    end if
    
    print "ApiTask: Response length = " + len(response).toStr()
    
    ' Check if we got a response
    if response <> invalid and len(response) > 0
        parsed = ParseJson(response)
        if parsed <> invalid
            m.top.response = parsed
            print "ApiTask: Success - data parsed"
        else
            m.top.error = "Failed to parse JSON"
            m.top.response = { error: true, message: "Parse error" }
            print "ApiTask: JSON parse error"
        end if
    else
        m.top.error = "No response"
        m.top.response = { error: true, message: "No response from server" }
        print "ApiTask: No response received"
    end if
end sub
