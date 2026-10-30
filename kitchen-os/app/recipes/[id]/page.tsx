"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Clock, Users, ArrowLeft, Heart, BookmarkPlus, Play, Star, ChefHat } from "lucide-react";
import { RecipeDetail, RecipeStep, Review } from "@/lib/types";
import SkeletonLoader from "@/components/SkeletonLoader";
import Image from "next/image";

export default function RecipeDetailPage() {
  
  const params = useParams();
  const router = useRouter();
  
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- LIKE BUTTON STATE ---
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // --- REVIEWS STATE ---
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0); 

  useEffect(() => {
    async function fetchRecipeDetails() {

      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (authSession) {
        setCurrentUserId(authSession.user.id);
        const { data: savedData } = await supabase
          .from("saved_recipes")
          .select("id")
          .eq("user_id", authSession.user.id)
          .eq("recipe_id", params.id)
          .single();

        if (savedData) {
          setIsSaved(true);
        }
      }

      const { data, error } = await supabase
        .from("recipes")
        .select(`
          *,
          recipe_ingredients (
            quantity,
            unit,
            is_core,
            ingredients (name)
          ),
          recipe_steps (
            step_number,
            instruction
          )
        `)
        .eq("id", params.id)
        .single(); 

      if (error) {
        console.error("Error fetching recipe:", error.message);
      } else {
        if (data.recipe_steps) {
          data.recipe_steps.sort((a: RecipeStep, b: RecipeStep) => a.step_number - b.step_number);
        }
        setRecipe(data);
      }
      setLoading(false);
    }

    if (params.id) {
      fetchRecipeDetails();
    }
  }, [params.id]);

  useEffect(() => {
    const fetchLikeStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
        
        if (recipe?.id) {
          setLikeCount(recipe.likes_count || 0); 
          
          const { data } = await supabase
            .from("user_likes")
            .select("id")
            .eq("user_id", session.user.id)
            .eq("recipe_id", recipe.id)
            .maybeSingle();
            
          if (data) setIsLiked(true);
        }
      }
    };
    fetchLikeStatus();
  }, [recipe?.id, recipe?.likes_count]); 

  useEffect(() => {
    const fetchReviews = async () => {
      if (!recipe?.id) return;
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("recipe_id", recipe.id)
        .order("created_at", { ascending: false });

      if (data && !error) setReviews(data);
    };
    fetchReviews();
  }, [recipe?.id]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      alert("You must be logged in to leave a review.");
      return;
    }
    if (rating < 1 || rating > 5) return;

    setIsSubmittingReview(true);

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        user_id: currentUserId,
        recipe_id: recipe!.id,
        rating,
        comment: comment.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to post review:", error);
      alert("There was an error saving your review.");
    } else {
      setReviews([data, ...reviews]);
      setComment(""); 
      setRating(5);   
    }
    setIsSubmittingReview(false);
  };

  const handleLikeToggle = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault(); 
    
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
      setIsLiked(!newIsLiked);
      setLikeCount(newIsLiked ? Math.max(0, newCount - 1) : newCount + 1);
      console.error("Database rejected the like:", error);
    } finally {
      setIsLiking(false);
    }
  };

  const triggerPreflight = () => {
    setShowPreflight(true);
  };

  const confirmAndStartCooking = async () => {
    setStartingSession(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push("/login");
      return;
    }

    const { data: newSession, error } = await supabase
      .from("cooking_sessions")
      .insert({
        user_id: session.user.id,
        recipe_id: recipe?.id,
        current_step: 1,
        status: "active"
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to start session:", error.message);
      setStartingSession(false);
    } else {
      router.push(`/cook/${newSession.id}`);
    }
  };

  const toggleSaveRecipe = async () => {
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    if (isSaved) {
      await supabase
        .from("saved_recipes")
        .delete()
        .eq("user_id", session.user.id)
        .eq("recipe_id", recipe?.id);
      setIsSaved(false);
    } else {
      await supabase
        .from("saved_recipes")
        .insert({
          user_id: session.user.id,
          recipe_id: recipe?.id
        });
      setIsSaved(true);
    }
    setIsSaving(false);
  };

  if (loading) return <SkeletonLoader type="recipe" />;

  if (!recipe) {
    return <div className="p-6 text-center text-red-500">Recipe not found.</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 w-full transition-colors duration-200">
      
     {/* --- HERO IMAGE BANNER --- */}
      <div className="w-full relative aspect-video md:h-[400px] md:aspect-auto bg-slate-100 dark:bg-slate-800 overflow-hidden">
        
        {/* The Back Button */}
        <button
          type="button"
          title="Go back"
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-20 p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
        </button>

        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt={recipe.title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
            <ChefHat className="w-16 h-16 sm:w-24 sm:h-24" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30 pointer-events-none z-10" />
      </div>

      {/* Main Content Layout Block */}
      <div className="p-6 -mt-6 relative bg-gray-50 dark:bg-gray-900 rounded-t-2xl w-full max-w-4xl mx-auto transition-colors duration-200">
        
        {/* Title Block Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 w-full">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">{recipe.title}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{recipe.overview || "A delicious recipe curated by Kitchen OS."}</p>
          </div>

          {/* Dynamic Like Button Row */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleLikeToggle}
              aria-label={isLiked ? "Unlike recipe" : "Like recipe"}
              className={`p-3 bg-white dark:bg-gray-800 rounded-full shadow-sm transition-all hover:scale-110 active:scale-95 border ${
                isLiked ? "border-red-100 dark:border-red-900/50" : "border-gray-100 dark:border-gray-700"
              }`}
              title={isLiked ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart 
                className={`w-5 h-5 transition-colors ${
                  isLiked ? "fill-red-500 text-red-500" : "text-gray-400 dark:text-gray-500 hover:text-red-500"
                }`} 
                aria-hidden="true" 
              />
            </button>
            
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 transition-colors">
              {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex gap-6 mb-8 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 pb-6 w-full transition-colors">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>{recipe.prep_time_mins + recipe.cook_time_mins} mins</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span>{recipe.default_servings} servings</span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-3 mb-8 w-full">
          <button 
            onClick={triggerPreflight}
            disabled={startingSession}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Play className="w-5 h-5" />
            {startingSession ? "Starting..." : "Cook Now"}
          </button>
          
          {/* Dynamic Save Later Button */}
          <button 
            onClick={toggleSaveRecipe}
            disabled={isSaving}
            className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm border ${
              isSaved 
                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 hover:bg-blue-100" 
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            <BookmarkPlus className={`w-5 h-5 ${isSaved ? "text-blue-600 dark:text-blue-400 fill-current" : "text-gray-500 dark:text-gray-400"}`} />
            {isSaving ? "Saving..." : isSaved ? "Saved" : "Bookmark"}
          </button>
        </div>

        {/* Ingredients Section */}
        <div className="mb-8 w-full">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Ingredients</h2>
          <ul className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden w-full transition-colors duration-200">
            {recipe.recipe_ingredients.map((item, idx: number) => (
              <li key={idx} className="flex justify-between items-center p-4 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <span className="text-gray-900 dark:text-gray-200 font-medium">{item.ingredients.name}</span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">{item.quantity} {item.unit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Steps Preview Section */}
        <div className="mb-8 w-full">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Steps Preview</h2>
          <div className="space-y-4 w-full">
            {recipe.recipe_steps.map((step) => (
              <div key={step.step_number} className="flex gap-4 w-full">
                <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm transition-colors">
                  {step.step_number}
                </div>
                <p className="text-gray-700 dark:text-gray-300 pt-1 leading-relaxed grow">{step.instruction}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Pre-Flight Checklist Modal Overlay */}
      {showPreflight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 dark:bg-gray-950/80 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-gray-900 border border-transparent dark:border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 transition-colors">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Pre-Flight Checklist</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Do you have all the ingredients ready on your counter?
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto border border-gray-100 dark:border-gray-700 text-sm transition-colors">
              <ul className="space-y-2">
                {recipe.recipe_ingredients.map((item, idx) => (
                  <li key={idx} className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{item.ingredients.name}</span>
                    <span className="text-gray-500 dark:text-gray-500">{item.quantity} {item.unit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowPreflight(false)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white py-3 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Not Yet
              </button>
              <button 
                onClick={confirmAndStartCooking}
                disabled={startingSession}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm text-center"
              >
                {startingSession ? "Starting..." : "Let's Cook"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- REVIEWS SECTION --- */}
      <div className="max-w-4xl mx-auto px-6 pb-24 w-full">
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 mt-8 transition-colors duration-200 w-full">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400 fill-current" />
            Chef Reviews ({reviews.length})
          </h2>

          {/* 1. The Input Form (Only show if logged in) */}
          {currentUserId ? (
            <form onSubmit={handleSubmitReview} className="mb-10 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 transition-colors w-full">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Leave a Review</h3>
              
              {/* Interactive Star Selector */}
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    title="rating"
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star 
                      className={`w-8 h-8 transition-colors ${
                        star <= (hoveredStar || rating) 
                          ? "fill-amber-400 text-amber-400" 
                          : "text-gray-300 dark:text-gray-600"
                      }`} 
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you think of this recipe? (Optional)"
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24 mb-4 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              
              <button
                type="submit"
                disabled={isSubmittingReview}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmittingReview ? "Posting..." : "Post Review"}
              </button>
            </form>
          ) : (
            <div className="mb-10 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 text-center transition-colors w-full">
              <p className="text-gray-500 dark:text-gray-400">Please log in to share your thoughts.</p>
            </div>
          )}

          {/* 2. The Comments List */}
          <div className="space-y-6 divide-y divide-gray-100 dark:divide-gray-700 w-full">
            {reviews.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center italic py-4">No reviews yet. Be the first to rate this recipe!</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 dark:border-gray-700/50 pb-6 last:border-0 last:pb-0 pt-6 first:pt-0 w-full transition-colors">
                  <div className="flex items-center gap-2 mb-2 w-full">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`w-4 h-4 ${star <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200 dark:text-gray-600"}`} 
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white ml-2">A Fellow Chef</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-2">{review.comment}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </main>
  );
}