import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Translation Context
const TranslationContext = createContext(null);

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ru: "Русский",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  ar: "العربية",
  hi: "हिन्दी",
  tr: "Türkçe",
  pl: "Polski",
  nl: "Nederlands",
  vi: "Tiếng Việt",
  th: "ไทย",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  tl: "Filipino",
};

// Detect browser/user language
const detectUserLanguage = () => {
  // Check localStorage first
  const saved = localStorage.getItem('ztvlive_language');
  if (saved && SUPPORTED_LANGUAGES[saved]) {
    return saved;
  }
  
  // Detect from browser
  const browserLang = navigator.language || navigator.userLanguage;
  if (browserLang) {
    const code = browserLang.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGUAGES[code]) {
      return code;
    }
  }
  
  return 'en'; // Default to English
};

// Default English translations (fallback)
const DEFAULT_UI = {
  // Game translations
  game_title: "ZTVLIVE UNUSUAL FUN GAME SHOW",
  live_badge: "LIVE 24/7 INTERACTIVE GAME",
  grand_jackpot: "Grand Mystery Jackpot",
  game_ends_in: "Game ends in",
  answer_in: "Answer in",
  type_answer: "Type your answer...",
  too_late: "Too late! Wait for next question.",
  answer_locked: "Answer Locked!",
  same_answer: "Same answer as you",
  people: "people",
  waiting_results: "Waiting for results...",
  top_answers: "TOP ANSWERS",
  your_answer: "Your answer",
  votes: "votes",
  point_won: "+1 Point!",
  try_again: "Try again!",
  next_question: "Next question loading...",
  answers: "answers",
  players: "players",
  played: "played",
  share: "Share",
  score: "Score",
  winner: "YOU'RE A WINNER!",
  your_score: "Your score",
  points: "points",
  claim_prize: "Claim Your Prize!",
  sign_in_claim: "Sign in to claim your prize!",
  continue_playing: "Continue Playing FREE",
  game_over: "Game Over",
  better_luck: "Better luck next round!",
  live_audio: "LIVE AUDIO",
  from_stream: "FROM MAIN STREAM",
  tap_play: "TAP TO PLAY",
  audio_off: "AUDIO OFF",
  // Teaser mode translations
  youre_on_fire: "You're On Fire!",
  teaser_limit_message: "You've played 3 questions! Continue playing for FREE on the full ZTVLIVE experience.",
  teaser_prize_info: "Win real prizes - DoorDash, Cash & more!",
  
  // Watch Page translations
  watch_live: "LIVE",
  watch_viewers: "viewers",
  watch_loading: "Loading ZTVLIVE...",
  watch_now_playing: "Now Playing",
  watch_up_next: "Up Next",
  watch_share_invite: "Share & Invite Friends",
  watch_copy_link: "Link copied! Share with friends",
  watch_captions: "Captions",
  watch_captions_on: "Captions ON",
  watch_captions_off: "Captions OFF",
  watch_volume: "Volume",
  watch_mute: "Mute",
  watch_unmute: "Unmute",
  watch_fullscreen: "Fullscreen",
  watch_exit_fullscreen: "Exit Fullscreen",
  watch_play: "Play",
  watch_pause: "Pause",
  watch_rewind: "Rewind 10s",
  watch_forward: "Forward 10s",
  watch_live_chat: "Live Chat",
  watch_send_message: "Send a message...",
  watch_leaderboard: "Leaderboard",
  watch_play_game: "Play Game",
  watch_screen_mirror: "Screen Mirror",
  watch_change_language: "Change Language",
  watch_promo_banner: "ZTVLIVE Promo",
  
  // App Download translations
  download_app: "Download App",
  get_the_app: "Get the ZTVLIVE App",
  free_download: "Free Download",
  watch_on_tv: "Watch on TV",
  available_on: "Available on",
  get_app_popup_title: "GET THE ZTVLIVE APP",
  get_app_popup_subtitle: "Watch on Roku, Fire TV, Samsung & LG",
  get_app_popup_cta: "Free Download",
  
  // Navigation translations
  nav_home: "Home",
  nav_watch: "Watch",
  nav_play: "Play",
  nav_schedule: "Schedule",
  nav_library: "Library",
  nav_join_creator: "Join as Creator",
  nav_upload: "Upload",
  nav_login: "Login",
  nav_dashboard: "Dashboard",
  nav_download_app: "Download App",
};

// Load cached translations from localStorage
const loadCachedTranslations = () => {
  try {
    const cached = localStorage.getItem('ztvlive_translation_cache');
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

// Save translations to localStorage
const saveCachedTranslations = (cache) => {
  try {
    localStorage.setItem('ztvlive_translation_cache', JSON.stringify(cache));
  } catch (e) {
    // Storage full, ignore
  }
};

export function TranslationProvider({ children }) {
  const [language, setLanguageState] = useState(detectUserLanguage);
  const [uiTexts, setUiTexts] = useState(DEFAULT_UI);
  const [loading, setLoading] = useState(true);
  const [translationCache, setTranslationCache] = useState(loadCachedTranslations);

  // Load UI translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/translation/ui/${language}`);
        if (res.data?.translations) {
          setUiTexts({ ...DEFAULT_UI, ...res.data.translations });
        }
      } catch (error) {
        console.error('Failed to load translations:', error);
        setUiTexts(DEFAULT_UI);
      }
      setLoading(false);
    };

    loadTranslations();
  }, [language]);

  // Change language and persist
  const setLanguage = useCallback((lang) => {
    if (SUPPORTED_LANGUAGES[lang]) {
      localStorage.setItem('ztvlive_language', lang);
      setLanguageState(lang);
    }
  }, []);

  // Get UI text with fallback
  const t = useCallback((key) => {
    return uiTexts[key] || DEFAULT_UI[key] || key;
  }, [uiTexts]);

  // Translate a question (with persistent caching)
  const translateQuestion = useCallback(async (question) => {
    if (language === 'en') return question;
    
    // Check cache
    const cacheKey = `q:${question}:${language}`;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }
    
    try {
      const res = await axios.post(`${API}/api/translation/question`, {
        question,
        target_lang: language
      });
      
      const translated = res.data?.translated || question;
      
      // Cache the result persistently
      setTranslationCache(prev => {
        const updated = { ...prev, [cacheKey]: translated };
        saveCachedTranslations(updated);
        return updated;
      });
      
      return translated;
    } catch (error) {
      console.error('Translation error:', error);
      return question;
    }
  }, [language, translationCache]);

  // Translate an answer for display (with caching)
  const translateAnswer = useCallback(async (answer, sourceLang = 'en') => {
    if (language === sourceLang) return answer;
    
    // Check cache
    const cacheKey = `a:${answer}:${language}`;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }
    
    try {
      const res = await axios.post(`${API}/api/translation/translate`, {
        text: answer,
        target_lang: language,
        source_lang: sourceLang
      });
      
      const translated = res.data?.translated || answer;
      
      // Cache the result persistently
      setTranslationCache(prev => {
        const updated = { ...prev, [cacheKey]: translated };
        saveCachedTranslations(updated);
        return updated;
      });
      
      return translated;
    } catch (error) {
      return answer;
    }
  }, [language, translationCache]);

  const value = {
    language,
    setLanguage,
    t,
    translateQuestion,
    translateAnswer,
    loading,
    isRTL: ['ar', 'he'].includes(language), // Right-to-left languages
    supportedLanguages: SUPPORTED_LANGUAGES,
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

// Custom hook to use translations
export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}

// Language selector component - iOS friendly
export function LanguageSelector({ className = '' }) {
  const { language, setLanguage, supportedLanguages } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const currentLangName = supportedLanguages[language] || 'English';
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef} data-testid="language-selector">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-white hover:bg-zinc-700 transition-colors min-w-[80px]"
        data-testid="language-selector-trigger"
      >
        <span className="truncate">{currentLangName}</span>
        <svg 
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-40 max-h-60 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50">
          {Object.entries(supportedLanguages).map(([code, name]) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setLanguage(code);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 transition-colors ${
                language === code ? 'bg-zinc-700 text-red-400' : 'text-white'
              }`}
              data-testid={`language-option-${code}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TranslationContext;
