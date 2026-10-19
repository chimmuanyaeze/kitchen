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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 w-full transition-colors duration-200">
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors duration-200 w-full">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Your Profile</h1>
        </div>

        {/* ⚙️ Core Configuration Redirect Link */}
        <button
          onClick={() => router.push("/settings")}
          className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-all"
          title="Open Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 max-w-2xl mx-auto mt-4 space-y-6 w-full flex flex-col">
        
        {/* Identity Context Summary Card */}
        <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account Active</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 break-all sm:truncate" title={userEmail || ""}>
                {userEmail}
              </p>
            </div>
          </div>
        </div>

        {/* --- MEDICAL & DIETARY VAULT CARD --- */}
        <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          
          <div className="flex items-center justify-between mb-6 gap-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Medical & Dietary Vault
            </h3>
            
            {!isEditing && !isLoading && (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-gray-400 dark:text-gray-500 animate-pulse">Unlocking vault...</div>
          ) : isEditing ? (
            
            <div className="space-y-4 animate-in fade-in duration-300 w-full">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Update your allergies, intolerances, and strict dietary rules here. The AI will strictly enforce these rules across all recipes.
              </p>
              <textarea
                value={dietaryPrefs}
                onChange={(e) => setDietaryPrefs(e.target.value)}
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-32 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="e.g., I am highly allergic to peanuts. I am lactose intolerant..."
              />
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
            
          ) : (
            
            <div className="w-full bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700 animate-in fade-in duration-300">
              {dietaryPrefs ? (
                <p className="text-gray-900 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                  {dietaryPrefs}
                </p>
              ) : (
                <div className="text-center py-6 w-full">
                  <p className="text-gray-500 dark:text-gray-400 italic mb-4">Your medical vault is currently empty.</p>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
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