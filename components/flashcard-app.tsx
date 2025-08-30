"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const TRANSLATIONS = {
  "en-US": {
    createFlashcardsTitle: "Create flashcards",
    pasteTextTab: "Paste text",
    describeTopicTab: "Describe topic",
    describeTopicPlaceholder:
      "Describe a topic Xai  will generate the details...\n\ne.g. capitals of the world\ne.g. fun facts about San Diego",
    pasteTextPlaceholder: "Paste your text here...",
    generateFlashcardsButton: "Generate flashcards",
    generatingTitle: "Generating your flashcard set...",
    generatingSubtitle: "This may take a while depending on the upload...",
    flipInstruction: "Use ↑↓ arrows or click to flip",
    createNewFlashcardsLink: "Create new flashcards",
    addFlashcardTitle: "Add a flashcard",
    frontPlaceholder: "Front (term)",
    backPlaceholder: "Back (definition)",
    addCardButton: "Add card",
  },
  /* LOCALE_PLACEHOLDER_START */
  "es-ES": {
    createFlashcardsTitle: "Crear tarjetas de estudio",
    pasteTextTab: "Pegar texto",
    describeTopicTab: "Describir tema",
    describeTopicPlaceholder:
      "Describe un tema y Xai  generará los detalles...\n\nej. capitales del mundo\nej. datos curiosos sobre San Diego",
    pasteTextPlaceholder: "Pega tu texto aquí...",
    generateFlashcardsButton: "Generar tarjetas de estudio",
    generatingTitle: "Generando tu conjunto de tarjetas...",
    generatingSubtitle: "Esto puede tomar un tiempo dependiendo de la carga...",
    flipInstruction: "Usa las flechas ↑↓ o haz clic para voltear",
    createNewFlashcardsLink: "Crear nuevas tarjetas de estudio",
    addFlashcardTitle: "Añadir una tarjeta de estudio",
    frontPlaceholder: "Frente (término)",
    backPlaceholder: "Dorso (definición)",
    addCardButton: "Añadir tarjeta",
  },
  /* LOCALE_PLACEHOLDER_END */
}

const appLocale = "{{APP_LOCALE}}"
const getBrowserLocale = () => {
  if (typeof navigator === "undefined") return "en-US"
  return navigator.languages?.[0] || navigator.language || "en-US"
}
const effectiveLocale = appLocale !== "{{APP_LOCALE}}" ? appLocale : getBrowserLocale()

const findMatchingLocale = (locale) => {
  if (TRANSLATIONS[locale]) return locale
  const lang = locale.split("-")[0]
  const match = Object.keys(TRANSLATIONS).find((key) => key.startsWith(lang + "-"))
  return match || "en-US"
}
const locale = findMatchingLocale(effectiveLocale)
const t = (key) => TRANSLATIONS[locale]?.[key] || TRANSLATIONS["en-US"][key] || key

const FlashcardApp = () => {
  const [mode, setMode] = useState<"create" | "loading" | "study">("create")
  const [topic, setTopic] = useState("")
  const [flashcards, setFlashcards] = useState<{ front: string; back: string }[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [activeTab, setActiveTab] = useState<"describe" | "paste">("describe")
  const [animating, setAnimating] = useState(false)

  const [manualFront, setManualFront] = useState("")
  const [manualBack, setManualBack] = useState("")

  const generateFlashcards = async () => {
    if (!topic.trim()) return
    setMode("loading")

    try {
      const res = await fetch("/api/ai/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeTab, // 'describe' | 'paste'
          locale,
          topic,
        }),
      })

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }

      const data = await res.json()
      const cards = Array.isArray(data?.cards) ? data.cards : []
      if (!cards.length) throw new Error("No cards returned")

      setFlashcards(cards)
      setCurrentIndex(0)
      setFlipped(false)
      setMode("study")
    } catch (error) {
      console.error("[v0] Error generating flashcards:", error)
      alert("Failed to generate flashcards. Please try again.")
      setMode("create")
    }
  }

  const handleFlip = () => {
    setFlipped(!flipped)
  }

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1 && !animating) {
      setAnimating(true)
      setTimeout(() => {
        setFlipped(false)
        setCurrentIndex(currentIndex + 1)
        setTimeout(() => setAnimating(false), 50)
      }, 150)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0 && !animating) {
      setAnimating(true)
      setTimeout(() => {
        setFlipped(false)
        setCurrentIndex(currentIndex - 1)
        setTimeout(() => setAnimating(false), 50)
      }, 150)
    }
  }

  const handleKeyPress = (e) => {
    if (mode === "study") {
      if (e.key === "ArrowLeft") handlePrevious()
      if (e.key === "ArrowRight") handleNext()
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault()
        handleFlip()
      }
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [mode, currentIndex, flashcards.length, flipped, animating])

  useEffect(() => {
    if (typeof document === "undefined") return
    const style = document.createElement("style")
    style.textContent = `
      .rotate-x-180 { transform: rotateX(180deg); }
      .backface-hidden { -webkit-backface-visibility: hidden; backface-visibility: hidden; }
      .transform-style-preserve-3d { transform-style: preserve-3d; }
      @keyframes slideInFromRight { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideInFromLeft { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    `
    document.head.appendChild(style)
    return () => {
      try {
        document.head.removeChild(style)
      } catch {}
    }
  }, [])

  if (mode === "create") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#6A9BCC" }}>
        <div className="w-full max-w-lg p-8">
          <h1 className="text-white text-4xl font-bold text-center mb-8">{t("createFlashcardsTitle")}</h1>

          <div className="flex justify-center mb-6">
            <div className="bg-white/20 p-0.5 rounded-full inline-flex">
              <button
                onClick={() => setActiveTab("paste")}
                className={`px-6 py-2 rounded-full font-medium transition-all text-base ${
                  activeTab === "paste" ? "bg-white text-gray-700 shadow-md" : "text-white hover:text-white/90"
                }`}
              >
                {t("pasteTextTab")}
              </button>
              <button
                onClick={() => setActiveTab("describe")}
                className={`px-6 py-2 rounded-full font-medium transition-all text-base ${
                  activeTab === "describe" ? "bg-white text-gray-700 shadow-md" : "text-white hover:text-white/90"
                }`}
              >
                {t("describeTopicTab")}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={activeTab === "describe" ? t("describeTopicPlaceholder") : t("pasteTextPlaceholder")}
              className="w-full h-52 text-gray-900 placeholder-gray-400 resize-none focus:outline-none"
              style={{ fontSize: "18px", lineHeight: "1.6" }}
            />
          </div>

          <button
            onClick={generateFlashcards}
            className="w-full mt-8 py-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-lg"
          >
            {t("generateFlashcardsButton")}
          </button>
        </div>
      </div>
    )
  }

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#6A9BCC" }}>
        <div className="text-center">
          <h1 className="text-white text-4xl font-medium mb-4">{t("generatingTitle")}</h1>
          <p className="text-white/80 mb-8">{t("generatingSubtitle")}</p>
          <div className="flex justify-center">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    )
  }

  if (mode === "study") {
    const currentCard = flashcards[currentIndex]

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#6A9BCC" }}>
        <div className="w-full max-w-2xl px-8">
          <div className="relative" style={{ perspective: "1000px" }}>
            <div
              className={`relative w-full h-96 transition-all duration-700 transform-style-preserve-3d cursor-pointer ${
                flipped ? "rotate-x-180" : ""
              } ${animating ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
              onClick={handleFlip}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Front of card */}
              <div
                className="absolute inset-0 bg-white rounded-3xl shadow-xl flex flex-col items-center justify-center p-8 backface-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="text-center flex-1 flex items-center justify-center">
                  <h2 className="text-4xl font-medium text-gray-800">{currentCard.front}</h2>
                </div>
                <p className="text-gray-500 mt-auto">{t("flipInstruction")}</p>
              </div>

              {/* Back of card */}
              <div
                className="absolute inset-0 bg-white rounded-3xl shadow-xl flex items-center justify-center p-8 rotate-x-180 backface-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateX(180deg)",
                }}
              >
                <div className="text-center">
                  <p className="text-xl text-gray-700 leading-relaxed">{currentCard.back}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center mt-8">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`p-3 rounded-full transition-all ${
                currentIndex === 0
                  ? "bg-white/20 text-white/50 cursor-not-allowed"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              <ChevronLeft size={24} />
            </button>

            <span className="mx-6 text-white text-lg font-medium">
              {currentIndex + 1} / {flashcards.length}
            </span>

            <button
              onClick={handleNext}
              disabled={currentIndex === flashcards.length - 1}
              className={`p-3 rounded-full transition-all ${
                currentIndex === flashcards.length - 1
                  ? "bg-white/20 text-white/50 cursor-not-allowed"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="mt-8 bg-white/20 rounded-2xl p-4">
            <h3 className="text-white text-lg font-medium mb-3">{t("addFlashcardTitle")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={manualFront}
                onChange={(e) => setManualFront(e.target.value)}
                placeholder={t("frontPlaceholder")}
                className="w-full rounded-xl px-3 py-2 text-gray-900"
              />
              <input
                value={manualBack}
                onChange={(e) => setManualBack(e.target.value)}
                placeholder={t("backPlaceholder")}
                className="w-full rounded-xl px-3 py-2 text-gray-900"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  if (!manualFront.trim() || !manualBack.trim()) return
                  setFlashcards((prev) => [...prev, { front: manualFront.trim(), back: manualBack.trim() }])
                  setManualFront("")
                  setManualBack("")
                }}
                className="px-4 py-2 bg-white text-gray-800 rounded-full hover:bg-white/90 transition-colors"
              >
                {t("addCardButton")}
              </button>
            </div>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => {
                setMode("create")
                setTopic("")
                setFlashcards([])
              }}
              className="text-white/70 hover:text-white transition-colors underline-offset-2 hover:underline"
            >
              {t("createNewFlashcardsLink")}
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default FlashcardApp
