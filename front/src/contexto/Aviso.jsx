import { createContext, useCallback, useContext, useState } from 'react';

const AvisoContexto = createContext(null);

// Avisos rápidos de sucesso/erro no canto da tela
export function AvisoProvider({ children }) {
  const [avisos, setAvisos] = useState([]);

  const avisar = useCallback((mensagem, tipo = 'sucesso') => {
    const id = Date.now() + Math.random();
    setAvisos(lista => [...lista, { id, mensagem, tipo }]);
    setTimeout(() => setAvisos(lista => lista.filter(a => a.id !== id)), tipo === 'erro' ? 6000 : 3500);
  }, []);

  return (
    <AvisoContexto.Provider value={avisar}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-96" aria-live="polite">
        {avisos.map(a => (
          <div key={a.id} role={a.tipo === 'erro' ? 'alert' : 'status'}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${a.tipo === 'erro' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>
            {a.mensagem}
          </div>
        ))}
      </div>
    </AvisoContexto.Provider>
  );
}

export const useAviso = () => useContext(AvisoContexto);
