"use client";

import { useState } from "react";

// describe the info for the food entry 
type FoodEntry = {
	id: number;
	foodName: string;
	calories: number;
	date: string;
};

export default function Home() {
	// store the food entries added during the session on current page
	const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);

	// stores the current value entered into the form
	const [foodName, setFoodName] = useState("");
	const [calories, setCalories] = useState("");
	const [date, setDate] = useState(
		new Date().toLocaleDateString("en-CA")
	);

	// calculate the calories recorded for the selected date
	const dailyCalories = foodEntries
		.filter((entry) => entry.date === date)
		.reduce((total, entry) => total + entry.calories, 0);

	// add the new food entry when the form is submitted 
	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const calorieAmount = Number(calories);

		// reject blank food names and invalid calorie amounts 
		if (!foodName.trim() || !Number.isFinite(calorieAmount) || calorieAmount <= 0) {
			return;
		}

		const newEntry: FoodEntry = {
			id: Date.now(),
			foodName: foodName.trim(),
			calories: calorieAmount,
			date,
		};

		// add the new entry without removing the existing ones
		setFoodEntries((previousEntries) => [...previousEntries, newEntry]);
		
		// clear the food name and calories for the next entry					
		setFoodName("");
		setCalories("");
	}

	return (
		<main className="min-h-screen bg-green-50 p-8">
			<div className="mx-auto max-w-4xl">
				{/* Page title and introduction */}
				<h1 className="text-3xl font-bold text-green-800">
					My Calorie Tracker
				</h1>

				<p className="mt-2 text-gray-600">
					Track your meals and work toward your daily calorie goal.
				</p>

				{/* Display the total calories for the selected date */}
				<section className="mt-8 rounded-xl bg-white p-6 shadow">
					<h2 className="text-xl font-semibold text-gray-800">
						Daily Calories
					</h2>

					<p className="mt-4 text-4xl font-bold text-green-700">
						{dailyCalories} calories
					</p>

					<label htmlFor="entry-date" className="mt-4 block text-gray-700">
						Select date
					</label>
					<input 
						id="entry-date"
						type="date"
						value={date}
						onChange={(event) => setDate(event.target.value)}
						className="mt-1 rounded border border-gray-300 p-2"
					/>
				</section>

				{/* Form for recording food name, calories, and date */}
				<section className="mt-6 rounded-xl bg-white p-6 shadow">
					<h2 className="text-xl font-semibold text-gray-800">Add Food</h2>

					<form onSubmit={handleSubmit} className="mt-4 space-y-4">
						<div>
							<label htmlFor="food-name" className="block text-gray-700">
								Food name
							</label>
							<input
								id="food-name"
								type="text"
								value={foodName}
								onChange={(event) => setFoodName(event.target.value)}
								required
								className="mt-1 w-full rounded border border-gray-300 p-2"
								placeholder="e.g., Chicken Fingers"
							/>
						</div>

						<div>
							<label htmlFor="calories" className="block text-gray-700">
								Calories
							</label>
							<input
								id="calories"
								type="number"
								min="0.1"
								step="any"
								value={calories}
								onChange={(event) => setCalories(event.target.value)}
								required
								className="mt-1 w-full rounded border border-gray-300 p-2"
								placeholder="e.g., 500"
							/>
						</div>

						<button 
							type="submit"
							className="rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800"
						>
							Add Food
						</button>
					</form>
				</section>
				
				{/* Lists food entries recorded for the selected date */}
				<section className="mt-6 rounded-xl bg-white p-6 shadow">
					<h2 className="text-xl font-semibold text-gray-800">
						Food Log
					</h2>
				
					{foodEntries.filter((entry) => entry.date === date).length === 0 ? (
						<p className="mt-3 text-gray-500">
							No food entries for this date yet.
						</p>
					) : (
						<ul className="mt-3 divide-y divide-gray-200">
							{foodEntries
								.filter((entry) => entry.date === date)
								.map((entry) => (
									<li
										key={entry.id}
										className="flex justify-between py-3"
									>
										<span>{entry.foodName}</span>
										<span className="font-semibold">
											{entry.calories} calories
										</span>
									</li>
								))}
						</ul>
					)}
				</section>
			</div>
		</main>
	);
}
