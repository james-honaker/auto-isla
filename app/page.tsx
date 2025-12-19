import SmartSearch from './components/SmartSearch';
import { getLastUpdated } from './lib/db';

export default function Home() {
  const lastUpdated = getLastUpdated();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-4">
      <main className="w-full max-w-4xl flex flex-col items-center gap-12 text-center">

        {/* Branding Section */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Auto<span className="text-blue-600">Isla</span>
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
            The smartest way to search vehicles in Puerto Rico.
            <br className="hidden sm:block" />
            <span className="text-sm opacity-75">Powered by advanced scraping of ClasificadosOnline</span>
          </p>
        </div>

        {/* Search Widget */}
        <SmartSearch lastUpdated={lastUpdated} />

        {/* Footer */}
        <div className="text-sm text-zinc-400 mt-8">
          v0.1.0-alpha
        </div>
      </main>
    </div>
  );
}
