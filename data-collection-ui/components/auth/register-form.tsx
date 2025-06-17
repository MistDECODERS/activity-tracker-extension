import { User, Mail, EyeOff, Eye, Lock, ArrowRight } from "lucide-react";
import React, { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { TabsContent } from "../ui/tabs";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { contentVariants } from "@/constants/animate";
import { signup } from "@/actions/auth";
import { toast } from "sonner";
import { useErrorHandler } from "@/lib/handle-error";

// Define the form schema with Zod
const registerFormSchema = z
	.object({
		name: z
			.string()
			.min(2, { message: "Name must be at least 2 characters long" }),
		email: z.string().email({ message: "Please enter a valid email address" }),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
			.regex(/[a-z]/, "Password must contain at least one lowercase letter")
			.regex(/\d/, "Password must contain at least one number")
			.regex(
				/[!@#$%^&*(),.?":{}|<>]/,
				"Password must contain at least one special character",
			),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

// Define the form type from the schema
type RegisterFormValues = z.infer<typeof registerFormSchema>;

const RegisterForm = () => {
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const { handleError } = useErrorHandler();

	// Initialize the form with default values and the zod resolver
	const form = useForm<RegisterFormValues>({
		resolver: zodResolver(registerFormSchema),
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
	});

	// Handle form submission
	async function onSubmit(data: RegisterFormValues) {
		try {
			setLoading(true);
			await signup({
				email: data.email,
				password: data.password,
				fullName: data.name,
			});

			toast.success("Registration successful! Please log in.", {
				description: "A confirmation email has been sent to your inbox.",
			});

			form.reset();
		} catch (error) {
			handleError(error as Error, "Registration failed");
		} finally {
			setLoading(false);
		}
	}

	return (
		<TabsContent value="register" className="mt-0 outline-none">
			<motion.div
				initial="hidden"
				animate="visible"
				exit="exit"
				variants={contentVariants}
				key="register-form"
			>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Full Name</FormLabel>
									<div className="relative">
										<User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
										<FormControl>
											<Input
												placeholder="e.g. John Doe"
												className="pl-10"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</div>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<div className="relative">
										<Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
										<FormControl>
											<Input
												placeholder="name@example.com"
												className="pl-10"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</div>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Password</FormLabel>
									<div className="relative">
										<Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
										<FormControl>
											<Input
												type={showPassword ? "text" : "password"}
												placeholder="••••••••"
												className="pl-10"
												{...field}
											/>
										</FormControl>
										<button
											type="button"
											className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
											onClick={() => setShowPassword(!showPassword)}
										>
											{showPassword ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
										<FormMessage />
									</div>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="confirmPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Confirm Password</FormLabel>
									<div className="relative">
										<Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
										<FormControl>
											<Input
												type={showConfirmPassword ? "text" : "password"}
												placeholder="••••••••"
												className="pl-10"
												{...field}
											/>
										</FormControl>
										<button
											type="button"
											className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
											onClick={() =>
												setShowConfirmPassword(!showConfirmPassword)
											}
										>
											{showConfirmPassword ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
										<FormMessage />
									</div>
								</FormItem>
							)}
						/>

						<Button type="submit" className="w-full">
							{loading ? (
								"Creating..."
							) : (
								<>
									Create Account
									<ArrowRight className="ml-2 h-4 w-4" />
								</>
							)}
						</Button>
					</form>
				</Form>
			</motion.div>
		</TabsContent>
	);
};

export default RegisterForm;
