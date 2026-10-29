"use client";

import { useEffect, useState } from "react";

// describe the info for the food entry 
type FoodEntry = {
	id: number;
	foodName: string;
	calories: number;
	date: string;
};

export default function Home() {
	// track which screen the user should see
	const [view, setView] = useState<"login" | "register" | "tracker">("login");
	
	// store the email and password 
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	// store message that inform the user whether authentication succeeded or failed
	const [authMessage, setAuthMessage] = useState("");

	// store the id of the user who logs in successfully 
	const [userId, setUserId] = useState<number | null>(null);

	// store the food entries added during the session on current page
	const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);

	// store the user's daily calorie goal 
	const [calorieGoal, setCalorieGoal] = useState("2000");

    const [isEditingGoal, setIsEditingGoal] = useState(false);
	
	// store messages about saving the calorie goal to the backend 
	const [goalMessage, setGoalMessage] = useState("");

	// load the saved food entries from the backend when the page opens 
	useEffect(() => {
		async function loadFoodEntries() {
			try {
				// request saved entries from FastAPI
				const response = await fetch(
					`http://localhost:8000/food-entries?user_id=${userId}`
				);

				// stop if the backend reports an error 
				if (!response.ok) {
					throw new Error("Could not load food entries.");
				}

				// convert the response into a food entry data 
				const data = await response.json();
		
				// convert backend field names into frontend field names
				const savedEntries: FoodEntry[] = data.map(
					(entry: {
						id: number;
						food_name: string;
						calories: number;	
						entry_date: string;
					}) => ({
						id: entry.id,
						foodName: entry.food_name,
						calories: entry.calories,
						date: entry.entry_date.slice(0, 10),
					})
				);
				
				// display the entries retrieved from the database
				setFoodEntries(savedEntries);
			} catch (error) {
				// report errors 
				console.error("Error while loading food entries:", error);
			}
		}
		
		if (userId === null) return;
		
		loadFoodEntries();
	}, [userId]);

	// load the user's saved calorie goal 
	useEffect(() => {
			async function loadCalorieGoal() {
					try {
						const response = await fetch(
							`http://localhost:8000/calorie-goal?user_id=${userId}`
						);

						if (!response.ok) {
								throw new Error("Could not load calorie goal.");

						}

						const data = await response.json();

						// display the saved goal to the input field 
						setCalorieGoal(String(data.daily_calorie_goal));
					} catch (error) {
						console.error("Error while loading calorie goal:", error);
						setGoalMessage("Could not load your calorie goal.");
					}
			}

			// wait until the user has logged in 
			if (userId == null) return;

			loadCalorieGoal();
	}, [userId]);

	// stores the current value entered into the form
	const [foodName, setFoodName] = useState("");
	const [calories, setCalories] = useState("");
	const [date, setDate] = useState("");
    // set the selected date after the component loads in the browser.
    useEffect(() => {
        setDate(new Date().toLocaleDateString("en-CA"));
    }, []);


	// calculate the calories recorded for the selected date
	const dailyCalories = foodEntries
		.filter((entry) => entry.date === date)
		.reduce((total, entry) => total + entry.calories, 0);

    //calculate how many calories remain under the daily goal
    const caloriesRemaining = Number(calorieGoal) - dailyCalories;

	// add the new food entry when the form is submitted 
	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const calorieAmount = Number(calories);

		// reject blank food names and invalid calorie amounts 
		if (
			!foodName.trim() ||
			!Number.isFinite(calorieAmount) ||
			calorieAmount <= 0
		) {
			return;
		}
		
		try {
			// send the food entry to FastAPI
			const response = await fetch("http://localhost:8000/food-entries", {
				method : "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify ({
					user_id: userId,
					food_name: foodName.trim(),
					calories: calorieAmount,
					entry_date: `${date}T12:00:00Z`,
				}),
			});

			// stop if the backened reports an error 
			if (!response.ok) {
				throw new Error("Could not save food entry.");
			}

			// display the new entry if the backend accepts it 
			const newEntry: FoodEntry = {
				id: Date.now(),
				foodName: foodName.trim(),
				calories: calorieAmount,
				date,
			};

			// add the new entry without removing existing entries
			setFoodEntries((previousEntries) => [...previousEntries, newEntry]);

			// clear the form for the next entry
			setFoodName("");
			setCalories("");
		} catch (error) {
			// report an error if saving fails 
			console.error("Error saving food entry:", error);
			alert("Could not save the food entry. Check the backend.");
		}
	}


        // handle account registration and login form submissions.
        async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
                // Prevent the browser from reloading the page when the form is submitted.
                event.preventDefault();

                // choose the backend endpoint based on the current screen.
                const endpoint =
                        view === "register"
                                ? "http://localhost:8000/register"
                                : "http://localhost:8000/login";

                try {
                        // send the submitted email and password to the backend.
                        const response = await fetch(endpoint, {
                                method: "POST",
                                headers: {
                                        "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ email, password }),
                        });

                        // read the response from the backend.
                        const data = await response.json();

                        // display the backend's error if authentication fails.
                        if (!response.ok) {
                                setAuthMessage(data.detail || "Authentication failed.");
                                return;
                        }

                        // save the ID returned by the backend.
                        setUserId(data.user_id);

                        // display the success message returned by the backend.
                        setAuthMessage(data.message);

                        // open the calorie tracker after successful authentication.
                        setView("tracker");
                } catch (error) {
                        // display a message if the backend cannot be reached.
                        console.error("Authentication error:", error);
                        setAuthMessage("Could not connect to the server. Please try again.");
                }
        }

		async function handleSaveCalorieGoal() {
			// make sure a user is logged in 
			if (userId === null) return;

			const goalValue = Number(calorieGoal);

			// only allow positive, whole number goals 
			if (!Number.isInteger(goalValue) || goalValue <= 0) {
				setGoalMessage("Enter a positive whole-number calorie goal.");
				return;
			}

			try {
				const response = await fetch("http://localhost:8000/calorie-goal", {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},

					body: JSON.stringify({
						user_id: userId,
						daily_calorie_goal: goalValue,
					}),
				});

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.detail || "Could not save calorie goal.");
				}

				setCalorieGoal(String(data.daily_calorie_goal));
				setGoalMessage("Calorie goal saved successfully!");
                setIsEditingGoal(false);
			} catch (error) {
				console.error("Error saving calorie goal:", error);
				setGoalMessage("Could not save your calorie goal. Please try again.");
			}
		}


        // display the login or registration screen before showing the tracker.
        if (view !== "tracker") {
                return (
                        <main className="min-h-screen bg-green-50 p-8">
                                <div className="mx-auto max-w-md rounded-xl bg-white p-6 shadow">
                                        {/* explain the purpose of the authentication screen. */}
                                        <h1 className="text-3xl font-bold text-green-800">
                                                {view === "register" ? "Create Account" : "Welcome Back"}
                                        </h1>

                                        <p className="mt-2 text-gray-600">
                                                {view === "register"
                                                        ? "Register to start tracking your meals."
                                                        : "Log in to access your calorie tracker."}
                                        </p>

                                        {/* collect the email and password for authentication. */}
                                        <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
                                                <div>
                                                        <label htmlFor="auth-email" className="block text-gray-700">
                                                                Email
                                                        </label>
                                                        <input
                                                                id="auth-email"
                                                                type="email"
                                                                value={email}
                                                                onChange={(event) => setEmail(event.target.value)}
                                                                required
                                                                className="mt-1 w-full rounded border border-gray-300 p-2"
                                                        />
                                                </div>

                                                <div>
                                                        <label htmlFor="auth-password" className="block text-gray-700">
                                                                Password
                                                        </label>
                                                        <input
                                                                id="auth-password"
                                                                type="password"
                                                                value={password}
                                                                onChange={(event) => setPassword(event.target.value)}
                                                                required
                                                                className="mt-1 w-full rounded border border-gray-300 p-2"
                                                        />
                                                </div>

                                                {/* submit the form to the appropriate backend endpoint. */}
                                                <button
                                                        type="submit"
                                                        className="w-full rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800"
                                                >
                                                        {view === "register" ? "Create Account" : "Log In"}
                                                </button>
                                        </form>

                                        {/* display success or error feedback from the backend. */}
                                        {authMessage && (
                                                <p className="mt-4 text-sm text-gray-700" role="status">
                                                        {authMessage}
                                                </p>
                                        )}

                                        {/* allow users to switch between login and registration. */}
                                        <p className="mt-5 text-sm text-gray-600">
                                                {view === "register"
                                                        ? "Already have an account?"
                                                        : "New here?"}{" "}
                                                <button
                                                        type="button"
                                                        onClick={() => {
                                                                setView(view === "register" ? "login" : "register");
                                                                setAuthMessage("");
                                                        }}
                                                        className="font-semibold text-green-700 underline"
                                                >
                                                        {view === "register" ? "Log in" : "Create an account"}
                                                </button>
                                        </p>
                                </div>
                        </main>
                );
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

                    {/* Display calories remaining under the daily goal */}
                    <p className="mt-3 text-lg text-gray-700">
                        {caloriesRemaining >= 0 ? (
                            <>
                                <span className="font-semibold">{caloriesRemaining.toLocaleString()}</span>
                                {" calories remaining"}
                            </>
                        ) : (
                            <>
                            <span className="font-semibold">
                                {Math.abs(caloriesRemaining).toLocaleString()}
                            </span>
                            {" calories over your goal"}
                            </>
                        )}
                    </p>

				{/* Display and update the daily calorie goal */}
				<div className="mt-6">
					<p className="text-sm text-gray-600">Daily Calorie Goal</p>

					{/* Show the saved goal as text instead of a permanent textbox */}
					<p className="mt-1 text-2xl font-bold text-green-800">
						{Number(calorieGoal).toLocaleString()} calories
					</p>

					{/* Toggle between editing and viewing the goal */}
					<button
						type="button"
						onClick={() => {
							if (isEditingGoal) {
								setIsEditingGoal(false);
								setGoalMessage("");
							} else {
								setIsEditingGoal(true);
								setGoalMessage("");
							}
						}}
						className="mt-2 rounded-lg border border-green-700 px-4 py-2 font-semibold text-green-700 hover:bg-green-50"
					>
						{isEditingGoal ? "Cancel" : "Edit Goal"}
					</button>

					{/* Only show the input and Save button while editing */}
					{isEditingGoal && (
						<div className="mt-3 flex flex-wrap gap-3">
							<input
								id="calorie-goal"
								type="number"
								min="1"
								step="1"
								value={calorieGoal}
								onChange={(event) => setCalorieGoal(event.target.value)}
								className="rounded border border-gray-300 p-2"
							/>

							<button
								type="button"
								onClick={handleSaveCalorieGoal}
								className="rounded-lg bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800"
							>
								Save Goal
							</button>
						</div>
					)}

					{/* Display the result of saving the goal */}
					{goalMessage && (
						<p className="mt-2 text-sm text-gray-700" role="status">
							{goalMessage}
						</p>
					)}
				</div>



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

