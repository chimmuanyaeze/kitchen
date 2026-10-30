"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Mic,
  MicOff,
  Send,
  ChefHat,
  Volume2,
  Timer,
  Plus,
  Play,
  Pause,
  RotateCcw,
  X,
  BellRing,
} from "lucide-react";
import { RecipeDetail, RecipeStep, CookingSession } from "@/lib/types";
import { useHandsFreeVoice } from "@/hooks/useHandsFreeVoice";

interface KitchenTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
}

// --- Helper: Convert number words to digits for voice transcripts ---
const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  fifty: 50,
  sixty: 60,
  half: 0.5,
};

function normalizeSpokenNumbers(input: string): string {
  let out = input.toLowerCase();
  out = out.replace(/\ba\s+half\s+hour\b/g, "30 minutes");
  out = out.replace(/\bhalf\s+an\s+hour\b/g, "30 minutes");
  out = out.replace(/\ban\s+hour\b/g, "1 hour");
  out = out.replace(/\ba\s+minute\b/g, "1 minute");

  Object.entries(WORD_NUMBERS).forEach(([word, num]) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    out = out.replace(regex, String(num));
  });
  return out;
}

// --- Helper: Turn "my rice to boil" -> "Rice boiling" ---
function formatTimerLabel(raw: string): string {
  let cleaned = raw
    .trim()
    .replace(/^(?:for|to|on|the|my|our|a|an)\s+/i, "")
    .replace(/^(?:the|my|our|a|an)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();

  if (!cleaned) return "Kitchen Timer";

  // Transform "<item> to <verb>" into "<Item> <verbing>" (e.g., "rice to boil" -> "Rice boiling")
  const toVerbMatch = cleaned.match(/^(.+?)\s+to\s+([a-z]+)$/i);
  if (toVerbMatch) {
    const subject = toVerbMatch[1].replace(/^(?:the|my|our)\s+/i, "").trim();
    const verb = toVerbMatch[2].toLowerCase();
    let gerund = `${verb}ing`;
    if (verb.endsWith("e") && !verb.endsWith("ee")) {
      gerund = `${verb.slice(0, -1)}ing`; // bake -> baking, simmer -> simmering
    } else if (/^[a-z]*[aeiou][bdfgklmnprstvz]$/.test(verb) && verb.length <= 4) {
      gerund = `${verb}${verb.slice(-1)}ing`; // stir -> stirring
    }
    cleaned = `${subject} ${gerund}`;
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// --- Helper: Parse voice or typed command for timer intent ---
function parseVoiceTimerCommand(
  rawText: string
): { totalSeconds: number; label: string; spokenDuration: string } | null {
  const normalized = normalizeSpokenNumbers(rawText);

  // Check if the sentence mentions setting a timer or a countdown
  if (!/\b(timer|alarm|countdown|remind)\b/i.test(normalized)) {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/i);
  const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/i);
  const secMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec)\b/i);

  if (hourMatch) hours = parseFloat(hourMatch[1]);
  if (minMatch) minutes = parseFloat(minMatch[1]);
  if (secMatch) seconds = parseFloat(secMatch[1]);

  const totalSeconds = Math.round(hours * 3600 + minutes * 60 + seconds);
  if (totalSeconds <= 0) return null;

  // Extract the label from the original text
  let labelCandidate = rawText;

  // Case 1: "... timer for <label>" (e.g., "Set a 10 minutes timer for my rice to boil")
  const afterTimerMatch = rawText.match(
    /\btimer\s+(?:for|on|to|named|called)\s+(.+)/i
  );
  if (afterTimerMatch) {
    // Strip out duration if the duration was after "timer for" (e.g. "Set a timer for 10 minutes for my rice to boil")
    const remainder = afterTimerMatch[1].replace(
      /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|fifty|sixty|a|an)\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)(?:\s+and\s+\d+\s*(?:minutes?|mins?|seconds?|secs?))?\s*(?:for|to|on)?\s*/i,
      ""
    );
    labelCandidate = remainder || afterTimerMatch[1];
  } else {
    // Case 2: "Set a 10 minute <label> timer"
    const beforeTimerMatch = normalized.match(
      /(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)\s+(.+?)\s+timer\b/i
    );
    if (beforeTimerMatch) {
      labelCandidate = beforeTimerMatch[1];
    } else {
      labelCandidate = "";
    }
  }

  const label = formatTimerLabel(labelCandidate);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds > 0) parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);

  return {
    totalSeconds,
    label,
    spokenDuration: parts.join(" and "),
  };
}

// --- Web Audio API Beep for Finished Timers ---
function playTimerAlarmSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const beepTimes = [0, 0.25, 0.5, 0.9, 1.15, 1.4];

    beepTimes.forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime + offset); // A5 chime
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch {
    // Ignore audio context restrictions if unprimed
  }
}

function formatClock(totalSecs: number): string {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function ActiveCookingPage() {
  const params = useParams();
  const router = useRouter();

  const [session, setSession] = useState<CookingSession | null>(null);
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commandInput, setCommandInput] = useState("");
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [dietaryPrefs, setDietaryPrefs] = useState<string | null>(null);

  // VOICE SELECTION STATE
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");

  // --- MULTI-TIMER STATES ---
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [showTimerDrawer, setShowTimerDrawer] = useState(false);
  const [newTimerLabel, setNewTimerLabel] = useState("");
  const [newTimerMins, setNewTimerMins] = useState("10");
  const [newTimerSecs, setNewTimerSecs] = useState("0");

  // Load saved voice preference from localStorage
  useEffect(() => {
    setTimeout(() => {
      const savedGender = localStorage.getItem("kitchen_voice_gender") as
        | "female"
        | "male";
      if (savedGender) {
        setVoiceGender(savedGender);
      }
    }, 0);
  }, []);

  // Refs for voice hook callbacks
  const handleNextStepRef = useRef<() => void>(() => {});
  const handlePrevStepRef = useRef<() => void>(() => {});
  const processAICommandRef = useRef<(text: string) => void>(() => {});
  const handleVoiceTimerRef = useRef<(text: string) => boolean>(() => false);

  // Hands-free listening (VAD + Whisper) and AI text-to-speech (Kokoro)
  const {
    isListening,
    isTranscribing,
    isSpeaking,
    lastHeard,
    toggleListening,
    speak,
  } = useHandsFreeVoice({
    voiceGender,
    enabled: !!session,
    onTranscript: (transcript) => {
      // 1. Check if the user asked to set a timer by voice!
      if (handleVoiceTimerRef.current(transcript)) {
        return;
      }

      // 2. Standard step navigation or AI adaptation commands
      if (
        ["next", "next step", "continue", "move on", "step done", "advance"].some(
          (cmd) => transcript.includes(cmd)
        )
      ) {
        handleNextStepRef.current();
      } else if (
        ["previous", "previous step", "go back", "back", "last step"].some((cmd) =>
          transcript.includes(cmd)
        )
      ) {
        handlePrevStepRef.current();
      } else if (
        ["repeat", "read step", "what was that", "say that again"].some((cmd) =>
          transcript.includes(cmd)
        )
      ) {
        if (session && recipe) {
          const currentStepText = recipe.recipe_steps.find(
            (s) => s.step_number === session.current_step
          )?.instruction;
          const aiModified =
            session.modifications?.ai_steps?.[session.current_step];
          speak(
            `Step ${session.current_step}. ${aiModified || currentStepText}`,
            voiceGender
          );
        }
      } else if (transcript.length > 2) {
        processAICommandRef.current(transcript);
      }
    },
  });

  // --- Add a New Timer Function ---
  const createTimer = useCallback(
    (label: string, totalSeconds: number, announceVoice = true) => {
      const cleanLabel = label.trim() || "Kitchen Timer";
      const newTimer: KitchenTimer = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: cleanLabel,
        totalSeconds,
        remainingSeconds: totalSeconds,
        isRunning: true,
        isFinished: false,
      };

      setTimers((prev) => [newTimer, ...prev]);

      if (announceVoice) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const durationStr =
          mins > 0 && secs > 0
            ? `${mins} minutes and ${secs} seconds`
            : mins > 0
            ? `${mins} ${mins === 1 ? "minute" : "minutes"}`
            : `${secs} seconds`;

        speak(`Timer set for ${durationStr} for ${cleanLabel}.`, voiceGender);
      }
    },
    [speak, voiceGender]
  );

  // Check and execute voice timer commands
  const tryHandleVoiceTimer = useCallback(
    (text: string): boolean => {
      const parsed = parseVoiceTimerCommand(text);
      if (!parsed) return false;

      createTimer(parsed.label, parsed.totalSeconds, true);
      return true;
    },
    [createTimer]
  );

  // Manual form submit for adding a timer
  const handleManualAddTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(newTimerMins) || 0;
    const secs = parseInt(newTimerSecs) || 0;
    const total = mins * 60 + secs;
    if (total <= 0) return;

    createTimer(newTimerLabel || "Cooking Timer", total, true);
    setNewTimerLabel("");
    setNewTimerMins("10");
    setNewTimerSecs("0");
    setShowTimerDrawer(false);
  };

  // --- Global 1-Second Interval Tick for All Active Timers ---
  const speakRef = useRef(speak);
  const voiceGenderRef = useRef(voiceGender);
  useEffect(() => {
    speakRef.current = speak;
    voiceGenderRef.current = voiceGender;
  }, [speak, voiceGender]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        if (!prevTimers.some((t) => t.isRunning)) return prevTimers;

        return prevTimers.map((timer) => {
          if (!timer.isRunning) return timer;

          if (timer.remainingSeconds <= 1) {
            // Timer just completed!
            playTimerAlarmSound();
            speakRef.current(
              `Chef, your ${timer.label} timer is up!`,
              voiceGenderRef.current
            );
            return {
              ...timer,
              remainingSeconds: 0,
              isRunning: false,
              isFinished: true,
            };
          }

          return {
            ...timer,
            remainingSeconds: timer.remainingSeconds - 1,
          };
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const toggleTimerRunning = (id: string) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              isRunning: !t.isRunning,
              isFinished: false,
            }
          : t
      )
    );
  };

  const resetTimer = (id: string) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              remainingSeconds: t.totalSeconds,
              isRunning: false,
              isFinished: false,
            }
          : t
      )
    );
  };

  const removeTimer = (id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleVoiceGenderChange = (gender: "female" | "male") => {
    setVoiceGender(gender);
    localStorage.setItem("kitchen_voice_gender", gender);
    speak(
      gender === "female" ? "Female voice selected." : "Male voice selected.",
      gender
    );
  };

  // --- Step narration ---------------------------------------------------
  const pendingNarrationRef = useRef<number | null>(null);
  const currentStepRef = useRef<number | null>(null);
  const speakStepRef = useRef<
    (step: number, mods: CookingSession["modifications"]) => void
  >(() => {});

  const stepNeedsAdaptation = (
    mods: CookingSession["modifications"],
    step: number
  ) => !!mods?.scratchpad?.length && !mods?.ai_steps?.[step];

  const speakStep = (step: number, mods: CookingSession["modifications"]) => {
    if (!recipe) return;
    const original = recipe.recipe_steps.find(
      (s) => s.step_number === step
    )?.instruction;
    const text = mods?.ai_steps?.[step] || original;
    if (text) speak(`Step ${step}. ${text}`, voiceGender);
  };

  // Fetch the session and its attached recipe
  useEffect(() => {
    async function fetchSession() {
      const { data: sessionData, error: sessionError } = await supabase
        .from("cooking_sessions")
        .select("*, recipes(*, recipe_steps(*))")
        .eq("id", params.sessionId)
        .single();

      if (sessionError || !sessionData) {
        console.error("Error fetching session:", sessionError);
        router.push("/");
        return;
      }

      if (sessionData.recipes && sessionData.recipes.recipe_steps) {
        sessionData.recipes.recipe_steps.sort(
          (a: RecipeStep, b: RecipeStep) => a.step_number - b.step_number
        );
      }

      setSession(sessionData);
      setRecipe(sessionData.recipes);
      setLoading(false);
    }

    if (params.sessionId) {
      fetchSession();
    }
  }, [params.sessionId, router]);

  // Jump directly to a specific step when clicking a step progress dot
  const handleJumpToStep = async (targetStep: number) => {
    if (!session || !recipe || targetStep === session.current_step) return;
    setShowOriginal(false);
    await supabase
      .from("cooking_sessions")
      .update({ current_step: targetStep })
      .eq("id", session.id);
    setSession({ ...session, current_step: targetStep });

    if (stepNeedsAdaptation(session.modifications, targetStep)) {
      pendingNarrationRef.current = targetStep;
    } else {
      pendingNarrationRef.current = null;
      speakStep(targetStep, session.modifications);
    }
  };

  // Handle moving to the next step
  const handleNextStep = async () => {
    setShowOriginal(false);
    if (!session || !recipe) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("dietary_preferences")
      .eq("id", session.user_id)
      .single();

    if (profile?.dietary_preferences) {
      setDietaryPrefs(profile.dietary_preferences);
    }

    const isLastStep = session.current_step === recipe.recipe_steps.length;

    if (isLastStep) {
      await supabase
        .from("cooking_sessions")
        .update({ status: "completed" })
        .eq("id", session.id);

      setShowCompletionModal(true);
      speak("Meal completed! Bon appétit!", voiceGender);
    } else {
      const nextStep = session.current_step + 1;
      await supabase
        .from("cooking_sessions")
        .update({ current_step: nextStep })
        .eq("id", session.id);
      setSession({ ...session, current_step: nextStep });

      if (stepNeedsAdaptation(session.modifications, nextStep)) {
        pendingNarrationRef.current = nextStep;
      } else {
        pendingNarrationRef.current = null;
        speakStep(nextStep, session.modifications);
      }
    }
  };

  // Handle moving to the previous step
  const handlePrevStep = async () => {
    setShowOriginal(false);
    if (!session || !recipe || session.current_step === 1) return;

    const prevStep = session.current_step - 1;
    await supabase
      .from("cooking_sessions")
      .update({ current_step: prevStep })
      .eq("id", session.id);
    setSession({ ...session, current_step: prevStep });

    if (stepNeedsAdaptation(session.modifications, prevStep)) {
      pendingNarrationRef.current = prevStep;
    } else {
      pendingNarrationRef.current = null;
      speakStep(prevStep, session.modifications);
    }
  };

  // Process AI commands (and also intercept typed timer commands!)
  const processAICommand = async (commandText: string) => {
    if (!commandText.trim() || !recipe || !session) return;

    // If the user typed a timer command into the input box, create the timer locally!
    if (tryHandleVoiceTimer(commandText)) {
      setCommandInput("");
      return;
    }

    setIsProcessingAI(true);
    const currentStepText = recipe.recipe_steps.find(
      (s) => s.step_number === session.current_step
    )?.instruction;

    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: commandText,
          currentStep: currentStepText,
          dietaryProfile: dietaryPrefs,
          scratchpad: session.modifications?.scratchpad || [],
        }),
      });
      const aiResponse = await res.json();

      if (aiResponse.action === "next_step") {
        await handleNextStep();
      }

      if (aiResponse.updated_instruction) {
        const currentMods = { ...(session.modifications || {}) };
        const aiSteps = { ...(currentMods.ai_steps || {}) };
        const currentScratchpad = [...(currentMods.scratchpad || [])];

        aiSteps[session.current_step] = aiResponse.updated_instruction;

        if (aiResponse.new_scratchpad_note) {
          currentScratchpad.push(aiResponse.new_scratchpad_note);
        }

        const newMods = {
          ...currentMods,
          ai_steps: aiSteps,
          scratchpad: currentScratchpad,
        };

        await supabase
          .from("cooking_sessions")
          .update({ modifications: newMods })
          .eq("id", session.id);

        setSession((prev) =>
          prev ? { ...prev, modifications: newMods } : prev
        );
        setShowOriginal(false);

        speak(
          `${aiResponse.speech ? aiResponse.speech + " " : ""}${
            aiResponse.updated_instruction
          }`,
          voiceGender
        );
      } else if (aiResponse.speech && aiResponse.action !== "next_step") {
        speak(aiResponse.speech, voiceGender);
      }
    } catch (error) {
      console.error("Failed to reach the Jarvis AI engine:", error);
      speak("We are having trouble connecting to network.", voiceGender);
    } finally {
      setIsProcessingAI(false);
      setCommandInput("");
    }
  };

  const handleAICommand = (e: React.FormEvent) => {
    e.preventDefault();
    processAICommand(commandInput);
  };

  useEffect(() => {
    handleNextStepRef.current = handleNextStep;
    handlePrevStepRef.current = handlePrevStep;
    processAICommandRef.current = processAICommand;
    speakStepRef.current = speakStep;
    handleVoiceTimerRef.current = tryHandleVoiceTimer;
  });

  useEffect(() => {
    currentStepRef.current = session?.current_step ?? null;
  }, [session]);

  const handleToggleListening = () => {
    const turningOn = !isListening;
    toggleListening();
    if (turningOn) {
      speak(
        "Hands free voice mode activated. Say next, previous, set a timer, or tell me missing ingredients.",
        voiceGender
      );
    }
  };

  // --- THE AUTO-CLEANER ---
  useEffect(() => {
    if (!session || !session.modifications?.scratchpad?.length) return;
    if (session.modifications?.ai_steps?.[session.current_step]) return;

    const autoCleanStep = async () => {
      setIsProcessingAI(true);
      const stepNum = session.current_step;
      let modsForNarration = session.modifications;
      const currentStepText = recipe?.recipe_steps.find(
        (s) => s.step_number === session.current_step
      )?.instruction;

      try {
        const res = await fetch("/api/ai/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: "Silently apply the scratchpad rules to this step.",
            currentStep: currentStepText,
            dietaryProfile: dietaryPrefs,
            scratchpad: session.modifications?.scratchpad,
          }),
        });

        const aiResponse = await res.json();

        if (aiResponse.updated_instruction) {
          const currentMods = { ...(session.modifications || {}) };
          const aiSteps = { ...(currentMods.ai_steps || {}) };
          aiSteps[session.current_step] = aiResponse.updated_instruction;

          const newMods = { ...currentMods, ai_steps: aiSteps };

          await supabase
            .from("cooking_sessions")
            .update({ modifications: newMods })
            .eq("id", session.id);

          setSession((prev) =>
            prev ? { ...prev, modifications: newMods } : prev
          );
          setShowOriginal(false);
          modsForNarration = newMods;
        }
      } catch (error) {
        console.error("Background AI sync failed:", error);
      } finally {
        setIsProcessingAI(false);

        if (pendingNarrationRef.current === stepNum) {
          pendingNarrationRef.current = null;
          if (currentStepRef.current === stepNum) {
            speakStepRef.current(stepNum, modsForNarration);
          }
        }
      }
    };

    autoCleanStep();
  }, [session, recipe, dietaryPrefs]);

  if (loading || !recipe || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-white transition-colors duration-200">
        Loading Kitchen...
      </div>
    );
  }

  const currentStepData = recipe.recipe_steps.find(
    (s) => s.step_number === session.current_step
  );
  const aiModifiedInstruction =
    session?.modifications?.ai_steps?.[session.current_step];

  const displayText =
    aiModifiedInstruction && !showOriginal
      ? aiModifiedInstruction
      : currentStepData?.instruction;

  const totalSteps = recipe.recipe_steps.length;
  const progressPercentage = Math.round(
    (session.current_step / Math.max(1, totalSteps)) * 100
  );

  return (
    <main className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            title="Go back"
            aria-label="Go back"
            onClick={() => router.push("/")}
            className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {recipe.title}
            </p>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Step {session.current_step} of {totalSteps} ({progressPercentage}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Manual Timer Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setShowTimerDrawer((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              timers.some((t) => t.isFinished)
                ? "bg-red-600 text-white border-red-600 animate-bounce"
                : timers.length > 0
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            title="Add or manage kitchen timers"
          >
            <Timer className="w-4 h-4"/>
            <span>Timers {timers.length > 0 && `(${timers.length})`}</span>
            <Plus className="w-3.5 h-3.5"/>
          </button>

          {/* Male / Female Voice Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <Volume2 className="w-4 h-4 ml-1 text-gray-500 hidden sm:inline"/>
            <button
              type="button"
              onClick={() => handleVoiceGenderChange("female")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                voiceGender === "female"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              👩 Female
            </button>
            <button
              type="button"
              onClick={() => handleVoiceGenderChange("male")}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                voiceGender === "male"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              👨 Male
            </button>
          </div>
        </div>
      </div>

      {/* --- STEP PROGRESS BAR SECTION --- */}
      <div className="w-full bg-white dark:bg-gray-900 px-6 py-3 border-b border-gray-100 dark:border-gray-800/80">
        <div className="max-w-3xl mx-auto">
          {/* Continuous Animated Progress Bar */}
          <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Clickable Step Dots */}
          <div className="flex items-center justify-between mt-2.5 gap-1 overflow-x-auto hide-scrollbar py-0.5">
            {recipe.recipe_steps.map((s) => {
              const isCompleted = s.step_number < session.current_step;
              const isCurrent = s.step_number === session.current_step;
              return (
                <button
                  key={s.step_number}
                  type="button"
                  onClick={() => handleJumpToStep(s.step_number)}
                  title={`Go to Step ${s.step_number}`}
                  className={`h-6 min-w-[1.5rem] px-1.5 rounded-full text-[11px] font-bold transition-all shrink-0 ${
                    isCurrent
                      ? "bg-blue-600 text-white scale-110 shadow-sm"
                      : isCompleted
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {s.step_number}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hands-Free Voice Status Banner */}
      {(isListening || isTranscribing || isSpeaking) && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-bold animate-pulse shadow-inner text-center">
          <Mic className="w-4 h-4 shrink-0"/>
          {isTranscribing ? (
            <span>Listening to what you said...</span>
          ) : isSpeaking ? (
            <span>Speaking...</span>
          ) : lastHeard ? (
            <span>Heard: &quot;{lastHeard}&quot;</span>
          ) : (
            <span>
              Hands-Free Active — Say &quot;Next&quot;, &quot;Set a 10 minute timer
              for my rice to boil&quot;, or ask a question...
            </span>
          )}
        </div>
      )}

      {/* --- MANUAL TIMER CREATOR DRAWER --- */}
      {showTimerDrawer && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shadow-md animate-in slide-in-from-top duration-200">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-500"/>
                Add a Kitchen Timer (or say &quot;Set a 10 minutes timer for my rice to boil&quot;)
              </h3>
              <button
                type="button"
                onClick={() => setShowTimerDrawer(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4"/>
              </button>
            </div>

            <form
              onSubmit={handleManualAddTimer}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
            >
              <input
                type="text"
                value={newTimerLabel}
                onChange={(e) => setNewTimerLabel(e.target.value)}
                placeholder="Timer name (e.g., Rice boiling, Plantain frying)"
                className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5">
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={newTimerMins}
                    onChange={(e) => setNewTimerMins(e.target.value)}
                    className="w-12 bg-transparent text-center font-mono text-sm font-bold text-gray-900 dark:text-white focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">min</span>
                </div>

                <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={newTimerSecs}
                    onChange={(e) => setNewTimerSecs(e.target.value)}
                    className="w-12 bg-transparent text-center font-mono text-sm font-bold text-gray-900 dark:text-white focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">sec</span>
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shrink-0"
                >
                  Start Timer
                </button>
              </div>
            </form>

            {/* Quick Preset Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-gray-400">Quick start:</span>
              {[
                { label: "Simmer Check", mins: 3 },
                { label: "Boil Eggs", mins: 8 },
                { label: "Rice Boiling", mins: 15 },
                { label: "Stew Reduction", mins: 20 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    createTimer(preset.label, preset.mins * 60, true);
                    setShowTimerDrawer(false);
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700/70 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  + {preset.label} ({preset.mins}m)
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- ACTIVE MULTI-TIMERS DOCK --- */}
      {timers.length > 0 && (
        <div className="px-6 pt-4">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {timers.map((timer) => {
              const pct =
                timer.totalSeconds > 0
                  ? Math.round(
                      ((timer.totalSeconds - timer.remainingSeconds) /
                        timer.totalSeconds) *
                        100
                    )
                  : 100;

              return (
                <div
                  key={timer.id}
                  className={`relative overflow-hidden rounded-2xl p-3.5 border shadow-sm transition-all ${
                    timer.isFinished
                      ? "bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-700 animate-pulse"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {timer.isFinished ? (
                        <BellRing className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 animate-bounce"/>
                      ) : (
                        <Timer className="w-4 h-4 text-blue-500 shrink-0"/>
                      )}
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                        {timer.label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeTimer(timer.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                      title="Dismiss timer"
                    >
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span
                      className={`font-mono text-2xl font-extrabold tracking-tight ${
                        timer.isFinished
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {timer.isFinished
                        ? "DONE!"
                        : formatClock(timer.remainingSeconds)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!timer.isFinished && (
                        <button
                          type="button"
                          onClick={() => toggleTimerRunning(timer.id)}
                          className={`p-2 rounded-xl text-white transition-colors ${
                            timer.isRunning
                              ? "bg-amber-500 hover:bg-amber-600"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                          title={timer.isRunning ? "Pause" : "Resume"}
                        >
                          {timer.isRunning ? (
                            <Pause className="w-3.5 h-3.5"/>
                          ) : (
                            <Play className="w-3.5 h-3.5"/>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => resetTimer(timer.id)}
                        className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                        title="Reset timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>

                  {/* Individual Timer Progress Bar */}
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-2.5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        timer.isFinished ? "bg-red-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Instruction Area */}
      <div className="grow flex flex-col items-center justify-center p-8 text-center">
        <div className="flex flex-col items-center mb-8 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold leading-tight text-center">
            {displayText}
          </h2>

          {aiModifiedInstruction && (
            <button
              type="button"
              onClick={() => setShowOriginal(!showOriginal)}
              className="mt-6 flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-colors bg-blue-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700"
            >
              {showOriginal
                ? " 🤖 Switch to AI Adapted Version"
                : "🍲🥣 View Original Recipe Step"}
            </button>
          )}
        </div>

        {/* The AI Command Center */}
        <form
          onSubmit={handleAICommand}
          className="mt-4 w-full max-w-md flex items-center bg-white dark:bg-gray-800 rounded-full p-1 border border-gray-200 dark:border-gray-700 shadow-xl transition-colors duration-200"
        >
          {/* Hands-free Toggle Button */}
          <button
            type="button"
            onClick={handleToggleListening}
            disabled={isTranscribing || isSpeaking}
            className={`p-3 rounded-full transition-all disabled:opacity-60 ${
              isListening
                ? "bg-red-500 text-white animate-bounce shadow-md"
                : "text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title={
              isTranscribing
                ? "Listening to what you said..."
                : isSpeaking
                ? "Speaking..."
                : isListening
                ? "Stop Hands-free Mode"
                : "Activate Hands-free Mode"
            }
          >
            {isTranscribing || isSpeaking ? (
              <span className="animate-pulse text-xs font-bold px-1">...</span>
            ) : isListening ? (
              <MicOff className="w-5 h-5"/>
            ) : (
              <Mic className="w-5 h-5"/>
            )}
          </button>

          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            disabled={isProcessingAI}
            placeholder="Say 'Set a 10m timer for rice to boil' or 'I don't have butter'..."
            className="grow bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none px-2 text-sm"
          />

          <button
            type="submit"
            disabled={isProcessingAI || !commandInput.trim()}
            className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-400 dark:disabled:bg-gray-700 transition-colors"
          >
            {isProcessingAI ? (
              <span className="animate-pulse text-xs font-bold px-1">...</span>
            ) : (
              <Send className="w-4 h-4 ml-0.5"/>
            )}
          </button>
        </form>
      </div>

      {/* Bottom Controls */}
      <div className="flex gap-4 p-6 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-transparent pb-safe transition-colors duration-200">
        <button
          type="button"
          onClick={handlePrevStep}
          disabled={session.current_step === 1}
          className="w-1/3 bg-gray-100 dark:bg-gray-800 py-4 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white disabled:opacity-50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5"/>
          Previous
        </button>
        <button
          type="button"
          onClick={handleNextStep}
          className="w-2/3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          {session.current_step === recipe.recipe_steps.length
            ? "Finish Meal"
            : "Next Step"}
          {session.current_step !== recipe.recipe_steps.length && (
            <ChevronRight className="w-5 h-5"/>
          )}
        </button>
      </div>

      {/* Completion Celebration Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-gray-950/80 backdrop-blur-md transition-opacity">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner shadow-blue-500/20">
              <ChefHat className="w-12 h-12"/>
            </div>

            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Bon Appétit!
            </h3>

            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
              You&apos;ve successfully conquered{" "}
              <span className="text-gray-900 dark:text-white font-medium">
                {recipe.title}
              </span>
              . Time to plate up and enjoy your masterpiece.
            </p>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/20 dark:shadow-blue-900/50"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </main>
  );
}