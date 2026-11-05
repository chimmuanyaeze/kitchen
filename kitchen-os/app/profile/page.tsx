"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Edit2, Save, X, User, Settings } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  
  // --- VAULT STATE ---
  const [dietaryPrefs, setDietaryPrefs] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUserEmail(session.user.email || null);

      const { data, error } = await supabase
        .from("profiles")
        .select("dietary_preferences")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!error && data?.dietary_preferences) {
        setDietaryPrefs(data.dietary_preferences);
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, [router]);

  const handleSave = async () => {
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("profiles")
      .update({ dietary_preferences: dietaryPrefs })
      .eq("id", session.user.id);

    if (error) {
      console.error("Failed to save profile:", error);
      alert("Error saving profile.");
    } else {
      setIsEditing(false); 
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#121110] pb-24 w-full transition-colors duration-200">
      
      {/* Header */}
      <div className="bg-white dark:bg-[#1C1A18] px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-[#E6E1DA] dark:border-[#2E2B28] shadow-sm transition-colors duration-200 w-full">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 bg-[#FAF8F5] dark:bg-[#262320] rounded-full hover:bg-[#F3EFEA] dark:hover:bg-[#302D29] transition-colors"
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-[#44403C] dark:text-[#D6D1C7]" />
          </button>
          <h1 className="text-xl font-bold text-[#1C1917] dark:text-[#F5F2EB]">Your Profile</h1>
        </div>

        {/* ⚙️ Core Configuration Redirect Link */}
        <button
          onClick={() => router.push("/settings")}
          className="p-2 bg-[#FAF8F5] dark:bg-[#262320] rounded-full hover:bg-[#F3EFEA] dark:hover:bg-[#302D29] text-[#44403C] dark:text-[#D6D1C7] transition-all"
          title="Open Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 max-w-2xl mx-auto mt-4 space-y-6 w-full flex flex-col">
        
        {/* Identity Context Summary Card */}
        <div className="w-full bg-white dark:bg-[#1C1A18] p-6 rounded-2xl shadow-sm border border-[#E6E1DA] dark:border-[#2E2B28] transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-[#F9EBE8] dark:bg-[#3A201A] text-[#C84B31] dark:text-[#E07A5F] rounded-full">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1C1917] dark:text-[#F5F2EB]">Account Active</h2>
              <p className="text-sm text-[#78716C] dark:text-[#A8A29E] break-all sm:truncate" title={userEmail || ""}>
                {userEmail}
              </p>
            </div>
          </div>
        </div>

        {/* --- MEDICAL & DIETARY VAULT CARD --- */}
        <div className="w-full bg-white dark:bg-[#1C1A18] p-6 rounded-2xl shadow-sm border border-[#E6E1DA] dark:border-[#2E2B28] transition-colors duration-200">
          
          <div className="flex items-center justify-between mb-6 gap-2">
            <h3 className="text-lg font-bold text-[#1C1917] dark:text-[#F5F2EB] flex items-center gap-2">
              Medical & Dietary Vault
            </h3>
            
            {!isEditing && !isLoading && (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 text-sm font-medium text-[#C84B31] bg-[#F9EBE8] dark:bg-[#3A201A] px-4 py-2 rounded-lg hover:bg-[#F9EBE8] dark:hover:bg-[#3A201A] transition-colors whitespace-nowrap"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-[#78716C] dark:text-[#A8A29E] animate-pulse">Unlocking vault...</div>
          ) : isEditing ? (
            
            <div className="space-y-4 animate-in fade-in duration-300 w-full">
              <p className="text-sm text-[#78716C] dark:text-[#A8A29E] mb-2">
                Update your allergies, intolerances, and strict dietary rules here. The AI will strictly enforce these rules across all recipes.
              </p>
              <textarea
                value={dietaryPrefs}
                onChange={(e) => setDietaryPrefs(e.target.value)}
                className="w-full p-4 border border-[#E6E1DA] dark:border-[#2E2B28] rounded-xl bg-[#FAF8F5] dark:bg-[#121110] focus:bg-white dark:focus:bg-[#1C1A18] focus:ring-2 focus:ring-[#C84B31] outline-none transition-all resize-none h-32 text-[#1C1917] dark:text-[#F5F2EB] placeholder:text-[#8C857B] dark:placeholder:text-[#78716C]"
                placeholder="e.g., I am highly allergic to peanuts. I am lactose intolerant..."
              />
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl font-medium text-[#44403C] dark:text-[#D6D1C7] hover:bg-[#F3EFEA] dark:hover:bg-[#262320] transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#C84B31] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#B03E26] disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
            
          ) : (
            
            <div className="w-full bg-[#FAF8F5] dark:bg-[#121110]/50 p-5 rounded-xl border border-[#E6E1DA] dark:border-[#2E2B28] animate-in fade-in duration-300">
              {dietaryPrefs ? (
                <p className="text-[#1C1917] dark:text-[#D6D1C7] leading-relaxed whitespace-pre-wrap break-words">
                  {dietaryPrefs}
                </p>
              ) : (
                <div className="text-center py-6 w-full">
                  <p className="text-[#78716C] dark:text-[#A8A29E] italic mb-4">Your medical vault is currently empty.</p>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-[#C84B31] dark:text-[#E07A5F] font-medium hover:underline"
                  >
                    Add your dietary restrictions now
                  </button>
                </div>
              )}
            </div>
            
          )}
          
        </div>
      </div>
    </div>
  );
}