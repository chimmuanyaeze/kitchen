"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, ChefHat, Heart, Edit3, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Recipe } from "@/lib/types";

interface RecipeCardProps {
  recipe: Recipe;
  currentUserId?: string | null;
  isAdmin?: boolean;
  onDeleteSuccess?: (deletedId: string) => void;
}

export default function RecipeCard({
  recipe,
  currentUserId,
  isAdmin = false,
  onDeleteSuccess,
}: RecipeCardProps) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(recipe.likes_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  // --- Admin Mobile Long-Press & Delete States ---
  const [showMobileAdminMenu, setShowMobileAdminMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);

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

  // --- 3-Second Mobile Touch Handlers ---
  const handleTouchStart = () => {
    if (!isAdmin) return;
    longPressTriggeredRef.current = false;

    pressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setShowMobileAdminMenu(true);
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(60);
      }
    }, 3000);
  };

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (longPressTriggeredRef.current) {
      e.preventDefault();
      longPressTriggeredRef.current = false;
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/create?edit=${recipe.id}`);
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${recipe.title}"?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await supabase.from("recipe_steps").delete().eq("recipe_id", recipe.id);
      await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipe.id);
      await supabase.from("user_likes").delete().eq("recipe_id", recipe.id);
      await supabase.from("cooking_sessions").delete().eq("recipe_id", recipe.id);

      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipe.id);

      if (error) throw error;

      if (onDeleteSuccess) {
        onDeleteSuccess(recipe.id);
      }
    } catch (error) {
      console.error("Failed to delete recipe:", error);
      alert("Error deleting recipe. Make sure your admin RLS policy allows DELETE.");
      setIsDeleting(false);
    }
  };

  const handleLikeToggle = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!currentUserId) {
      alert("Please log in to like recipes!");
      return;
    }
    if (isLiking || !recipe) return;

    setIsLiking(true);

    const newIsLiked = !isLiked;
    const newCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);

    setIsLiked(newIsLiked);
    setLikeCount(newCount);

    try {
      if (newIsLiked) {
        const { error: likeErr } = await supabase
          .from("user_likes")
          .insert({ user_id: currentUserId, recipe_id: recipe.id });
        if (likeErr) throw likeErr;

        const { error: recErr } = await supabase
          .from("recipes")
          .update({ likes_count: newCount })
          .eq("id", recipe.id);
        if (recErr) throw recErr;
      } else {
        const { error: unlikeErr } = await supabase
          .from("user_likes")
          .delete()
          .eq("user_id", currentUserId)
          .eq("recipe_id", recipe.id);
        if (unlikeErr) throw unlikeErr;

        const { error: recErr } = await supabase
          .from("recipes")
          .update({ likes_count: newCount })
          .eq("id", recipe.id);
        if (recErr) throw recErr;
      }
    } catch (error) {
      setIsLiked(!newIsLiked);
      setLikeCount(newIsLiked ? Math.max(0, newCount - 1) : newCount + 1);
      console.error("Database rejected the like:", error);
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      onClick={handleCardClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearPressTimer}
      onTouchMove={clearPressTimer}
      onTouchCancel={clearPressTimer}
      onContextMenu={(e) => {
        if (isAdmin) e.preventDefault();
      }}
      className={`group flex flex-col h-full w-full bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden relative select-none ${
        isDeleting ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {/* Image Header - Strictly locked 16:9 ratio & shrink-0 so it never warps */}
      <div className="w-full aspect-video shrink-0 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
            <ChefHat className="w-8 h-8 sm:w-12 sm:h-12" />
          </div>
        )}

        {/* --- ADMIN CONTROLS (Hover on Desktop, 3s Hold on Mobile) --- */}
        {isAdmin && (
          <div
            className={`absolute top-2 sm:top-4 left-2 sm:left-4 z-20 flex items-center gap-1.5 transition-all duration-200 ${
              showMobileAdminMenu
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-95 pointer-events-none md:group-hover:opacity-100 md:group-hover:scale-100 md:group-hover:pointer-events-auto"
            }`}
          >
            <button
              type="button"
              onClick={handleEditClick}
              title="Edit Recipe"
              aria-label="Edit Recipe"
              className="p-2 sm:p-2.5 bg-blue-600/95 hover:bg-blue-700 text-white backdrop-blur-sm rounded-full shadow-md hover:scale-110 active:scale-95 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              title="Delete Recipe"
              aria-label="Delete Recipe"
              className="p-2 sm:p-2.5 bg-red-600/95 hover:bg-red-700 text-white backdrop-blur-sm rounded-full shadow-md hover:scale-110 active:scale-95 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {showMobileAdminMenu && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMobileAdminMenu(false);
                }}
                title="Close menu"
                aria-label="Close menu"
                className="p-2 bg-gray-900/80 text-white backdrop-blur-sm rounded-full shadow-md md:hidden"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* The Like Button */}
        <button
          type="button"
          title="like"
          onClick={handleLikeToggle}
          aria-label={isLiked ? "Unlike recipe" : "Like recipe"}
          className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10 p-2 sm:p-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-sm hover:scale-110 active:scale-95 transition-all"
        >
          <Heart
            className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
              isLiked
                ? "fill-red-500 text-red-500"
                : "text-gray-400 dark:text-gray-500"
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Card Content - flex-1 flex flex-col ensures equal vertical distribution */}
      <div className="p-3.5 sm:p-5 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex justify-between items-start gap-2 sm:gap-4 mb-1.5 sm:mb-2">
            {/* min-h reserves exact 2-line height even for 1-line titles */}
            <h3 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 min-h-[2.75rem] sm:min-h-[3.5rem]">
              {recipe.title}
            </h3>

            <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md sm:rounded-lg text-xs sm:text-sm font-bold shrink-0 transition-colors">
              <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              {likeCount}
            </div>
          </div>

          {/* min-h reserves exact 2-line height even for short overviews */}
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] mb-3 sm:mb-4 leading-relaxed transition-colors">
            {recipe.overview || "A delicious Kitchen OS recipe ready to be cooked."}
          </p>
        </div>

        {/* Time footer - mt-auto locks it to the bottom edge of every card */}
        <div className="mt-auto pt-2 border-t border-gray-50 dark:border-gray-700/50 flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium transition-colors">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0" />
            <span>{recipe.prep_time_mins + recipe.cook_time_mins} mins total</span>
          </div>
        </div>
      </div>
    </Link>
  );
}