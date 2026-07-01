import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function LoginForm() {
	const { signIn, signInWithGoogle } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		const result = await signIn(email, password);
		if (result.error) setError(result.error);
		setLoading(false);
	};

	const handleGoogle = async () => {
		setError("");
		const result = await signInWithGoogle();
		if (result.error) setError(result.error);
	};

	return (
		<div className="min-h-screen bg-felt flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<div className="text-center mb-8">
					<h1 className="text-4xl font-bold text-gold">🎴 Kenyan Poker</h1>
					<p className="text-green-300 mt-2">Sign in to your account</p>
				</div>

				<form
					onSubmit={handleSubmit}
					className="bg-felt-light rounded-xl p-8 space-y-5 shadow-2xl"
				>
					{error && (
						<div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
							{error}
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-green-200 mb-1">
							Email
						</label>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="w-full bg-green-900 border border-green-700 rounded-lg px-4 py-3 text-white placeholder-green-500 focus:outline-none focus:border-gold transition"
							placeholder="you@example.com"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-green-200 mb-1">
							Password
						</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className="w-full bg-green-900 border border-green-700 rounded-lg px-4 py-3 text-white placeholder-green-500 focus:outline-none focus:border-gold transition"
							placeholder="••••••••"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:bg-yellow-500 transition disabled:opacity-50"
					>
						{loading ? "Signing in..." : "Sign In"}
					</button>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-green-700"></div>
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="px-2 bg-felt-light text-green-500">or</span>
						</div>
					</div>

					<button
						type="button"
						onClick={handleGoogle}
						className="w-full bg-white text-gray-800 font-medium py-3 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-2"
					>
						<svg className="w-5 h-5" viewBox="0 0 24 24">
							<path
								fill="#4285F4"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
							/>
							<path
								fill="#34A853"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="#FBBC05"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							/>
							<path
								fill="#EA4335"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							/>
						</svg>
						Continue with Google
					</button>

					<p className="text-center text-green-400 text-sm">
						Don't have an account?{" "}
						<Link
							to="/signup"
							className="text-gold hover:text-yellow-400 font-medium"
						>
							Sign up
						</Link>
					</p>
				</form>
			</div>
		</div>
	);
}
