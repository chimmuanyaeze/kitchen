"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, ChefHat, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Recipe } from "@/lib/types"; // Make sure this path matches your types file!

interface RecipeCardProps {
  recipe: Recipe;
  currentUserId?: string | null;
}

export default function RecipeCard({ recipe, currentUserId }: RecipeCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(recipe.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  // Check if the current user has already liked this recipe
  useEffect(() => {
    if (!currentUserId) return;

    const checkLikeStatus = async () => {
      const { data } = await supabase
        .from("user_likes")
        .select("id")
        .eq("user_id", currentUserId)
        .eq("recipe_id", recipe.id)
        .maybeSingle();

      if (data) setIsLiked(true);
    };

    checkLikeStatus();
  }, [currentUserId, recipe.id]);

  const handleLikeToggle = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault(); // Needed for RecipeCard to stop navigation
    
    if (!currentUserId) {
      alert("Please log in to like recipes!");
      return;
    }
    if (isLiking || !recipe) return;

    setIsLiking(true);

    // 1. THE MATH FIX: Prevent negative numbers!
    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);

    // 2. Optimistic UI Update
    setIsLiked(newIsLiked);
    setLikeCount(newCount);

    try {
      if (newIsLiked) {
        // 3. THE ERROR FIX: Force a crash if Supabase rejects it
        const { error: likeErr } = await supabase.from("user_likes").insert({ user_id: currentUserId, recipe_id: recipe.id });
        if (likeErr) throw likeErr;

        const { error: recErr } = await supabase.from("recipes").update({ likes_count: newCount }).eq("id", recipe.id);
        if (recErr) throw recErr;
      } else {
        const { error: unlikeErr } = await supabase.from("user_likes").delete().eq("user_id", currentUserId).eq("recipe_id", recipe.id);
        if (unlikeErr) throw unlikeErr;

        const { error: recErr } = await supabase.from("recipes").update({ likes_count: newCount }).eq("id", recipe.id);
        if (recErr) throw recErr;
      }
    } catch (error) {
      // 4. If anything fails, revert the math and the UI
      setIsLiked(!newIsLiked);
      setLikeCount(newIsLiked ? Math.max(0, newCount - 1) : newCount + 1);
      console.error("Database rejected the like:", error);
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <Link href={`/recipes/${recipe.id}`} className="group block bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden relative">
      
      {/* Image Header */}
      <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
        {recipe.image_url ? (
          <Image 
            src={recipe.image_url} 
            alt={recipe.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
            <ChefHat className="w-8 h-8 sm:w-12 sm:h-12" />
          </div>
        )}
        
        {/* The Like Button - Snugger positioning and smaller icon on mobile */}
        <button
          type="button"
          title="like"
          onClick={handleLikeToggle}
          aria-label={isLiked ? "Unlike recipe" : "Like recipe"}
          className="absolute top-2 sm:top-4 right-2 sm:right-4 p-2 sm:p-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-sm hover:scale-110 active:scale-95 transition-all"
        >
          <Heart
            className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${isLiked ? "fill-red-500 text-red-500" : "text-gray-400 dark:text-gray-500"}`}
            aria-hidden="true"
          />
        </button>
      </div>
      
      {/* Card Content - Scaled down padding on mobile */}
      <div className="p-3.5 sm:p-5">
        <div className="flex justify-between items-start gap-2 sm:gap-4 mb-1.5 sm:mb-2">
          {/* Title - Smaller text on mobile */}
          <h3 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
            {recipe.title}
          </h3>
          
          {/* Like Counter Tag - Tighter padding and text on mobile */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md sm:rounded-lg text-xs sm:text-sm font-bold shrink-0 transition-colors">
            <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
            {likeCount}
          </div>
        </div>
        
        {/* The Overview Text - Smaller font and less bottom margin on mobile */}
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2 sm:mb-4 leading-relaxed transition-colors">
          {recipe.overview || "A delicious Kitchen OS recipe ready to be cooked."}
        </p>

        {/* Time footer - Smaller font and tighter icon gap on mobile */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium transition-colors">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
            <span>{recipe.prep_time_mins + recipe.cook_time_mins} mins total</span>
          </div>
        </div>
      </div>
    </Link>
  );
}