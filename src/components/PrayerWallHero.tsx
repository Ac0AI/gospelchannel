type PrayerWallHeroProps = {
  title: string;
  subtitle: string;
};

export function PrayerWallHero({ title, subtitle }: PrayerWallHeroProps) {
  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-rose-200/60 shadow-sm"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(25, 12, 8, 0.88), rgba(25, 12, 8, 0.52)), url(/images/prayerwall-hero.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="px-5 py-10 text-center sm:px-8 sm:py-14 lg:px-10 lg:py-16">
        <h1 className="font-serif text-3xl font-black text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-white/80">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
