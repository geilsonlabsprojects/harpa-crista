import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Play, Pause, Settings, Moon, Sun, 
  ChevronLeft, Type, Music, FileJson, FolderOpen, 
  ListMusic, Info, CheckCircle2, AlertCircle
} from 'lucide-react';

// --- MOCK DE DADOS PARA DEMONSTRAÇÃO INICIAL ---
const MOCK_HYMNS = [
  {
    number: 1,
    title: "Chuvas de Graça",
    content: "Deus nos promete a glória,\nManda-nos chuvas de graça;\nDá-nos a Tua vitória,\nÓ Salvador, que nos abraça!\n\nChuvas de graça,\nChuvas pedimos, Senhor;\nManda-nos chuvas de graça,\nChuvas do Consolador."
  },
  {
    number: 193,
    title: "A Alma Abatida",
    content: "Por que te abates, ó minha alma?\nE te comoves, perdendo a calma?\nNão tenhas medo, em Deus espera,\nPorque bem cedo, Jesus virá.\n\nEle é teu Deus, teu Salvador,\nTeu bom Jesus, teu Redentor;\nConfia nEle, não tenhas medo,\nPorque bem cedo, Jesus virá."
  }
];

export default function HarpaApp() {
  // --- STATES ---
  const [hymns, setHymns] = useState(MOCK_HYMNS);
  const [audioMap, setAudioMap] = useState({}); // Mapeia numero do hino -> URL do Blob MP3
  const [currentView, setCurrentView] = useState('list'); // 'list', 'hymn', 'settings'
  const [currentHymn, setCurrentHymn] = useState(null);
  
  // Preferências
  const [searchQuery, setSearchQuery] = useState('');
  const [fontSize, setFontSize] = useState(18);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Status de carregamento
  const [loadingStatus, setLoadingStatus] = useState({ lyrics: 0, audio: 0, show: false });

  // Referência do player de áudio
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- EFEITOS ---
  // Aplica o dark mode no documento (body)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0f172a'; // slate-900
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc'; // slate-50
    }
  }, [isDarkMode]);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentHymn, currentView]);

  // --- FUNÇÕES DE CARREGAMENTO DE ARQUIVOS LOCAIS ---
  
  // Tenta extrair o número do hino baseado no nome do arquivo ou conteúdo
  const extractNumber = (filename) => {
    // Pega o último número no nome do arquivo. Ex: "A Alma Abatida (Harpa Cristã - 193).json" -> 193
    const matches = filename.match(/\d+/g);
    if (matches && matches.length > 0) {
      return parseInt(matches[matches.length - 1], 10);
    }
    return null;
  };

  const handleLyricsFolderSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoadingStatus(prev => ({ ...prev, show: true }));
    let newHymns = [];
    let count = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.json')) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const num = extractNumber(file.name);
          
          if (num) {
            // Tenta extrair a letra do JSON (suporta múltiplos formatos de exportação)
            let parsedContent = "";
            if (data.verses) {
              parsedContent = data.verses.map(v => v.text || v.texto).join('\n\n');
            } else if (data.letra) {
              parsedContent = data.letra;
            } else if (data.lyrics) {
              parsedContent = data.lyrics;
            } else {
              // Fallback caso não ache a chave exata
              parsedContent = JSON.stringify(data, null, 2); 
            }

            newHymns.push({
              number: num,
              title: data.title || data.titulo || file.name.replace('.json', '').split('(')[0].trim(),
              content: parsedContent
            });
            count++;
          }
        } catch (error) {
          console.error("Erro ao ler JSON:", file.name, error);
        }
      }
    }

    if (newHymns.length > 0) {
      // Ordena numericamente
      newHymns.sort((a, b) => a.number - b.number);
      setHymns(newHymns);
    }
    setLoadingStatus(prev => ({ ...prev, lyrics: count }));
  };

  const handleAudioFolderSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoadingStatus(prev => ({ ...prev, show: true }));
    let newAudioMap = { ...audioMap };
    let count = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.ogg')) {
        const num = extractNumber(file.name);
        if (num) {
          // Cria uma URL local (Blob URL) para o arquivo de áudio para o navegador poder tocar
          newAudioMap[num] = URL.createObjectURL(file);
          count++;
        }
      }
    }

    setAudioMap(newAudioMap);
    setLoadingStatus(prev => ({ ...prev, audio: count }));
  };


  // --- FUNÇÕES DE CONTROLE ---

  const filteredHymns = useMemo(() => {
    if (!searchQuery) return hymns;
    const lowerQ = searchQuery.toLowerCase();
    return hymns.filter(h => 
      h.title.toLowerCase().includes(lowerQ) || 
      h.number.toString().includes(lowerQ) ||
      h.content.toLowerCase().includes(lowerQ)
    );
  }, [hymns, searchQuery]);

  const openHymn = (hymn) => {
    setCurrentHymn(hymn);
    setCurrentView('hymn');
    setIsPlaying(false);
    setCurrentTime(0);
    // Pausa audio global se houver
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };


  // --- RENDERIZADORES DE TELA ---

  const renderSettingsAndLoaders = () => (
    <div className="p-6 space-y-8 animate-in fade-in pb-24">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setCurrentView('list')}
          className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configurações & Dados</h2>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <FolderOpen size={20} className="text-blue-500" />
          Carregar Seus Arquivos Locais
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Selecione as pastas do seu computador contendo os arquivos <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1 rounded">.json</span> e de áudio. Os arquivos não serão enviados para a internet, tudo funciona offline no seu navegador.
        </p>

        <div className="space-y-4">
          {/* Botão Pasta Letras */}
          <div className="relative group">
            <input 
              type="file" 
              webkitdirectory="" 
              directory="" 
              multiple 
              onChange={handleLyricsFolderSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${loadingStatus.lyrics > 0 ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-dashed border-slate-300 dark:border-slate-600 group-hover:border-blue-500 bg-slate-50 dark:bg-slate-900'}`}>
              <div className="flex items-center gap-3">
                <FileJson size={24} className={loadingStatus.lyrics > 0 ? "text-green-500" : "text-blue-500"} />
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">Pasta de Letras (JSON)</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Clique para selecionar a pasta</div>
                </div>
              </div>
              {loadingStatus.lyrics > 0 && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium">
                  <CheckCircle2 size={16} /> {loadingStatus.lyrics} lidos
                </div>
              )}
            </div>
          </div>

          {/* Botão Pasta Áudio */}
          <div className="relative group">
            <input 
              type="file" 
              webkitdirectory="" 
              directory="" 
              multiple 
              onChange={handleAudioFolderSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${loadingStatus.audio > 0 ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-dashed border-slate-300 dark:border-slate-600 group-hover:border-blue-500 bg-slate-50 dark:bg-slate-900'}`}>
              <div className="flex items-center gap-3">
                <Music size={24} className={loadingStatus.audio > 0 ? "text-green-500" : "text-purple-500"} />
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">Pasta de Áudios (MP3)</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Clique para selecionar a pasta</div>
                </div>
              </div>
              {loadingStatus.audio > 0 && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium">
                  <CheckCircle2 size={16} /> {loadingStatus.audio} lidos
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Settings size={20} className="text-slate-500" />
          Preferências Globais
        </h3>
        
        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
          <span className="text-slate-700 dark:text-slate-300 font-medium">Tema Escuro</span>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${isDarkMode ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}
          >
            <div className="w-6 h-6 bg-white rounded-full shadow-sm"></div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderList = () => (
    <div className="flex flex-col h-screen animate-in fade-in">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800 pt-6 pb-4 px-4 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent flex items-center gap-2">
            <ListMusic size={28} className="text-blue-600" />
            Harpa Cristã
          </h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={() => setCurrentView('settings')}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={20} className="text-slate-400" />
          </div>
          <input
            type="text"
            className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            placeholder="Buscar por número ou título..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {hymns.length === MOCK_HYMNS.length && !loadingStatus.show && (
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl mb-4 flex items-start gap-3 border border-blue-200 dark:border-blue-800">
            <Info size={24} className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Bem-vindo à Harpa Digital!</p>
              <p>Acesse as <button onClick={() => setCurrentView('settings')} className="underline font-semibold">Configurações</button> para carregar as suas pastas de letras (JSON) e áudios (MP3) e ver todos os hinos.</p>
            </div>
          </div>
        )}

        {filteredHymns.length === 0 ? (
          <div className="text-center text-slate-500 py-10 flex flex-col items-center gap-3">
            <Search size={40} className="opacity-20" />
            <p>Nenhum hino encontrado.</p>
          </div>
        ) : (
          filteredHymns.map((hymn) => (
            <button
              key={hymn.number}
              onClick={() => openHymn(hymn)}
              className="w-full text-left bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group flex items-center gap-4"
            >
              <div className="w-14 h-14 shrink-0 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                {hymn.number}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {hymn.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">
                  {hymn.content.split('\n')[0].substring(0, 50)}...
                </p>
              </div>
              {audioMap[hymn.number] && (
                <div className="shrink-0 text-slate-400">
                  <Music size={18} />
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderHymn = () => {
    if (!currentHymn) return null;
    const hasAudio = !!audioMap[currentHymn.number];

    return (
      <div className="flex flex-col h-screen animate-in slide-in-from-right-4">
        {/* HEADER DO HINO */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-800 pt-6 pb-4 px-4 sticky top-0 z-20 flex items-center justify-between">
          <button 
            onClick={() => setCurrentView('list')}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
              className="w-10 h-10 flex items-center justify-center rounded-full text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition"
              title="Diminuir fonte"
            >
              <span className="text-sm font-bold">A-</span>
            </button>
            <div className="w-px bg-slate-300 dark:bg-slate-600 my-2"></div>
            <button 
              onClick={() => setFontSize(prev => Math.min(48, prev + 2))}
              className="w-10 h-10 flex items-center justify-center rounded-full text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition"
              title="Aumentar fonte"
            >
              <span className="text-lg font-bold">A+</span>
            </button>
          </div>
        </div>

        {/* ÁREA DA LETRA */}
        <div className="flex-1 overflow-y-auto p-6 pb-40">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-bold text-sm tracking-widest mb-3 border border-blue-200 dark:border-blue-800/50">
              HINO {currentHymn.number}
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight">
              {currentHymn.title}
            </h1>
          </div>
          
          <div 
            className="whitespace-pre-wrap text-center font-serif text-slate-800 dark:text-slate-200 leading-relaxed max-w-3xl mx-auto"
            style={{ fontSize: `${fontSize}px` }}
          >
            {currentHymn.content}
          </div>
        </div>

        {/* PLAYER DE ÁUDIO FLUTUANTE (SE EXISTIR ÁUDIO) */}
        {hasAudio && (
          <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-[400px] bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-3xl shadow-2xl z-30 border border-slate-700">
            <audio 
              ref={audioRef} 
              src={audioMap[currentHymn.number]} 
              preload="metadata"
            />
            
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlay}
                className="w-14 h-14 shrink-0 bg-blue-500 hover:bg-blue-400 text-white rounded-full flex items-center justify-center transition-all shadow-lg shadow-blue-500/30"
              >
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
              </button>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs font-medium text-slate-400 mb-2">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                {/* Custom Slider */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full transition-all"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 ${(currentTime / duration) * 100}%, #334155 ${(currentTime / duration) * 100}%)`
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="font-sans text-slate-900 h-screen overflow-hidden selection:bg-blue-200 selection:text-blue-900 dark:selection:bg-blue-900 dark:selection:text-blue-100">
      {currentView === 'list' && renderList()}
      {currentView === 'settings' && renderSettingsAndLoaders()}
      {currentView === 'hymn' && renderHymn()}
    </div>
  );
}
