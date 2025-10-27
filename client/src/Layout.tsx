export const Header = ({ children }: React.PropsWithChildren) => (
  <header className="sticky top-0 z-50 w-full border-b border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
    <nav className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
      <div className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-xl text-neutral-900 dark:text-white">
            <span className="text-2xl">🎮</span>
            <span className="hidden sm:inline">MAA Manager</span>
            <span className="sm:hidden">MAAM</span>
          </div>
        </div>
        {children}
      </div>
    </nav>
  </header>
)

export const Footer = () => (
  <footer className="border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
    <div className="container mx-auto px-4 py-4 md:px-6 lg:px-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-600 dark:text-neutral-400">
        <p>MAA Manager - Automated Task Orchestration</p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/Jkker/maam"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://docs.maa.plus"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            Docs
          </a>
        </div>
      </div>
    </div>
  </footer>
)
