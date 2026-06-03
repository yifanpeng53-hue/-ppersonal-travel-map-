import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const STORAGE_KEY = 'yifan-y2k-travel-stars';
const TRACKS = ['ALL', '2024', '2025', '2026'];
const MAX_STARS = 100;
const TRACK_URL = '/music/howsweet.mp3';

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
  const [formOpen, setFormOpen] = useState(true);
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
  const audioRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stars));
  }, [stars]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

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

  const removeStar = (id) => {
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

  const canSubmit = stars.length < MAX_STARS;

  const handleAddStar = (e) => {
    e.preventDefault();
    if (!canSubmit) {
      setY2kAlert('夜空已经装不下更多星星啦！请先摘下一颗旧的吧～✨🐰');
      return;
    }

    if (!form.city || !form.date || !form.lat || !form.lng) {
      setY2kAlert('请把城市、日期和坐标填完整喔～');
      return;
    }

    const year = form.date.slice(0, 4);
    const item = {
      id: `${form.city.toLowerCase()}-${Date.now()}`,
      city: form.city,
      date: form.date,
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

    setStars((prev) => [...prev, item]);
    setForm({ city: '', date: '', note: '', imageData: '', imageName: '', lat: '', lng: '' });
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setTrack(year && TRACKS.includes(year) ? year : 'ALL');
    addCard(item.id);
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
          enabled={formOpen}
          onPick={({ lat, lng }) => {
            setForm((prev) => ({
              ...prev,
              lat: lat.toFixed(4),
              lng: lng.toFixed(4),
            }));
          }}
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

      <div className="top-ui">
        <motion.div
          className="add-panel"
          animate={{ y: formOpen ? 0 : -220, opacity: formOpen ? 1 : 0.6 }}
          transition={{ type: 'spring', stiffness: 240, damping: 23 }}
        >
          <div className="panel-head">
            <p>ADD FOOTPRINT</p>
            <button type="button" onClick={() => setFormOpen((v) => !v)}>
              {formOpen ? 'HIDE' : 'SHOW'}
            </button>
          </div>
          {formOpen && (
            <form onSubmit={handleAddStar} className="panel-form">
              <input
                value={form.city}
                placeholder="City"
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              />
              <input
                value={form.date}
                placeholder="YYYY.MM.DD"
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              />
              <textarea
                value={form.note}
                placeholder="Travel note"
                rows={2}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              />
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
              {form.imageData && <img className="image-preview" src={form.imageData} alt="Selected preview" />}
              <div className="coord-row">
                <input
                  value={form.lat}
                  placeholder="lat"
                  onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))}
                />
                <input
                  value={form.lng}
                  placeholder="lng"
                  onChange={(e) => setForm((prev) => ({ ...prev, lng: e.target.value }))}
                />
              </div>
              <p className="coord-hint">点击地图直接生成经纬度💗</p>
              <button
                type="submit"
                aria-disabled={!canSubmit}
                className={!canSubmit ? 'disabled' : ''}
                onClick={(e) => {
                  if (!canSubmit) {
                    e.preventDefault();
                    setY2kAlert('夜空已经装不下更多星星啦！请先摘下一颗旧的吧～✨🐰');
                  }
                }}
              >
                ADD STAR ({stars.length}/{MAX_STARS})
              </button>
            </form>
          )}
        </motion.div>
      </div>

      <motion.button
        type="button"
        className="map-plus-btn"
        whileTap={{ y: 3, scale: 0.96 }}
        onClick={() => setFormOpen(true)}
        aria-label="Open add star panel"
        title="Open add panel"
      >
        ＋
      </motion.button>

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
