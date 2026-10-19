"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Trash2, Plus, PackageOpen } from "lucide-react";
import { PantryItem } from "@/lib/types";
import SkeletonLoader from "@/components/SkeletonLoader";

export default function PantryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("grams");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const fetchPantry = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        
        // Fetch all ingredients belonging to this specific user
        const { data } = await supabase
          .from("pantry_items")
          .select("*")
          .eq("user_id", session.user.id)
          .order("name");
          
        if (data) setItems(data);
      }
      setLoading(false);
    };
    
    fetchPantry();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !quantity) return;
    setIsAdding(true);

    try {
      const { data, error } = await supabase
        .from("pantry_items")
        .insert({
          user_id: user.id,
          name: name.trim(),
          quantity: parseFloat(quantity),
          unit: unit.trim(),
          category: "Uncategorized"
        })
        .select()
        .single();

      if (error) {
        // Catch the exact error code for our Unique Index!
        if (error.code === '23505') { 
          alert(`You already have ${name} in your pantry! Please delete it first or wait for the update feature.`);
        } else {
          throw error;
        }
      } else if (data) {
        // Add it to the screen instantly and sort alphabetically
        setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        
        // Clear the form
        setName("");
        setQuantity("");
      }
    } catch (error) {
      console.error("Failed to add item:", error);
      alert("Error adding item to pantry.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic UI: Remove it from the screen instantly
    setItems((prev) => prev.filter(item => item.id !== id)); 
    
    // Delete from database in the background
    await supabase.from("pantry_items").delete().eq("id", id);
  };

  if (loading) return <SkeletonLoader />;
  
  if (!user) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 transition-colors duration-200">Please log in to view your pantry.</div>;
  }

  return (
    // Added dark:bg-gray-900, w-full, and transitions
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 pb-24 w-full transition-colors duration-200">
      <div className="max-w-4xl mx-auto w-full">
        {/* Added dark:text-white */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Smart Pantry</h1>
        {/* Added dark:text-gray-400 */}
        <p className="text-gray-600 dark:text-gray-400 mb-8">Manage your kitchen inventory so Kitchen OS can cook for you.</p>

        {/* 1. Add Ingredient Form */}
        {/* Added dark:bg-gray-800, dark:border-gray-700 */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8 transition-colors duration-200">
          {/* Added dark:text-white */}
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            Restock Fridge
          </h2>
          <form onSubmit={handleAddItem} className="flex flex-col md:flex-row gap-4 w-full">
            {/* Added dark:bg-gray-900, dark:border-gray-700, dark:text-white, dark:focus:bg-gray-800 */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chicken Breast"
              className="flex-grow p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-white bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
            />
            <div className="flex gap-2 w-full md:w-auto">
              {/* Added dark:bg-gray-900, dark:border-gray-700, dark:text-white, dark:focus:bg-gray-800 */}
              <input
                type="number"
                step="0.1"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Qty"
                className="w-24 p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-white bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
              {/* Added dark:bg-gray-900, dark:border-gray-700, dark:text-white, dark:focus:bg-gray-800 */}
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                title="Unit"
                aria-label="Unit"
                className="w-28 p-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-white bg-gray-50 dark:bg-gray-900 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
              >
                <option value="grams">grams</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="liters">liters</option>
                <option value="cups">cups</option>
                <option value="pieces">pieces</option>
                <option value="tbsp">tbsp</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isAdding}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isAdding ? "Adding..." : "Add to Pantry"}
            </button>
          </form>
        </div>

        {/* 2. The Inventory List */}
        {/* Added dark:bg-gray-800, dark:border-gray-700 */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-200 w-full">
          {items.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <PackageOpen className="w-16 h-16 text-gray-200 dark:text-gray-700 mb-4" />
              {/* Added dark:text-white */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Your pantry is empty</h3>
              {/* Added dark:text-gray-400 */}
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">Start adding ingredients above to let Kitchen OS know what you have available to cook.</p>
            </div>
          ) : (
            // Added dark:divide-gray-700
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 w-full">
              {items.map((item) => (
                // Added dark:hover:bg-gray-700/50
                <li key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div>
                    {/* Added dark:text-white */}
                    <h3 className="font-bold text-gray-900 dark:text-white capitalize">{item.name}</h3>
                    {/* Added dark:text-gray-400 */}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                  {/* Added dark:text-gray-500, dark:hover:text-red-400, dark:hover:bg-red-950/30 */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-all"
                    title="Remove from pantry"
                    aria-label="Remove from pantry"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}