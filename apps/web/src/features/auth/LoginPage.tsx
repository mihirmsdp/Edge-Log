import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/services/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "demo@edgelog.app", password: "demo1234" } });
  const mutation = useMutation({
    mutationFn: api.signIn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate("/");
    }
  });

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="card-surface w-full max-w-md rounded-[28px] p-8 shadow-glow">
        <p className="mono text-xs uppercase tracking-[0.35em] text-accent">EdgeLog</p>
        <h1 className="mt-4 text-4xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Review your edge, not just your outcome.</p>
        <form className="mt-8 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <label className="block text-sm text-muted">
            Email
            <input className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-primary outline-none focus:border-accent" {...form.register("email")} />
          </label>
          <label className="block text-sm text-muted">
            Password
            <input type="password" className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-primary outline-none focus:border-accent" {...form.register("password")} />
          </label>
          {(form.formState.errors.email || form.formState.errors.password || mutation.error) && (
            <div className="rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
              {form.formState.errors.email?.message ?? form.formState.errors.password?.message ?? mutation.error?.message}
            </div>
          )}
          <button type="submit" className="mono w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-[var(--accent-contrast)] transition hover:opacity-90">
            {mutation.isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-muted">
          New here? <Link className="text-accent" to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

