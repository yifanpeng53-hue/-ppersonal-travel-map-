import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import LoginForm from './components/LoginForm';
import ProfilePanel from './components/ProfilePanel';
import { supabase } from './lib/supabaseClient';

const STORAGE_KEY = 'yifan-y2k-travel-stars';
const TRACKS = ['ALL', '2024', '2025', '2026'];
const MAX_STARS = 100;
const TRACK_URL = '/music/howsweet.mp3';
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_TRAVEL_SYSTEM_PROMPT = `职责：你是一个 Y2K 少女风的文旅 Agent。

安全防线：若输入与「旅行、足迹、打卡、去过某地」完全无关，必须且只能返回：{ "error": "NOT_TRAVEL_RELATED" }。

首都映射：输入国家则自动转换为该国家首都（如：日本 -> 东京）；输入微观景点则向上提炼返回所属城市（如：宇治茶屋 -> 宇治）。

去幻觉留空：依靠地理常识返回与 city 一致的中心点 lat/lng 坐标。如果无法提炼具体城市，city、lat、lng 必须全返回空字符串 ""；若未提及时间，date 返回 ""。

输出结构：必须是纯净 JSON，不得包含 markdown 代码块或任何额外文字，格式严格为：{ "city": "...", "date": "...", "travel_note": "Y2K风文案", "lat": "", "lng": "" }。`;

const INITIAL_STARS = [
  {
    id: 'tokyo-2024-08-12',
    city: 'Tokyo',
    date: '2024.08.12',
    year: '2024',
    lat: 35.6762,
    lng: 139.6503,
    note: '迪士尼的奇妙夜，开启霓虹之旅！🐰✨',
    image:
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fukuoka-2024-11-20', 
    city: 'Fukuoka',
    date: '2024.11.20',
    year: '2024',
    lat: 33.5902,
    lng: 130.4017,
    note: '现场看演唱会真的爆哭！听到了最爱的歌，飞天小女警冲锋！💖',
    image:
      'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'seoul-2025-03-24',
    city: 'Seoul',
    date: '2025.03.24',
    year: '2025',
    lat: 37.5665,
    lng: 126.978,
    note: '明洞的草莓糖葫芦超甜！走在街上全是NewJeans的氛围感～💙',
    image:
      'https://images.unsplash.com/photo-1538485399081-7c897f2f07b3?auto=format&fit=crop&w=600&q=80',
  },
];

const starIcon = (hidden) =>
  L.divIcon({
    className: `star-pin ${hidden ? 'star-hidden' : ''}`,
    html: '<span class="star-core">★</span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

function resolveDate(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const yearMatch = trimmed.match(/^(\d{4})(年)?$/);
  if (yearMatch) {
    return `${yearMatch[1]}.01.01`;
  }

  const monthDayMatch = trimmed.match(/^(\d{1,2})[-./月](\d{1,2})(日)?$/);
  if (monthDayMatch) {
    const currentYear = new Date().getFullYear();
    const month = monthDayMatch[1].padStart(2, '0');
    const day = monthDayMatch[2].padStart(2, '0');
    return `${currentYear}.${month}.${day}`;
  }

  const standardMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (standardMatch) {
    const y = standardMatch[1];
    const m = standardMatch[2].padStart(2, '0');
    const d = standardMatch[3].padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  return null;
}

function loadInitialStars() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return INITIAL_STARS;
    }
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : INITIAL_STARS;
  } catch {
    return INITIAL_STARS;
  }
}

function averageCenter(items) {
  if (!items.length) {
    return [28, 125];
  }
  const totals = items.reduce(
    (acc, item) => {
      acc.lat += item.lat;
      acc.lng += item.lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );
  return [totals.lat / items.length, totals.lng / items.length];
}

function YearFlyTo({ items, track }) {
  const map = useMap();

  useEffect(() => {
    const center = averageCenter(items);
    map.flyTo(center, map.getZoom(), {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [map, track, items]);

  return null;
}

function MapClickGeocoder({ enabled, onPick }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function DraggableCards({ openCards, stars, onDelete, onClose }) {
  const map = useMap();
  const [, setTick] = useState(0);
  const [offsets, setOffsets] = useState({});

  useEffect(() => {
    const update = () => setTick((v) => v + 1);
    map.on('move zoom', update);
    return () => {
      map.off('move zoom', update);
    };
  }, [map]);

  return (
    <>
      {openCards.map((cardId) => {
        const item = stars.find((star) => star.id === cardId);
        if (!item) return null;
        const point = map.latLngToContainerPoint([item.lat, item.lng]);
        const offset = offsets[cardId] || { x: 20, y: -200 };

        return (
          <motion.div
            key={cardId}
            drag
            dragMomentum={false}
            className="purikura-card"
            style={{ left: point.x + offset.x, top: point.y + offset.y }}
            onDragEnd={(_, info) => {
              setOffsets((prev) => ({
                ...prev,
                [cardId]: {
                  x: (prev[cardId]?.x || 20) + info.offset.x,
                  y: (prev[cardId]?.y || -200) + info.offset.y,
                },
              }));
            }}
            initial={{ scale: 0.8, opacity: 0, rotate: -4 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          >
            <button
              className="mini-close"
              onClick={() => onClose(cardId)}
              title="Close card"
              type="button"
            >
              ×
            </button>
            <div className="sticker-hole" />
            <img src={item.image} alt={item.city} />
            <h3>{item.city}</h3>
            <p className="date">{item.date}</p>
            <p>{item.note}</p>
            <button
              className="card-delete"
              onClick={() => onDelete(cardId)}
              title="Delete this star"
              type="button"
            >
              delete
            </button>
          </motion.div>
        );
      })}
    </>
  );
}

function makeBeep() {
  const ctx = new window.AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 640;
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

function App() {
  const [stars, setStars] = useState(loadInitialStars);
  const [track, setTrack] = useState('ALL');
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const [lcdFlash, setLcdFlash] = useState('');
  const [openCards, setOpenCards] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leftPanel, setLeftPanel] = useState(null);
  const [y2kAlert, setY2kAlert] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [form, setForm] = useState({
    city: '',
    date: '',
    note: '',
    imageData: '',
    imageName: '',
    lat: '',
    lng: '',
  });
  const [aiDraft, setAiDraft] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [dateError, setDateError] = useState('');
  const [dateInvalid, setDateInvalid] = useState(false);
  const audioRef = useRef(null);
  const imageInputRef = useRef(null);
  const menuRef = useRef(null);
  const geocodeRequestId = useRef(0);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);

  const fetchFootprints = async (token) => {
    if (!token) return;
    try {
      const response = await fetch('/api/footprints', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        setY2kAlert(error?.error || '无法加载个人足迹，请重试。');
        return;
      }
      const data = await response.json();
      setStars(Array.isArray(data) ? data : []);
    } catch {
      setY2kAlert('网络错误，无法加载足迹。');
    }
  };

  const createFootprint = async (item) => {
    if (!session?.access_token) {
      setY2kAlert('Please login first.');
      return null;
    }

    try {
      const response = await fetch('/api/footprints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(item),
      });
      const result = await response.json();
      if (!response.ok) {
        setY2kAlert(result?.error || '创建足迹失败');
        return null;
      }
      return result;
    } catch {
      setY2kAlert('网络错误，创建足迹失败');
      return null;
    }
  };

  const deleteFootprint = async (id) => {
    if (!session?.access_token) {
      setY2kAlert('请先登录后再删除足迹');
      return false;
    }

    try {
      const response = await fetch(`/api/footprints/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        setY2kAlert(result?.error || '删除足迹失败');
        return false;
      }
      return true;
    } catch {
      setY2kAlert('网络错误，删除足迹失败');
      return false;
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setStars(loadInitialStars());
    setLeftPanel(null);
    setMenuOpen(false);
  };

  const openPanel = (panel) => {
    setLeftPanel(panel);
    setMenuOpen(false);
  };

  const closePanel = () => {
    setLeftPanel(null);
  };

  const handleMenuSelect = (action) => {
    if (action === 'footprint') {
      openPanel('footprint');
      return;
    }
    if (action === 'auth') {
      openPanel(user ? 'profile' : 'auth');
    }
  };

  const handlePlusClick = () => {
    setMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stars));
    }
  }, [stars, user]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const currentSession = data?.session ?? null;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.access_token) {
        await fetchFootprints(currentSession.access_token);
      } else {
        setStars(loadInitialStars());
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.access_token) {
        fetchFootprints(nextSession.access_token);
      } else {
        setStars(loadInitialStars());
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!lcdFlash) return;
    const timer = setTimeout(() => setLcdFlash(''), 1200);
    return () => clearTimeout(timer);
  }, [lcdFlash]);

  useEffect(() => {
    if (!y2kAlert) return;
    const timer = setTimeout(() => setY2kAlert(''), 1800);
    return () => clearTimeout(timer);
  }, [y2kAlert]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const filteredStars = useMemo(() => {
    if (track === 'ALL') return stars;
    return stars.filter((item) => item.year === track);
  }, [stars, track]);

  const lcdCount = filteredStars.length;

  const handleTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setY2kAlert('音频播放需要先点一下页面噢～🎧');
    }
  };

  const adjustVolume = (delta) => {
    setVolume((prev) => {
      const next = Math.min(1, Math.max(0, prev + delta));
      setLcdFlash(`VOL: ${Math.round(next * 100)}%`);
      return next;
    });
  };

  const cycleTrack = (direction) => {
    makeBeep();
    setTrack((current) => {
      const index = TRACKS.indexOf(current);
      const nextIndex = (index + direction + TRACKS.length) % TRACKS.length;
      return TRACKS[nextIndex];
    });
  };

  const addCard = (id) => {
    setOpenCards((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const closeCard = (id) => {
    setOpenCards((prev) => prev.filter((item) => item !== id));
  };

  const removeStar = async (id) => {
    if (!user) {
      setY2kAlert('请先登录后再删除足迹');
      setPendingDeleteId(null);
      return;
    }

    const success = await deleteFootprint(id);
    if (!success) {
      setPendingDeleteId(null);
      return;
    }

    setStars((prev) => prev.filter((star) => star.id !== id));
    closeCard(id);
  };

  const requestDeleteStar = (id) => {
    setPendingDeleteId(id);
  };

  const confirmDeleteStar = () => {
    if (!pendingDeleteId) return;
    removeStar(pendingDeleteId);
    setPendingDeleteId(null);
  };

  const cancelDeleteStar = () => {
    setPendingDeleteId(null);
  };

  const canSubmit = Boolean(user) && stars.length < MAX_STARS;

  const getCityFromNominatim = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          lat,
        )}&lon=${encodeURIComponent(lng)}&zoom=10&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
        },
      );
      if (!response.ok) return null;
      const data = await response.json();
      const address = data.address || {};
      return (
        address.city ||
        address.town ||
        address.village ||
        address.hamlet ||
        address.county ||
        address.state ||
        address.region ||
        null
      );
    } catch {
      return null;
    }
  };

  const reverseGeocodeCity = async (lat, lng, requestId) => {
    const latStr = Number(lat).toFixed(4);
    const lngStr = Number(lng).toFixed(4);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (apiKey) {
      const prompt = `你是一个地理坐标专家。请严格检索现实世界地图，告诉我经纬度坐标 (${latStr}, ${lngStr}) 属于哪个城市或省/自治区/区域。可以返回市级名称，也可以返回省/自治区/区域级别，但不能返回国家/大陆/洲等更大层级。请只返回该坐标实际所在的地点名称（如：东京、新疆、广东），不要带任何标点、废话或「市」字。如果该坐标在海里或无人区、或无法精确到上述层级，请返回「未知」。`;

      try {
        const response = await fetch(
          `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
            }),
          },
        );

        if (response.ok) {
          const payload = await response.json();
          const city = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (city && requestId === geocodeRequestId.current && city !== '未知') {
            setForm((prev) => ({
              ...prev,
              city,
            }));
            return;
          }
        }
      } catch {
        // 如果 Gemini 失败则继续回退地址解析
      }
    }

    const fallbackCity = await getCityFromNominatim(lat, lng);
    if (!fallbackCity || requestId !== geocodeRequestId.current) return;

    setForm((prev) => ({
      ...prev,
      city: fallbackCity,
    }));
  };

  const handleDateValidation = (inputValue) => {
    const finalDate = resolveDate(inputValue);

    if (finalDate) {
      setForm((prev) => ({ ...prev, date: finalDate }));
      setDateError('');
      setDateInvalid(false);
      return finalDate;
    }

    setDateError('请输入正确的日期（如：2026-06-10）');
    setDateInvalid(true);
    return null;
  };

  const handleMapPick = ({ lat, lng }) => {
    const latStr = lat.toFixed(4);
    const lngStr = lng.toFixed(4);

    setForm((prev) => ({
      ...prev,
      city: '',
      lat: latStr,
      lng: lngStr,
    }));

    geocodeRequestId.current += 1;
    const requestId = geocodeRequestId.current;
    reverseGeocodeCity(lat, lng, requestId);
  };

  const handleAddStar = async (e) => {
    e.preventDefault();
    if (!user) {
      setY2kAlert('Please login first.');
      return;
    }
    if (!canSubmit) {
      setY2kAlert('夜空已经装不下更多星星啦！请先摘下一颗旧的吧～✨🐰');
      return;
    }

    if (form.city === '' || form.lat === '' || form.lng === '') {
      setY2kAlert('城市和坐标还是空的喔～点地图落点或让 AI 一键生成吧！🌟💗');
      return;
    }

    const validatedDate = handleDateValidation(form.date);
    if (!validatedDate) {
      return;
    }

    const year = validatedDate.slice(0, 4);
    const item = {
      id: `${form.city.toLowerCase()}-${Date.now()}`,
      city: form.city,
      date: validatedDate,
      year,
      lat: Number(form.lat),
      lng: Number(form.lng),
      note: form.note || '新的冒险记录完成！',
      image:
        form.imageData ||
        'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=600&q=80',
    };

    if (Number.isNaN(item.lat) || Number.isNaN(item.lng)) {
      setY2kAlert('坐标格式不正确，点地图自动填充最方便～');
      return;
    }

    const created = await createFootprint(item);
    if (!created) {
      return;
    }

    setStars((prev) => [...prev, created]);
    setForm({ city: '', date: '', note: '', imageData: '', imageName: '', lat: '', lng: '' });
    setDateError('');
    setDateInvalid(false);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setTrack(year && TRACKS.includes(year) ? year : 'ALL');
    addCard(created.id);
  };

  const handleAIGenerate = async () => {
    if (!aiDraft.trim()) {
      setY2kAlert('先写点旅行日记嘛～');
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setY2kAlert('缺少 Gemini API Key，请检查 .env.local');
      return;
    }

    setAiGenerating(true);

    try {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: GEMINI_TRAVEL_SYSTEM_PROMPT }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: aiDraft.trim() }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error?.message || `AI 请求失败 (${response.status})`);
      }

      const payload = await response.json();
      const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('AI 未返回有效内容');
      }

      const resJson = JSON.parse(rawText);

      if (resJson?.error === 'NOT_TRAVEL_RELATED') {
        setY2kAlert('哎呀，这好像不是旅行足迹哦，AI 助手罢工啦！✨');
        return;
      }

      setForm((prev) => ({
        ...prev,
        city: resJson.city != null ? String(resJson.city) : '',
        date: resJson.date != null ? String(resJson.date) : '',
        note: resJson.travel_note != null ? String(resJson.travel_note) : '',
        lat: resJson.lat != null ? String(resJson.lat) : '',
        lng: resJson.lng != null ? String(resJson.lng) : '',
      }));
    } catch (error) {
      setY2kAlert(error?.message || 'AI 解析失败，请重试');
    } finally {
      setAiGenerating(false);
    }
  };

  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setY2kAlert('请选择图片文件喔～');
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        imageData: typeof reader.result === 'string' ? reader.result : '',
        imageName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const mapCenterSource = track === 'ALL' ? stars : filteredStars;

  const panelTitles = {
    footprint: 'ADD FOOTPRINT',
    auth: 'LOGIN / REGISTER',
    profile: 'MY PROFILE',
  };

  return (
    <div className="app-shell">
      <audio ref={audioRef} src={TRACK_URL} loop preload="auto" />

      <MapContainer
        center={[34.5, 128]}
        zoom={4}
        minZoom={4}
        maxZoom={4}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        boxZoom={false}
        dragging={true}
        className="map-canvas"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          className="map-tint"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />

        <MapClickGeocoder
          enabled={leftPanel === 'footprint'}
          onPick={handleMapPick}
        />

        <YearFlyTo items={mapCenterSource} track={track} />

        {stars.map((item) => {
          const isVisible = track === 'ALL' || item.year === track;
          return (
            <Marker
              key={item.id}
              position={[item.lat, item.lng]}
              icon={starIcon(!isVisible)}
              eventHandlers={{
                click: () => addCard(item.id),
              }}
            />
          );
        })}

        <AnimatePresence>
          <DraggableCards
            openCards={openCards}
            stars={stars}
            onDelete={requestDeleteStar}
            onClose={closeCard}
          />
        </AnimatePresence>
      </MapContainer>

      <AnimatePresence>
        {leftPanel && (
          <motion.div
            className="top-ui"
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 23 }}
          >
            <motion.div className="add-panel" layout>
              <div className="panel-head">
                <p>{panelTitles[leftPanel]}</p>
                <button type="button" onClick={closePanel}>
                  HIDE
                </button>
              </div>

              {leftPanel === 'footprint' && (
                <form onSubmit={handleAddStar} className="panel-form">
                  <div className="ai-draft-section">
                    <textarea
                      className="ai-draft-input"
                      value={aiDraft}
                      placeholder="请输入你的旅行日记，为你一键填入～"
                      rows={3}
                      disabled={aiGenerating}
                      onChange={(e) => setAiDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="ai-generate-btn"
                      disabled={aiGenerating}
                      onClick={handleAIGenerate}
                    >
                      {aiGenerating ? 'AI正在解析中...✨' : 'AI一键生成'}
                    </button>
                  </div>

                  <div className={`panel-fields ${aiGenerating ? 'panel-fields--loading' : ''}`}>
                    <input
                      className={aiGenerating ? 'field-skeleton' : ''}
                      value={form.city}
                      placeholder="City"
                      disabled={aiGenerating}
                      readOnly={aiGenerating}
                      onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                    <input
                      className={`${aiGenerating ? 'field-skeleton' : ''} ${dateInvalid ? 'date-input-invalid' : ''}`}
                      value={form.date}
                      placeholder="Date 例如：2026-06-10 或 2026"
                      disabled={aiGenerating}
                      readOnly={aiGenerating}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, date: e.target.value }));
                        if (dateInvalid) {
                          setDateError('');
                          setDateInvalid(false);
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          handleDateValidation(e.target.value);
                        }
                      }}
                    />
                    {dateError && <p className="date-error-text">{dateError}</p>}
                    <textarea
                      className={aiGenerating ? 'field-skeleton' : ''}
                      value={form.note}
                      placeholder="Travel note"
                      rows={2}
                      disabled={aiGenerating}
                      readOnly={aiGenerating}
                      onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                    />
                  </div>

                  <div className="image-picker-row">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="image-file-input"
                      onChange={handlePickImage}
                    />
                    <button
                      type="button"
                      className="image-picker-btn"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      选择图片
                    </button>
                    <p className="image-picker-name">
                      {form.imageName || '未选择图片（将使用默认图）'}
                    </p>
                  </div>
                  {form.imageData && (
                    <img className="image-preview" src={form.imageData} alt="Selected preview" />
                  )}
                  <div className={`coord-row ${aiGenerating ? 'panel-fields--loading' : ''}`}>
                    <input
                      className={aiGenerating ? 'field-skeleton' : ''}
                      value={form.lat}
                      placeholder="lat"
                      disabled={aiGenerating}
                      readOnly={aiGenerating}
                      onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))}
                    />
                    <input
                      className={aiGenerating ? 'field-skeleton' : ''}
                      value={form.lng}
                      placeholder="lng"
                      disabled={aiGenerating}
                      readOnly={aiGenerating}
                      onChange={(e) => setForm((prev) => ({ ...prev, lng: e.target.value }))}
                    />
                  </div>
                  <p className="coord-hint">点击地图直接生成经纬度💗</p>
                  <button
                    type="submit"
                    aria-disabled={!canSubmit && Boolean(user)}
                    className={!canSubmit && Boolean(user) ? 'disabled' : ''}
                    onClick={(e) => {
                      if (!user) {
                        e.preventDefault();
                        setY2kAlert('Please login first.');
                        return;
                      }
                      if (!canSubmit) {
                        e.preventDefault();
                        setY2kAlert('夜空已经装不下更多星星啦！请先摘下一颗旧的吧～✨🐰');
                        return;
                      }
                      if (form.city === '' || form.lat === '' || form.lng === '') {
                        e.preventDefault();
                        setY2kAlert('城市或坐标还是空的喔～点地图落点或让 AI 一键生成吧！🌟💗');
                        return;
                      }
                      if (!resolveDate(form.date)) {
                        e.preventDefault();
                        handleDateValidation(form.date);
                      }
                    }}
                  >
                    ADD STAR ({stars.length}/{MAX_STARS})
                  </button>
                </form>
              )}

              {leftPanel === 'auth' && (
                <LoginForm onAuthSuccess={() => openPanel('footprint')} />
              )}

              {leftPanel === 'profile' && user && (
                <ProfilePanel user={user} onSignOut={handleSignOut} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="plus-menu-anchor" ref={menuRef}>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className="plus-menu"
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              <button
                type="button"
                className="plus-menu-item"
                onClick={() => handleMenuSelect('footprint')}
              >
                <span className="plus-menu-glow" />
                ADD FOOTPRINT
              </button>
              <button
                type="button"
                className="plus-menu-item plus-menu-item--auth"
                onClick={() => handleMenuSelect('auth')}
              >
                <span className="plus-menu-glow" />
                {user ? 'MY PROFILE' : 'LOGIN / REGISTER'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          className={`map-plus-btn ${menuOpen ? 'map-plus-btn--open' : ''}`}
          whileTap={{ y: 3, scale: 0.96 }}
          onClick={handlePlusClick}
          aria-label="Open action menu"
          aria-expanded={menuOpen}
          title="Open menu"
        >
          {menuOpen ? '×' : '＋'}
        </motion.button>
      </div>

      <motion.div
        className="walkman"
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 170, damping: 20 }}
      >
        <div className="walkman-lcd">
          <p>{lcdFlash || `TRACK: ${track}`}</p>
          <p>TOTAL: {lcdCount} CITIES</p>
        </div>

        <div className="walkman-buttons">
          <motion.button whileTap={{ y: 3 }} type="button" onClick={() => cycleTrack(-1)}>
            PREV
          </motion.button>
          <motion.button whileTap={{ y: 3 }} type="button" onClick={handleTogglePlay}>
            {playing ? 'PAUSE' : 'PLAY'}
          </motion.button>
          <motion.button whileTap={{ y: 3 }} type="button" onClick={() => cycleTrack(1)}>
            NEXT
          </motion.button>
          <motion.button whileTap={{ y: 3 }} type="button" onClick={() => adjustVolume(0.1)}>
            VOL+
          </motion.button>
          <motion.button whileTap={{ y: 3 }} type="button" onClick={() => adjustVolume(-0.1)}>
            VOL-
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {y2kAlert && (
          <motion.div
            className="y2k-alert"
            initial={{ scale: 0.8, opacity: 0, y: -12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -12 }}
          >
            {y2kAlert}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDeleteId && (
          <motion.div
            className="confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="confirm-modal"
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
            >
              <p>确认删除该条足迹吗？</p>
              <div className="confirm-actions">
                <button type="button" onClick={confirmDeleteStar}>
                  是
                </button>
                <button type="button" onClick={cancelDeleteStar}>
                  否
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
