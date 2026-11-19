"use client";

import { useEffect, useState } from "react";
import {BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

	// track whether the initial session check has finished 
	const [checkingSession, setCheckingSession] = useState(true);

	// store the food entries added during the session on current page
	const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);

	// track which food entry is currently being edited 
	const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

	// store the updated information while editing 
	const [editFoodName, setEditFoodName] = useState("");
	const [editCalories, setEditCalories] = useState("");
	const [editDate, setEditDate] = useState("");

	// store the user's daily calorie goal 
	const [calorieGoal, setCalorieGoal] = useState("2000");

	// track the selected number of days for the calorie history graph
	const [historyRange, setHistoryRange] = useState <7 | 14 | 30>(7);

    const [isEditingGoal, setIsEditingGoal] = useState(false);
	
	// store messages about saving the calorie goal to the backend 
	const [goalMessage, setGoalMessage] = useState("");

	useEffect(() => {
		async function restoreSession() {
			try {
				const response = await fetch("http://localhost:8000/session", {
					credentials: "include",
				});

				if (response.ok) {
					const data = await response.json();

					setUserId(data.user_id);
					setView("tracker");
				}
			} catch (error) {
				console.error("Could not restore session:", error);
			} finally {
				setCheckingSession(false);
			}
		}

		restoreSession();
	}, []);

	// automatically log out after five minutes of inactivity
	useEffect(() => {
		// only track inactivity when someone is logged in
		if (userId === null) return;

		const INACTIVITY_LIMIT = 5 * 60 * 1000;
		const REFRESH_INTERVAL = 30 * 1000;

		let inactivityTimer: ReturnType<typeof setTimeout>;
		let lastActivity = Date.now();
		let lastRefresh = Date.now();
		let refreshing = false;
		let stopped = false;

		// clear the account information after the session expires
		function expireSession() {
			if (stopped) return;

			stopped = true;
			// invalidate the session on the backend as well
			void fetch("http://localhost:8000/logout", {
				method: "POST",
				credentials: "include",
			}).catch((error) => {
				console.error("Could not invalidate expired session:", error);
			});
			setUserId(null);
			setFoodEntries([]);
			setEmail("");
			setPassword("");
			setAuthMessage("Your session expired. Please log in again.");
			setView("login");
		}

		// check the backend and renew the session during genuine activity
		async function refreshSession() {
			if (refreshing || stopped) return;

			refreshing = true;

			try {
				const response = await fetch("http://localhost:8000/session", {
					credentials: "include",
				});

				if (response.status === 401) {
					expireSession();
				} else if (response.ok) {
					lastRefresh = Date.now();
				}
			} catch (error) {
				console.error("Session refresh error:", error);
			} finally {
				refreshing = false;
			}
		}

		// restart the inactivity countdown whenever the user interacts
		function recordActivity() {
			if (stopped) return;

			const now = Date.now();

			// do not revive a session after five minutes of inactivity
			if (now - lastActivity >= INACTIVITY_LIMIT) {
				expireSession();
				return;
			}

			lastActivity = now;

			clearTimeout(inactivityTimer);
			inactivityTimer = setTimeout(expireSession, INACTIVITY_LIMIT);

			// avoid sending a request for every mouse movement
			if (now - lastRefresh >= REFRESH_INTERVAL) {
				lastRefresh = now;
				void refreshSession();
			}
		}

		// start the initial countdown
		inactivityTimer = setTimeout(expireSession, INACTIVITY_LIMIT);

		const activityEvents = [
			"mousemove",
			"keydown",
			"click",
			"scroll",
			"touchstart",
		];

		activityEvents.forEach((eventName) => {
			window.addEventListener(eventName, recordActivity);
		});

		// remove timers and listeners when the user logs out
		return () => {
			stopped = true;
			clearTimeout(inactivityTimer);

			activityEvents.forEach((eventName) => {
				window.removeEventListener(eventName, recordActivity);
			});
		};
	}, [userId]);	

	// load the saved food entries from the backend when the page opens 
	useEffect(() => {
		async function loadFoodEntries() {
			try {
				// request saved entries from FastAPI
				const response = await fetch(
					`http://localhost:8000/food-entries?user_id=${userId}`,
					{
						credentials: "include",
					}
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
							`http://localhost:8000/calorie-goal?user_id=${userId}`,
							{
								credentials: "include",
							}
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

	// calculate the total calorie consumed for each recorded date 
	const calorieHistory = Object.entries(
		foodEntries.reduce<Record<string, number>>((totals, entry) => {
			totals[entry.date] = (totals[entry.date] || 0) + entry.calories;
			return totals;
		}, {})
	)
		.map(([date, calories]) => ({
			date,
			calories,
		}))

		.sort((a, b) => a.date.localeCompare(b.date));
	
	// filter calorie history based on the selected number of days
	const today = new Date();
	const startDate = new Date();

	startDate.setDate(today.getDate() - historyRange + 1);

	const filteredCalorieHistory = Array.from(
		{ length: historyRange },
		(_, index) => {
			const currentDate = new Date(startDate);
			currentDate.setDate(startDate.getDate() + index);

			const dateString = [
				currentDate.getFullYear(),
				String(currentDate.getMonth() + 1).padStart(2, "0"),
				String(currentDate.getDate()).padStart(2, "0"),
			].join("-");

			const savedEntry = calorieHistory.find(
				(entry) => entry.date === dateString
			);

			return {
				date: dateString,
				calories: savedEntry ? savedEntry.calories : 0,
			};
		}
	);

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
				credentials: "include",
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

			// get the food entry ID assigned by PostgreSQL
			const data = await response.json();

			const newEntry: FoodEntry = {
				id: data.entry_id,
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

								credentials: "include",
                                body: JSON.stringify({ email, password }),
                        });

                        // read the response from the backend.
                        const data = await response.json();

                        // display the backend's error if authentication fails.
                        if (!response.ok) {
                                setAuthMessage(data.detail || "Authentication failed.");
														return;
												}

						// registration creates an account but does not log the user in
						if (view === "register") {
							setView("login");
							setPassword("");
							setAuthMessage("Account created successfully! Please log in.");
							return;
						}

						// successful login stores the authenticated user's ID
						setUserId(data.user_id);
						setAuthMessage(data.message);
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
					credentials: "include",
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

		function handleStartEdit(entry: FoodEntry) {
			setEditingEntryId(entry.id);
			setEditFoodName(entry.foodName);
			setEditCalories(String(entry.calories));
			setEditDate(entry.date);
		}

		function handleCancelEdit() {
			setEditingEntryId(null);
		}

		// save the updated food entry to the backend and update the state 
		async function handleSaveEdit(entryId: number) {
			if (userId === null) return;

			const calorieAmount = Number(editCalories);

			// reject invalid information
			if (
				!editFoodName.trim() ||
				editCalories.trim() === "" ||
				!Number.isFinite(calorieAmount) ||
				calorieAmount <= 0 ||
				!editDate
			) {
				alert("Enter a food name, positive calories, and a date.");
				return;
			}

			try {
				// send the updated food entry to FastAPI
				const response = await fetch(
					`http://localhost:8000/food-entries/${entryId}`,
					{
						method: "PUT",
						credentials: "include",
						headers: {
							"Content-Type": "application/json",

						},

						body: JSON.stringify({
							user_id: userId,
							food_name: editFoodName.trim(),
							calories: calorieAmount,
							entry_date: `${editDate}T12:00:00Z`,
						}),
					}
				);

				if (!response.ok) {
					throw new Error("Could not update food entry.");
				}

				// update the food entry displayed on the page 
				setFoodEntries((previousEntries) =>
					previousEntries.map((entry) =>
						entry.id === entryId 
							? { 
								...entry, 
								foodName: editFoodName.trim(), 
								calories: calorieAmount, 
								date: editDate 
							  }
							: entry
					)
				);

				// close the editing frame 
				setEditingEntryId(null);
			} catch (error) {
				console.error("Error updating food entry:", error);
				alert("Could not update the food entry. Please try again.");
			}
		}

		// delete a food entry from the backend and remove it from the state 
		async function handleDeleteEntry(entryId: number) {
			// make sure the user is logged in 
			if (userId === null) return;

			// ask the user to confirm before deleting the entry 
			const confirmed = window.confirm(
				"Are you sure you want to delete this food entry?"
			);

			// stop if the user cancels the deletion
			if (!confirmed) return;

			try {
				// send the delete request to FastAPI
				const response = await fetch(
					`http://localhost:8000/food-entries/${entryId}?user_id=${userId}`,
					{
						method: "DELETE",
						credentials: "include",
					}
				);

				// stop if the backend could not delete the entry
				if (!response.ok) {
					throw new Error("Could not delete food entry.");
				}

				// remove the deleted entry from the displayed food log
				setFoodEntries((previousEntries) =>
					previousEntries.filter((entry) => entry.id !== entryId)
				);
			} catch (error) {
				console.error("Error deleting food entry:", error);
				alert("Could not delete the food entry. Please try again.");
			}
		}

		// Log out the current user 
		async function handleLogout() {
			try {
				// tell FastAPI to delete the session 
				const response = await fetch("http://localhost:8000/logout", {
					method: "POST",
					credentials: "include",
				});

				if (!response.ok) {
					throw new Error("Logout failed.");
				}
			} catch (error) {
				console.error("Logout error:", error);
			} finally {
				// clear the user's info from the screen
				setUserId(null);
				setFoodEntries([]);
				setEmail("");
				setPassword("");
				setAuthMessage("");

				// return to the login screen
				setView("login");

			}
		}

		if (checkingSession) {
			return (
				<main className="min-h-screen bg-green-50 p-8">
					<p className="text-center text-gray-700">
						Checking your session...
					</p>
				</main>
			);
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
					Track your meals and work toward your daily calorie goal!
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

				{/* Display the user's calorie history graph */}
				<section className="mt-6 rounded-xl bg-white p-6 shadow">
					<h2 className="text-xl font-semibold text-gray-800">
						Calorie History
					</h2>
				{/* allow users to select the calorie history time range */}
				<div className="mt-4">
					<label htmlFor="history-range" className="block text-gray-700">
						Select time range
					</label>

					<select
						id="history-range"
						value={historyRange}
						onChange={(event) =>
							setHistoryRange(Number(event.target.value) as 7 | 14 | 30)
						}
						className="mt-1 rounded border border-gray-300 p-2"
					>
						<option value={7}>Last 7 days</option>
						<option value={14}>Last 14 days</option>
						<option value={30}>Last 30 days</option>
					</select>
				</div>
					<p className="sr-only">
						This bar chart displays the total calories consumed on each recorded date.
					</p>
					<ul className="sr-only">
						{filteredCalorieHistory.map((entry) => (
							<li key={entry.date}>
								{entry.date}: {entry.calories} calories
							</li>
						))}
					</ul>

					<div className="mt-4 h-72 w-full">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={filteredCalorieHistory}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis />
								<Tooltip />
								<Bar dataKey="calories" fill="#15803d" />
							</BarChart>
						</ResponsiveContainer>

					</div>
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
									<li key={entry.id} className="py-3">

										{/* Show editing fields only for the selected entry */}
										{editingEntryId === entry.id ? (
											<div className="space-y-3">

												<div>
													<label className="block text-gray-700">
														Food name
													</label>
													<input
														type="text"
														value={editFoodName}
														onChange={(event) =>
															setEditFoodName(event.target.value)
														}
														className="w-full rounded border p-2"
													/>
												</div>

												<div>
													<label className="block text-gray-700">
														Calories
													</label>
													<input
														type="number"
														min="0.1"
														step="any"
														value={editCalories}
														onChange={(event) =>
															setEditCalories(event.target.value)
														}
														className="w-full rounded border p-2"
													/>
												</div>

												<div>
													<label className="block text-gray-700">
														Date
													</label>
													<input
														type="date"
														value={editDate}
														onChange={(event) =>
															setEditDate(event.target.value)
														}
														className="rounded border p-2"
													/>
												</div>

												<div className="flex gap-3">
													<button
														type="button"
														onClick={() => handleSaveEdit(entry.id)}
														className="rounded bg-green-700 px-4 py-2 text-white"
													>
														Save Changes
													</button>

													<button
														type="button"
														onClick={handleCancelEdit}
														className="rounded border px-4 py-2"
													>
														Cancel
													</button>
												</div>
											</div>
										) : (
											/* Display the food entry normally */
											<div className="flex items-center justify-between gap-3">
												<span>{entry.foodName}</span>

												<div className="flex items-center gap-3">
													<span className="font-semibold">
														{entry.calories} calories
													</span>

													<button
														type="button"
														onClick={() => handleStartEdit(entry)}
														className="rounded border border-green-700 px-3 py-1 text-green-700"
													>
														Edit
													</button>

													{/* Delete the selected food entry */}
													<button
														type="button"
														onClick={() => handleDeleteEntry(entry.id)}
														className="rounded border border-red-600 px-3 py-1 text-red-600"
													>
														Delete
													</button>
												</div>
											</div>
										)}
										
									</li>
								))}
						</ul>
					)}
				</section>
			</div>

			<div className="mt-10 flex justify-center pb-6">
					<button
						type="button"
						onClick={handleLogout}
						className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
					>
						Logout
					</button>
			</div>
		</main>
	);
}

