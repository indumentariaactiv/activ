import { useRegisterSW } from 'virtual:pwa-register/react'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="fixed right-0 bottom-0 m-4 p-4 z-[9999]">
      {(offlineReady || needRefresh) && (
        <div className="bg-white rounded-2xl shadow-2xl border border-[var(--color-outline-variant)]/20 p-6 max-w-sm animate-in slide-in-from-bottom-10 duration-300">
          <div className="flex gap-4 items-start mb-4">
            <div className={`p-3 rounded-full ${needRefresh ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
              <span className="material-symbols-outlined">
                {needRefresh ? 'system_update' : 'cloud_done'}
              </span>
            </div>
            <div>
              <p className="font-headline font-black text-sm uppercase tracking-wide mb-1">
                {needRefresh ? 'Nueva versión lista' : 'App lista para offline'}
              </p>
              <p className="text-xs text-[var(--color-on-surface-variant)] leading-relaxed">
                {needRefresh 
                  ? 'Hay una actualización disponible con mejoras importantes. ¿Quieres aplicarla ahora?' 
                  : 'ALTIV ya funciona sin conexión. Puedes instalarla para un acceso rápido.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button 
              className="px-4 py-2 text-xs font-bold text-[var(--color-on-surface-variant)] hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => close()}
            >
              Cerrar
            </button>
            {needRefresh && (
              <button 
                className="btn btn-primary px-5 py-2 text-xs shadow-lg"
                onClick={() => updateServiceWorker(true)}
              >
                Actualizar Ahora
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ReloadPrompt
