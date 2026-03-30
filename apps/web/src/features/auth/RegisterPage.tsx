import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
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
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="card-surface w-full max-w-md rounded-[28px] p-8 shadow-glow">
        <p className="mono text-xs uppercase tracking-[0.35em] text-accent">EdgeLog</p>
        <h1 className="mt-4 text-4xl font-bold">Create account</h1>
        <p className="mt-2 text-sm text-muted">Build a journal around process, discipline, and repeatable edge.</p>
        <form className="mt-8 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <label className="block text-sm text-muted">
            Name
            <input className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-primary outline-none focus:border-accent" {...form.register("name")} />
          </label>
          <label className="block text-sm text-muted">
            Email
            <input className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-primary outline-none focus:border-accent" {...form.register("email")} />
          </label>
          <label className="block text-sm text-muted">
            Password
            <input type="password" className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-primary outline-none focus:border-accent" {...form.register("password")} />
          </label>
          <label className="block text-sm text-muted">
            Confirm password
            <input type="password" className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-primary outline-none focus:border-accent" {...form.register("confirmPassword")} />
          </label>
          {(Object.keys(form.formState.errors).length > 0 || mutation.error) && (
            <div className="rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
              {form.formState.errors.name?.message ?? form.formState.errors.email?.message ?? form.formState.errors.password?.message ?? form.formState.errors.confirmPassword?.message ?? mutation.error?.message}
            </div>
          )}
          <button type="submit" className="mono w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)] transition hover:opacity-90">
            {mutation.isPending ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-muted">
          Already have an account? <Link className="text-accent" to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

