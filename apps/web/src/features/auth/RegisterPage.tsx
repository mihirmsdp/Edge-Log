import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "@/services/api";

const schema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"]
  });

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "", confirmPassword: "" } });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.register({ name: values.name, email: values.email, password: values.password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate("/");
    }
  });

  return (
    <div className="auth-shell auth-shell--full min-h-screen overflow-hidden">
      <div className="auth-register-grid auth-register-grid--full grid min-h-screen w-full lg:grid-cols-[1.15fr_0.85fr]">
        <section className="auth-hero auth-hero--full relative flex items-center justify-center p-6 lg:p-10">
          <div className="auth-illustration-stage relative w-full max-w-4xl">
            <div className="auth-illustration-wrap auth-illustration-wrap--plain">
              <img
                src="/register-illustration.jpg"
                alt="Illustration of people reviewing a business dashboard"
                className="auth-illustration"
              />
            </div>
          </div>
        </section>

        <section className="auth-form-panel auth-form-panel--full flex items-center justify-center p-6 sm:p-8 lg:p-10">
          <div className="w-full max-w-lg">
            <p className="mono text-xs uppercase tracking-[0.35em] text-accent">Traders Day Book</p>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-primary sm:text-5xl">Register</h1>
            <p className="mt-3 text-sm font-medium text-muted">Create an Account to access all the features.</p>

            <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <label className="block text-sm font-medium text-muted">
                Full name
                <input className="auth-input mt-2 w-full" placeholder="Enter your full name" {...form.register("name")} />
              </label>
              <label className="block text-sm font-medium text-muted">
                Email
                <input className="auth-input mt-2 w-full" placeholder="you@company.com" {...form.register("email")} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-muted">
                  Password
                  <input type="password" className="auth-input mt-2 w-full" placeholder="Minimum 8 characters" {...form.register("password")} />
                </label>
                <label className="block text-sm font-medium text-muted">
                  Confirm password
                  <input type="password" className="auth-input mt-2 w-full" placeholder="Repeat your password" {...form.register("confirmPassword")} />
                </label>
              </div>
              {(Object.keys(form.formState.errors).length > 0 || mutation.error) && (
                <div className="rounded-[22px] border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
                  {form.formState.errors.name?.message ?? form.formState.errors.email?.message ?? form.formState.errors.password?.message ?? form.formState.errors.confirmPassword?.message ?? mutation.error?.message}
                </div>
              )}
              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-2 rounded-[22px] bg-accent px-5 py-3.5 text-sm font-semibold text-[var(--accent-contrast)] transition hover:opacity-90"
              >
                <span className="mono">{mutation.isPending ? "Creating..." : "Create account"}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>

            <p className="mt-6 text-sm text-muted">
              Already have an account? <Link className="font-medium text-accent" to="/login">Sign in</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
