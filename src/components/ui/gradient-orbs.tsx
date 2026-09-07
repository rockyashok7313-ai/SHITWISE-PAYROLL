/**
 * Decorative, colorful blurred-gradient backdrop for auth screens (login,
 * reset-password). Pure CSS -- renders instantly and doesn't depend on
 * WebGL/Three.js working, unlike LoginBackground which it layers behind.
 * Three soft orbs in the primary/accent/chart-5 hues, slow independent
 * float animations so they never look static.
 */
export function GradientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full bg-primary/45 blur-[100px] animate-[float-a_16s_ease-in-out_infinite]" />
      <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-accent/40 blur-[100px] animate-[float-b_20s_ease-in-out_infinite]" />
      <div className="absolute -bottom-32 left-1/4 w-[26rem] h-[26rem] rounded-full bg-[hsl(var(--chart-5))]/35 blur-[100px] animate-[float-c_18s_ease-in-out_infinite]" />
    </div>
  );
}
