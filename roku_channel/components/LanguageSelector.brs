' ============================================
' LanguageSelector.brs - Multi-language Support (FIXED v2.1)
' ============================================

sub init()
    m.langButton = m.top.findNode("langButton")
    m.langDropdown = m.top.findNode("langDropdown")
    m.langList = m.top.findNode("langList")
    m.currentLangLabel = m.top.findNode("currentLangLabel")
    
    if m.langButton <> invalid
        m.langButton.observeField("buttonSelected", "onLangButtonPressed")
    end if
    
    ' Define supported languages (simplified for Roku compatibility)
    m.languages = [
        { code: "en", name: "English" },
        { code: "es", name: "Espanol" },
        { code: "fr", name: "Francais" },
        { code: "de", name: "Deutsch" },
        { code: "pt", name: "Portugues" },
        { code: "zh", name: "Chinese" },
        { code: "ja", name: "Japanese" },
        { code: "ko", name: "Korean" }
    ]
    
    m.langIndex = 0
    m.dropdownOpen = false
    
    ' Load saved preference
    loadSavedLanguage()
end sub

sub onLangButtonPressed()
    ' Simple toggle through languages instead of dropdown
    m.langIndex = (m.langIndex + 1) mod m.languages.count()
    selectLanguage(m.langIndex)
end sub

sub selectLanguage(index as integer)
    if index >= 0 and index < m.languages.count()
        m.langIndex = index
        lang = m.languages[index]
        
        m.top.selectedLang = lang.code
        m.top.selectedLangName = lang.name
        
        if m.currentLangLabel <> invalid
            m.currentLangLabel.text = ucase(lang.code)
        end if
        
        ' Save preference
        saveLanguagePreference(lang.code)
        
        print "LanguageSelector: Changed to " + lang.name
    end if
end sub

sub saveLanguagePreference(langCode as string)
    sec = CreateObject("roRegistrySection", "ZTVLIVE")
    sec.Write("language", langCode)
    sec.Flush()
end sub

sub loadSavedLanguage()
    sec = CreateObject("roRegistrySection", "ZTVLIVE")
    savedLang = sec.Read("language")
    
    if savedLang <> ""
        for i = 0 to m.languages.count() - 1
            if m.languages[i].code = savedLang
                selectLanguage(i)
                exit for
            end if
        end for
    end if
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    return false
end function
