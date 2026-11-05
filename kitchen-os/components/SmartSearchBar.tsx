"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Mic,
  Camera,
  Sparkles,
  Search,
  Upload,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

export interface AIGeneratedRecipe {
  status: "ok" | "unclear_photo" | "no_ingredients";
  error_message?: string;
  dish_name: string;
  short_description: string;
  prep_time_mins: number;
  cook_time_mins: number;
  servings: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  ingredients: {
    name: string;
    quantity: string;
    unit: string;
    is_missing: boolean;
  }[];
  missing_from_user: string[];
  steps: {
    step_number: number;
    title: string;
    instruction: string;
    tip?: string;
  }[];
  tips: string[];
  substitutions: {
    original: string;
    substitute: string;
    note: string;
  }[];
}

interface SmartSearchBarProps {
  initialQuery?: string;
  onAIResult?: (recipe: AIGeneratedRecipe) => void;
}

export default function SmartSearchBar({
  initialQuery = "",
  onAIResult,
}: SmartSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  // Photo state
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // AI Loading & Error state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Hidden file inputs
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close "+" menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorBanner(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorBanner("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImageBase64(base64);
      setImagePreviewUrl(base64);
      setShowPlusMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedImageBase64(null);
    setImagePreviewUrl(null);
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // --- VOICE INPUT (Faster-Whisper Integration) ---
  const toggleMicRecording = async () => {
    setErrorBanner(null);

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "voice.webm");

          const res = await fetch("/api/ai/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) throw new Error("Transcription failed");
          const data = await res.json();

          if (data.text && data.text.trim()) {
            setQuery((prev) =>
              prev.trim() ? `${prev.trim()}, ${data.text.trim()}` : data.text.trim()
            );
          } else {
            setErrorBanner("Could not hear any ingredients clearly. Please try again.");
          }
        } catch {
          setErrorBanner("Voice transcription service is unreachable right now.");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setErrorBanner("Microphone permission denied or unavailable.");
    }
  };

  // --- MODE 1: NORMAL DATABASE SEARCH ---
  const handleDatabaseSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorBanner(null);

    if (!query.trim()) {
      setErrorBanner("Please type a recipe name or ingredients to search the database.");
      return;
    }

    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  // --- MODE 2: COOK WITH AI ---
  const handleCookWithAI = async () => {
    setErrorBanner(null);

    if (!query.trim() && !selectedImageBase64) {
      setErrorBanner(
        "Please enter your ingredients or attach a photo before clicking Cook with AI."
      );
      return;
    }

    setIsGeneratingAI(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("/api/cook-with-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientsText: query.trim(),
          imageBase64: selectedImageBase64,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        setErrorBanner(
          data.error || "Our AI Chef encountered an issue. Please try again."
        );
        return;
      }

      if (data.status === "unclear_photo") {
        setErrorBanner(
          data.error_message ||
            "That photo looks blurry or unclear. Please take a clearer photo of your food or ingredients."
        );
        return;
      }

      if (data.status === "no_ingredients") {
        setErrorBanner(
          data.error_message ||
            "No edible ingredients or dishes were recognized. Please list valid ingredients (e.g., rice, tomatoes, eggs)."
        );
        return;
      }

      sessionStorage.setItem("kitchen_os_ai_recipe", JSON.stringify(data));
      if (onAIResult) {
        onAIResult(data);
      } else {
        router.push("/search?mode=ai");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setErrorBanner(
          "The AI Chef took too long to respond (timeout). Please check your connection and try again."
        );
      } else {
        setErrorBanner(
          "Unable to reach the AI Chef right now. Please try again in a moment."
        );
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="w-full mb-8">
      {/* Hidden File Inputs for Upload & Camera */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Attached Photo Preview Chip */}
      {imagePreviewUrl && (
        <div className="mb-3 inline-flex items-center gap-3 bg-white dark:bg-[#1C1A18] p-2 pr-3 rounded-2xl border border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm">
          <div className="w-12 h-12 relative rounded-xl overflow-hidden bg-[#F3EFEA] shrink-0">
            <Image
              src={imagePreviewUrl}
              alt="Selected food"
              fill
              className="object-cover"
            />
          </div>
          <div className="text-xs">
            <p className="font-bold text-[#1C1917] dark:text-[#F5F2EB]">Photo attached</p>
            <p className="text-[#78716C] dark:text-[#A8A29E]">Ready for Cook with AI</p>
          </div>
          <button
            type="button"
            onClick={clearImage}
            className="p-1.5 text-[#78716C] hover:text-red-500 rounded-full hover:bg-[#F3EFEA] dark:hover:bg-[#262320] transition-colors"
            title="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Responsive Container:
          - Mobile (< md): 2-row rounded-3xl card so input gets 100% width on Row 1
          - Desktop (md+): Single horizontal pill (rounded-full) matching reference */}
      <form
        onSubmit={handleDatabaseSearch}
        className="relative flex flex-col md:flex-row md:items-center w-full bg-white dark:bg-[#1C1A18] border border-[#E6E1DA] dark:border-[#2E2B28] rounded-3xl md:rounded-full p-2.5 md:px-3 md:py-2 shadow-md focus-within:ring-2 focus-within:ring-[#C84B31] transition-all gap-2 md:gap-1.5"
      >
        {/* Top Row on Mobile / Left+Center on Desktop */}
        <div className="flex items-center w-full md:flex-1 min-w-0">
          {/* Left "+" Button & Dropdown Menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowPlusMenu((prev) => !prev)}
              className="p-2 text-[#44403C] dark:text-[#D6D1C7] hover:bg-[#F3EFEA] dark:hover:bg-[#262320] rounded-full transition-colors"
              title="Add photo"
              aria-label="Add photo"
            >
              <Plus className="w-5 h-5" />
            </button>

            {showPlusMenu && (
              <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-[#1C1A18] rounded-2xl shadow-xl border border-[#E6E1DA] dark:border-[#2E2B28] py-2 z-40 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-[#44403C] dark:text-[#D6D1C7] hover:bg-[#FAF8F5] dark:hover:bg-[#262320]/60 flex items-center gap-3 transition-colors"
                >
                  <Upload className="w-4 h-4 text-[#C84B31]" />
                  Upload photo
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-[#44403C] dark:text-[#D6D1C7] hover:bg-[#FAF8F5] dark:hover:bg-[#262320]/60 flex items-center gap-3 transition-colors"
                >
                  <Camera className="w-4 h-4 text-[#2D6A4F]" />
                  Take photo
                </button>
              </div>
            )}
          </div>

          {/* Text Input - Guaranteed full width on mobile & flex-1 on desktop */}
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (errorBanner) setErrorBanner(null);
            }}
            placeholder="Search recipes or enter your ingredients..."
            className="w-full flex-1 min-w-[140px] bg-transparent px-2.5 py-1.5 text-sm sm:text-base text-[#1C1917] dark:text-[#F5F2EB] placeholder:text-[#8C857B] dark:placeholder:text-[#78716C] focus:outline-none"
          />
        </div>

        {/* Bottom Action Toolbar on Mobile / Right Side on Desktop */}
        <div className="flex items-center justify-between md:justify-end gap-1.5 pt-2 md:pt-0 border-t border-[#E6E1DA] dark:border-[#2E2B28]/60 md:border-t-0 shrink-0">
          {/* Mic & Quick Camera Icons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMicRecording}
              disabled={isTranscribing}
              title={isRecording ? "Stop recording" : "Voice input"}
              aria-label="Voice input"
              className={`p-2 rounded-full transition-all ${
                isRecording
                  ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 animate-pulse"
                  : "text-[#44403C] dark:text-[#D6D1C7] hover:bg-[#F3EFEA] dark:hover:bg-[#262320]"
              }`}
            >
              {isTranscribing ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#C84B31]" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              title="Take photo"
              aria-label="Take photo"
              className="p-2 text-[#44403C] dark:text-[#D6D1C7] hover:bg-[#F3EFEA] dark:hover:bg-[#262320] rounded-full transition-colors"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Cook with AI Pill Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              disabled={isGeneratingAI}
              className="px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold text-[#44403C] dark:text-[#D6D1C7] bg-[#F3EFEA] dark:bg-[#262320] hover:bg-[#E6E1DA] dark:hover:bg-[#302D29] transition-colors flex items-center gap-1.5"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={handleCookWithAI}
              disabled={isGeneratingAI}
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-[#1C1917] hover:bg-[#292524] text-[#F5F2EB] dark:bg-[#E6D5B8] dark:hover:bg-[#D8C3A0] dark:text-[#1C1917] active:scale-95 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cooking...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Cook with AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Friendly Edge-Case Error Banner */}
      {errorBanner && (
        <div className="mt-3 flex items-center gap-2.5 text-xs sm:text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-4 py-3 rounded-2xl animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{errorBanner}</span>
        </div>
      )}
    </div>
  );
}