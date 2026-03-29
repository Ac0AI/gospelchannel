export default function HomeLoading() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-4">
      <svg className="h-10 w-10 animate-pulse text-rose-gold/40" viewBox="0 0 24 24" fill="currentColor">
        <rect x="10.5" y="2" width="3" height="20" rx="1.5" />
        <rect x="4" y="7.5" width="16" height="3" rx="1.5" />
      </svg>
    </div>
  );
}
