"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save, Plus, Trash2, ChefHat, Star } from "lucide-react";

interface StructuredIngredient {
  quantity: string;
  unit: string;
  name: string;
  is_core: boolean;
}

export default function CreateRecipePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("4"); 
  
  const [ingredients, setIngredients] = useState<StructuredIngredient[]>([
    { quantity: "", unit: "", name: "", is_core: true }
  ]);
  const [steps, setSteps] = useState([""]);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const enforceAdminSecurity = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error || profile?.role !== "admin") {
        alert("Security Alert: Only Master Chefs can access the Kitchen Vault.");
        router.push("/");
      }
    };
    enforceAdminSecurity();
  }, [router]);

  const updateIngredient = (index: number, field: keyof StructuredIngredient, value: string | boolean) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };


  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const ALLOWED_IMAGE_DOMAINS = [
    "encrypted-tbn0.gstatic.com",
    "i.imgur.com",
    "images.unsplash.com",
    "images.pexels.com",
    "cdn.pixabay.com",
    "upload.wikimedia.org"
  ];

 const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (imageUrl.trim() !== "") {
      try {
        const parsedUrl = new URL(imageUrl);
        if (!ALLOWED_IMAGE_DOMAINS.includes(parsedUrl.hostname)) {
          setErrorMessage(`For security, Kitchen OS only allows images from these sites:\n\n• ${ALLOWED_IMAGE_DOMAINS.join("\n• ")}\n\nPlease host your image on one of these platforms or add the new domain to next.config.ts first.`);
          setShowErrorModal(true);
          return; 
        }
      } catch {
        setErrorMessage("Please enter a valid, complete image URL starting with https://");
        setShowErrorModal(true);
        return; 
      }
    }

    try {
      const { data: recipeData, error: recipeError } = await supabase
        .from("recipes")
        .insert({
          title,
          overview,
          image_url: imageUrl,
          prep_time_mins: parseInt(prepTime) || 0,
          cook_time_mins: parseInt(cookTime) || 0,
          default_servings: parseInt(servings) || 2,
        })
        .select()
        .single();

      if (recipeError) throw recipeError;
      const recipeId = recipeData.id;

    

      const validSteps = steps.filter(s => s.trim() !== "");
      if (validSteps.length > 0) {
        const stepsToInsert = validSteps.map((instruction, index) => ({
          recipe_id: recipeId,
          step_number: index + 1,
          instruction
        }));
        await supabase.from("recipe_steps").insert(stepsToInsert);
      }

      const validIngredients = ingredients.filter(i => i.name.trim() !== "");
      
      for (const ing of validIngredients) {
        let ingredientId;
        const cleanName = ing.name.trim().toLowerCase();
        
        const { data: existingIng, error: searchError } = await supabase
          .from("ingredients")
          .select("id")
          .ilike("name", cleanName)
          .maybeSingle(); 

        if (searchError) throw searchError;

        if (existingIng) {
          ingredientId = existingIng.id;
        } else {
          const { data: newIng, error: ingError } = await supabase
            .from("ingredients")
            .insert({ name: cleanName })
            .select()
            .single();
            
          if (ingError) throw ingError;
          ingredientId = newIng.id;
        }

        await supabase.from("recipe_ingredients").insert({
          recipe_id: recipeId,
          ingredient_id: ingredientId,
          quantity: parseFloat(ing.quantity) || 0,
          unit: ing.unit.trim().toLowerCase(),
          is_core: ing.is_core
        });
      }

      // --- NEW: KOKORO TTS PREWARM ---
      if (validSteps.length > 0) {
        // We do NOT 'await' this fetch. It runs in the background so the UI doesn't 
        // freeze for 10-30 seconds while Kokoro generates the audio.
        fetch(`${process.env.NEXT_PUBLIC_INFERENCE_URL || 'http://localhost:8000'}/prewarm`, {
          method: "POST",
          keepalive: true, // Ensures the request isn't cancelled when Next.js routes away
          headers: {
            "Content-Type": "application/json",
            // Uncomment and set if you enforce authorization locally:
            // "Authorization": `Bearer ${process.env.NEXT_PUBLIC_INFERENCE_API_KEY}`
          },
          body: JSON.stringify({
            phrases: validSteps.map(step => ({
              text: step,
              voiceGender: "female" // Ensure this matches your default cooking voice
            }))
          })
        }).catch(err => console.error("Background prewarm failed:", err));
      }

      alert("Structured Recipe safely added to the Kitchen OS Vault!");
      router.push("/");
      
    } catch (error) {
      console.error("Failed to save recipe:", error);
      alert("Error saving recipe. Check the console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Added dark:bg-gray-900, w-full, transition
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 w-full transition-colors duration-200">
      
      {/* Header */}
      {/* Added dark:bg-gray-800, dark:border-gray-700 */}
      <div className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700 shadow-sm transition-colors duration-200 w-full">
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Go back"
            title="Go back"
            onClick={() => router.push("/")}
            // Added dark:bg-gray-700, dark:hover:bg-gray-600
            className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {/* Added dark:text-gray-300 */}
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          {/* Added dark:text-white */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Add New Recipe</h1>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? "Saving..." : "Save Recipe"}
        </button>
      </div>

      <div className="p-6 max-w-3xl mx-auto mt-4 space-y-8 w-full">
        
        {/* Section 1: Basic Info */}
        {/* Added dark:bg-gray-800, dark:border-gray-700 */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          {/* Added dark:text-white */}
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-blue-600" /> Basic Information
          </h2>
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row gap-4 w-full">
              <div className="flex-3">
                {/* Added dark:text-gray-300 */}
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Recipe Title</label>
                {/* Added dark:bg-gray-900, dark:border-gray-700, dark:text-white, dark:placeholder-gray-500, dark:focus:bg-gray-800 */}
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500" placeholder="e.g., Authentic Nigerian Jollof" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Default Servings</label>
                <input type="number" min="0" value={servings} onChange={e => setServings(e.target.value)} className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500" placeholder="4" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Short Overview</label>
              <textarea value={overview} onChange={e => setOverview(e.target.value)} className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500" placeholder="A rich, smoky party Jollof that brings the heat..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Image URL</label>
              <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500" placeholder="https://images.unsplash.com/..." />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prep Time (mins)</label>
                <input type="number" min="0" value={prepTime} onChange={e => setPrepTime(e.target.value)} className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500" placeholder="15" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cook Time (mins)</label>
                <input type="number" min="0" value={cookTime} onChange={e => setCookTime(e.target.value)} className="w-full p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500" placeholder="45" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Structured Ingredients */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Ingredients (Database Ready)</h2>
          <div className="space-y-4">
            <div className="flex gap-2 px-1 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div className="w-20">Qty</div>
              <div className="w-28">Unit</div>
              <div className="flex-1">Pure Ingredient Name</div>
              <div className="w-16 text-center">Core?</div>
              <div className="w-10"></div>
            </div>

            {ingredients.map((ing, index) => (
              // Added dark:bg-gray-900, dark:border-gray-700
              <div key={index} className="flex gap-2 items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors">
                {/* Input fields updated for dark mode backgrounds */}
                <input 
                  type="number" step="any" min="0"
                  value={ing.quantity} 
                  onChange={e => updateIngredient(index, "quantity", e.target.value)} 
                  className="w-20 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-colors" 
                  placeholder="2" 
                />
                <input 
                  type="text" 
                  value={ing.unit} 
                  onChange={e => updateIngredient(index, "unit", e.target.value)} 
                  className="w-28 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-colors" 
                  placeholder="cups" 
                />
                <input 
                  type="text" 
                  value={ing.name} 
                  onChange={e => updateIngredient(index, "name", e.target.value)} 
                  className="flex-1 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white transition-colors" 
                  placeholder="long grain rice" 
                />
                
                {/* Is Core Toggle */}
                {/* Updated star toggles for dark mode contrasts */}
                <button
                  type="button"
                  onClick={() => updateIngredient(index, "is_core", !ing.is_core)}
                  className={`w-12 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                    ing.is_core 
                      ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-500 dark:text-amber-400" 
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600"
                  }`}
                  title={ing.is_core ? "Core Ingredient (Required)" : "Optional/Garnish"}
                >
                  <Star className={`w-5 h-5 ${ing.is_core ? "fill-current" : ""}`} />
                </button>

                <button 
                  type="button"
                  onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}
                  className="p-3 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  title="Remove ingredient"
                  aria-label="Remove ingredient"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => setIngredients([...ingredients, { quantity: "", unit: "", name: "", is_core: true }])} className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
        </div>

        {/* Section 3: Instructions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-200">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Cooking Steps</h2>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-1 transition-colors">
                  {index + 1}
                </div>
                {/* Input updated for dark mode backgrounds */}
                <textarea 
                  value={step} 
                  onChange={e => handleStepChange(index, e.target.value)} 
                  className="flex-1 p-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-28 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500" 
                  placeholder={`Describe step ${index + 1}...`} 
                />
                <button 
                  type="button"
                  onClick={() => setSteps(steps.filter((_, i) => i !== index))}
                  className="p-3.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors mt-1"
                  title={`Remove step ${index + 1}`}
                  aria-label={`Remove step ${index + 1}`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setSteps([...steps, ""])}
              className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Step
            </button>
          </div>
        </div>

      </div>
  
    {/* --- ERROR MODAL --- */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span className="text-red-500">⚠️</span> Invalid Image Source
            </h3>
            
            <div className="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-line mb-6 leading-relaxed">
              {errorMessage}
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setShowErrorModal(false)}
                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}