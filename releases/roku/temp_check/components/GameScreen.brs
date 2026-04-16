' ============================================
' GameScreen.brs - v7.0 Web-Style Layout
' Synced with backend, matches LiveSurveyOverlay
' ============================================

sub init()
    ' UI Elements
    m.questionText = m.top.findNode("questionText")
    m.scoreDisplay = m.top.findNode("scoreDisplay")
    m.playersDisplay = m.top.findNode("playersDisplay")
    m.timerDisplay = m.top.findNode("timerDisplay")
    m.timerProgress = m.top.findNode("timerProgress")
    m.gameEndTimer = m.top.findNode("gameEndTimer")
    m.answersCount = m.top.findNode("answersCount")
    m.answerText = m.top.findNode("answerText")
    m.groupCodeText = m.top.findNode("groupCodeText")
    m.kbInputText = m.top.findNode("kbInputText")
    
    ' Overlays
    m.keyboardOverlay = m.top.findNode("keyboardOverlay")
    m.resultsSection = m.top.findNode("resultsSection")
    
    ' Focus elements
    m.codeInputFocus = m.top.findNode("codeInputFocus")
    m.joinBtnFocus = m.top.findNode("joinBtnFocus")
    m.createBtnFocus = m.top.findNode("createBtnFocus")
    m.answerInputFocus = m.top.findNode("answerInputFocus")
    m.sendBtnFocus = m.top.findNode("sendBtnFocus")
    
    ' Top answers
    m.ans1Text = m.top.findNode("ans1Text")
    m.ans1Count = m.top.findNode("ans1Count")
    m.ans1Bar = m.top.findNode("ans1Bar")
    m.ans2Text = m.top.findNode("ans2Text")
    m.ans2Count = m.top.findNode("ans2Count")
    m.ans2Bar = m.top.findNode("ans2Bar")
    m.ans3Text = m.top.findNode("ans3Text")
    m.ans3Count = m.top.findNode("ans3Count")
    m.ans3Bar = m.top.findNode("ans3Bar")
    m.ans4Text = m.top.findNode("ans4Text")
    m.ans4Count = m.top.findNode("ans4Count")
    m.ans4Bar = m.top.findNode("ans4Bar")
    
    ' Navigation grid [row][col]
    m.focusGrid = [
        ["codeInput", "joinBtn", "createBtn"],
        ["answerInput", "sendBtn"]
    ]
    m.focusRow = 1  ' Start on answer input
    m.focusCol = 0
    
    ' State
    m.playerScore = 0
    m.userAnswer = ""
    m.groupCode = ""
    m.uiMode = "normal"  ' normal, keyboard_answer, keyboard_code
    m.inputTarget = "answer"  ' answer or code
    
    ' Keyboard
    m.kbRows = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["Z", "X", "C", "V", "B", "N", "M"],
        ["SPACE", "DEL", "SEND"]
    ]
    m.kbRow = 0
    m.kbCol = 0
    
    ' Timers synced with backend
    m.questionTimeRemaining = 30
    m.gameTimeRemaining = 600
    m.maxQuestionTime = 30
    
    buildKeyboard()
    updateFocusVisuals()
    startTimers()
    syncWithBackend()
    
    print "GameScreen v7.0: Web-style layout initialized"
end sub

sub buildKeyboard()
    keySize = 90
    spacing = 100
    
    row1 = m.top.findNode("kbRow1")
    for i = 0 to 9
        createKey(row1, m.kbRows[0][i], i * spacing, 0, keySize, "kb_0_" + i.toStr())
    end for
    
    row2 = m.top.findNode("kbRow2")
    for i = 0 to 8
        createKey(row2, m.kbRows[1][i], i * spacing, 0, keySize, "kb_1_" + i.toStr())
    end for
    
    row3 = m.top.findNode("kbRow3")
    for i = 0 to 6
        createKey(row3, m.kbRows[2][i], i * spacing, 0, keySize, "kb_2_" + i.toStr())
    end for
    
    row4 = m.top.findNode("kbRow4")
    createKey(row4, "SPACE", 0, 0, 350, "kb_3_0")
    createKey(row4, "DEL", 370, 0, 150, "kb_3_1")
    createKey(row4, "SEND", 540, 0, 180, "kb_3_2")
end sub

sub createKey(parent as object, text as string, x as integer, y as integer, width as integer, id as string)
    group = CreateObject("roSGNode", "Group")
    group.id = id
    group.translation = [x, y]
    
    bg = CreateObject("roSGNode", "Rectangle")
    bg.id = id + "_bg"
    bg.width = width
    bg.height = 55
    bg.color = "#333344"
    group.appendChild(bg)
    
    label = CreateObject("roSGNode", "Label")
    label.text = text
    label.font = "font:SmallBoldSystemFont"
    label.color = "#FFFFFF"
    label.width = width
    label.height = 55
    label.horizAlign = "center"
    label.vertAlign = "center"
    group.appendChild(label)
    
    focus = CreateObject("roSGNode", "Rectangle")
    focus.id = id + "_focus"
    focus.width = width
    focus.height = 4
    focus.color = "#9C27B0"
    focus.translation = [0, 51]
    focus.visible = false
    group.appendChild(focus)
    
    parent.appendChild(group)
end sub

sub startTimers()
    ' Question timer (every second)
    m.questionTimer = CreateObject("roSGNode", "Timer")
    m.questionTimer.repeat = true
    m.questionTimer.duration = 1
    m.questionTimer.observeField("fire", "onQuestionTick")
    m.questionTimer.control = "start"
    
    ' Sync timer (every 5 seconds)
    m.syncTimer = CreateObject("roSGNode", "Timer")
    m.syncTimer.repeat = true
    m.syncTimer.duration = 5
    m.syncTimer.observeField("fire", "syncWithBackend")
    m.syncTimer.control = "start"
end sub

sub onQuestionTick()
    m.questionTimeRemaining = m.questionTimeRemaining - 1
    m.gameTimeRemaining = m.gameTimeRemaining - 1
    
    if m.questionTimeRemaining < 0
        m.questionTimeRemaining = m.maxQuestionTime
    end if
    
    if m.gameTimeRemaining < 0
        m.gameTimeRemaining = 600
    end if
    
    ' Update timer display
    if m.timerDisplay <> invalid
        m.timerDisplay.text = m.questionTimeRemaining.toStr() + "s"
        if m.questionTimeRemaining <= 10
            m.timerDisplay.color = "#FF4444"
        else
            m.timerDisplay.color = "#FFFFFF"
        end if
    end if
    
    ' Update progress bar
    if m.timerProgress <> invalid
        progressWidth = int((m.questionTimeRemaining / m.maxQuestionTime) * 800)
        m.timerProgress.width = progressWidth
    end if
    
    ' Update game end timer
    if m.gameEndTimer <> invalid
        mins = int(m.gameTimeRemaining / 60)
        secs = m.gameTimeRemaining mod 60
        m.gameEndTimer.text = mins.toStr() + ":" + right("0" + secs.toStr(), 2)
    end if
end sub

sub syncWithBackend()
    m.syncTask = CreateObject("roSGNode", "ApiTask")
    m.syncTask.endpoint = "/live-survey/state"
    m.syncTask.observeField("response", "onSyncResponse")
    m.syncTask.control = "run"
end sub

sub onSyncResponse()
    state = m.syncTask.response
    
    if state <> invalid and state.error = invalid
        ' Update question
        if state.question <> invalid and m.questionText <> invalid
            m.questionText.text = state.question
        end if
        
        ' Update time remaining
        if state.time_remaining <> invalid
            m.questionTimeRemaining = state.time_remaining
        end if
        
        ' Update batch time
        if state.batch_time_remaining <> invalid
            m.gameTimeRemaining = state.batch_time_remaining
        end if
        
        ' Update player count
        if state.player_count <> invalid and m.playersDisplay <> invalid
            m.playersDisplay.text = state.player_count.toStr()
        end if
        
        ' Update answers count
        if state.total_answers <> invalid and m.answersCount <> invalid
            m.answersCount.text = state.total_answers.toStr()
        end if
        
        ' Update top answers
        if state.top_answers <> invalid and state.top_answers.count() > 0
            updateTopAnswers(state.top_answers)
        end if
    end if
    
    m.top.gameLoaded = true
end sub

sub updateTopAnswers(answers as object)
    total = 0
    for each a in answers
        total = total + a.count
    end for
    
    if answers.count() > 0 and m.ans1Text <> invalid
        a = answers[0]
        m.ans1Text.text = a.answer
        pct = 0
        if total > 0 then pct = int((a.count / total) * 100)
        m.ans1Count.text = a.count.toStr() + " answers (" + pct.toStr() + "%)"
        m.ans1Bar.width = int((pct / 100) * 800)
    end if
    
    if answers.count() > 1 and m.ans2Text <> invalid
        a = answers[1]
        m.ans2Text.text = a.answer
        pct = 0
        if total > 0 then pct = int((a.count / total) * 100)
        m.ans2Count.text = a.count.toStr() + " answers (" + pct.toStr() + "%)"
        m.ans2Bar.width = int((pct / 100) * 800)
    end if
    
    if answers.count() > 2 and m.ans3Text <> invalid
        a = answers[2]
        m.ans3Text.text = a.answer
        pct = 0
        if total > 0 then pct = int((a.count / total) * 100)
        m.ans3Count.text = a.count.toStr() + " answers (" + pct.toStr() + "%)"
        m.ans3Bar.width = int((pct / 100) * 800)
    end if
    
    if answers.count() > 3 and m.ans4Text <> invalid
        a = answers[3]
        m.ans4Text.text = a.answer
        pct = 0
        if total > 0 then pct = int((a.count / total) * 100)
        m.ans4Count.text = a.count.toStr() + " answers (" + pct.toStr() + "%)"
        m.ans4Bar.width = int((pct / 100) * 800)
    end if
end sub

sub updateFocusVisuals()
    ' Clear all focus
    allFocus = [m.codeInputFocus, m.joinBtnFocus, m.createBtnFocus, m.answerInputFocus, m.sendBtnFocus]
    for each f in allFocus
        if f <> invalid then f.visible = false
    end for
    
    ' Show current focus
    if m.focusRow >= 0 and m.focusRow < m.focusGrid.count()
        row = m.focusGrid[m.focusRow]
        if m.focusCol >= 0 and m.focusCol < row.count()
            item = row[m.focusCol]
            
            if item = "codeInput" and m.codeInputFocus <> invalid
                m.codeInputFocus.visible = true
            else if item = "joinBtn" and m.joinBtnFocus <> invalid
                m.joinBtnFocus.visible = true
            else if item = "createBtn" and m.createBtnFocus <> invalid
                m.createBtnFocus.visible = true
            else if item = "answerInput" and m.answerInputFocus <> invalid
                m.answerInputFocus.visible = true
            else if item = "sendBtn" and m.sendBtnFocus <> invalid
                m.sendBtnFocus.visible = true
            end if
        end if
    end if
end sub

sub updateKeyboardFocus()
    ' Clear all keyboard focus
    for r = 0 to 3
        for c = 0 to m.kbRows[r].count() - 1
            focus = m.top.findNode("kb_" + r.toStr() + "_" + c.toStr() + "_focus")
            if focus <> invalid then focus.visible = false
            bg = m.top.findNode("kb_" + r.toStr() + "_" + c.toStr() + "_bg")
            if bg <> invalid then bg.color = "#333344"
        end for
    end for
    
    ' Show current focus
    focus = m.top.findNode("kb_" + m.kbRow.toStr() + "_" + m.kbCol.toStr() + "_focus")
    if focus <> invalid then focus.visible = true
    bg = m.top.findNode("kb_" + m.kbRow.toStr() + "_" + m.kbCol.toStr() + "_bg")
    if bg <> invalid then bg.color = "#9C27B0"
end sub

sub showKeyboard(target as string)
    m.inputTarget = target
    m.uiMode = "keyboard"
    m.keyboardOverlay.visible = true
    m.kbRow = 0
    m.kbCol = 0
    updateKeyboardFocus()
    
    ' Show current text
    if m.kbInputText <> invalid
        if target = "answer"
            m.kbInputText.text = m.userAnswer
        else
            m.kbInputText.text = m.groupCode
        end if
    end if
end sub

sub hideKeyboard()
    m.uiMode = "normal"
    m.keyboardOverlay.visible = false
end sub

sub typeKey(key as string)
    if key = "SPACE"
        if m.inputTarget = "answer"
            m.userAnswer = m.userAnswer + " "
        else
            m.groupCode = m.groupCode + " "
        end if
    else if key = "DEL"
        if m.inputTarget = "answer"
            if len(m.userAnswer) > 0
                m.userAnswer = left(m.userAnswer, len(m.userAnswer) - 1)
            end if
        else
            if len(m.groupCode) > 0
                m.groupCode = left(m.groupCode, len(m.groupCode) - 1)
            end if
        end if
    else if key = "SEND"
        if m.inputTarget = "answer"
            submitAnswer()
        else
            joinGroup()
        end if
        return
    else
        if m.inputTarget = "answer"
            m.userAnswer = m.userAnswer + key
        else
            m.groupCode = m.groupCode + key
        end if
    end if
    
    ' Update displays
    if m.kbInputText <> invalid
        if m.inputTarget = "answer"
            m.kbInputText.text = m.userAnswer
        else
            m.kbInputText.text = m.groupCode
        end if
    end if
    
    ' Update main field
    if m.inputTarget = "answer" and m.answerText <> invalid
        if len(m.userAnswer) > 0
            m.answerText.text = m.userAnswer
            m.answerText.color = "#FFFFFF"
        else
            m.answerText.text = "Type your answer..."
            m.answerText.color = "#666666"
        end if
    else if m.inputTarget = "code" and m.groupCodeText <> invalid
        if len(m.groupCode) > 0
            m.groupCodeText.text = m.groupCode
            m.groupCodeText.color = "#FFFFFF"
        else
            m.groupCodeText.text = "Enter code..."
            m.groupCodeText.color = "#666666"
        end if
    end if
end sub

sub submitAnswer()
    hideKeyboard()
    
    if len(m.userAnswer) > 0
        ' Add score
        m.playerScore = m.playerScore + 100
        if m.scoreDisplay <> invalid
            m.scoreDisplay.text = m.playerScore.toStr()
        end if
        
        ' Submit to backend - body must be JSON string
        m.submitTask = CreateObject("roSGNode", "ApiTask")
        m.submitTask.endpoint = "/live-survey/answer"
        m.submitTask.method = "POST"
        
        ' Build JSON body string properly
        playerId = m.top.playerId
        if playerId = invalid then playerId = "roku_" + CreateObject("roDeviceInfo").GetRandomUUID()
        bodyJson = "{" + chr(34) + "answer" + chr(34) + ":" + chr(34) + m.userAnswer + chr(34) + "," + chr(34) + "player_id" + chr(34) + ":" + chr(34) + playerId + chr(34) + "}"
        m.submitTask.body = bodyJson
        m.submitTask.control = "run"
        
        ' Clear answer
        m.userAnswer = ""
        if m.answerText <> invalid
            m.answerText.text = "Type your answer..."
            m.answerText.color = "#666666"
        end if
        
        ' Refresh to get updated top answers
        syncWithBackend()
    end if
end sub

sub joinGroup()
    hideKeyboard()
    
    if len(m.groupCode) > 0
        print "GameScreen: Joining group with code: " + m.groupCode
        ' Would call backend to join group
        m.groupCode = ""
        if m.groupCodeText <> invalid
            m.groupCodeText.text = "Joined!"
            m.groupCodeText.color = "#4CAF50"
        end if
    end if
end sub

sub activateButton()
    if m.focusRow >= 0 and m.focusRow < m.focusGrid.count()
        row = m.focusGrid[m.focusRow]
        if m.focusCol >= 0 and m.focusCol < row.count()
            btn = row[m.focusCol]
            
            if btn = "codeInput"
                showKeyboard("code")
            else if btn = "answerInput"
                showKeyboard("answer")
            else if btn = "joinBtn"
                joinGroup()
            else if btn = "createBtn"
                print "GameScreen: Create group"
            else if btn = "sendBtn"
                submitAnswer()
            end if
        end if
    end if
end sub

function handleKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    
    ' Keyboard mode
    if m.uiMode = "keyboard"
        if key = "back"
            if m.inputTarget = "answer"
                submitAnswer()
            else
                hideKeyboard()
            end if
            return true
        else if key = "up"
            if m.kbRow > 0
                m.kbRow = m.kbRow - 1
                if m.kbCol >= m.kbRows[m.kbRow].count()
                    m.kbCol = m.kbRows[m.kbRow].count() - 1
                end if
            end if
            updateKeyboardFocus()
            return true
        else if key = "down"
            if m.kbRow < 3
                m.kbRow = m.kbRow + 1
                if m.kbCol >= m.kbRows[m.kbRow].count()
                    m.kbCol = m.kbRows[m.kbRow].count() - 1
                end if
            end if
            updateKeyboardFocus()
            return true
        else if key = "left"
            if m.kbCol > 0
                m.kbCol = m.kbCol - 1
            end if
            updateKeyboardFocus()
            return true
        else if key = "right"
            if m.kbCol < m.kbRows[m.kbRow].count() - 1
                m.kbCol = m.kbCol + 1
            end if
            updateKeyboardFocus()
            return true
        else if key = "OK"
            typeKey(m.kbRows[m.kbRow][m.kbCol])
            return true
        end if
        return true
    end if
    
    ' Normal mode
    if key = "up"
        if m.focusRow > 0
            m.focusRow = m.focusRow - 1
            m.focusCol = 0
            updateFocusVisuals()
        end if
        return true
    else if key = "down"
        if m.focusRow < m.focusGrid.count() - 1
            m.focusRow = m.focusRow + 1
            m.focusCol = 0
            updateFocusVisuals()
        end if
        return true
    else if key = "left"
        if m.focusCol > 0
            m.focusCol = m.focusCol - 1
            updateFocusVisuals()
            return true
        else
            return false  ' Let parent handle (go to sidebar)
        end if
    else if key = "right"
        row = m.focusGrid[m.focusRow]
        if m.focusCol < row.count() - 1
            m.focusCol = m.focusCol + 1
            updateFocusVisuals()
        end if
        return true
    else if key = "OK"
        activateButton()
        return true
    end if
    
    return false
end function

function onKeyEvent(key as string, press as boolean) as boolean
    return handleKeyEvent(key, press)
end function
