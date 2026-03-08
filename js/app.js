// ============================================================
// Mi Huerto - Diario de Huerto (Compartido)
// Partida Mariola, 26 - Alcoi (Alicante)
// Coordenadas aprox: 38.71°N, -0.47°W
// Huerto: 5m x 80m, orientación Suroeste
// ============================================================

const CONFIG = {
  lat: 38.71,
  lon: -0.47,
  gardenWidth: 5,
  gardenLength: 80,
  orientation: 'SO',
  location: 'Partida Mariola, 26 - Alcoi',
  crops: ['tomate', 'pimiento', 'calabacin', 'pepino'],
};

const API = '';  // Same origin; change to 'https://tudominio.com' if needed

// ============================================================
// API HELPERS
// ============================================================
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(API + '/api/upload', { method: 'POST', body: form });
  return res.json();
}

// ============================================================
// AUTHOR (para saber quién escribe)
// ============================================================
function getAuthor() {
  return localStorage.getItem('huerto_author') || '';
}

function setAuthor(name) {
  localStorage.setItem('huerto_author', name);
}

function showAuthorPicker() {
  const current = getAuthor();
  if (current) return; // Already set

  const overlay = document.getElementById('modal-author');
  overlay.classList.add('open');
}

function saveAuthor() {
  const name = document.getElementById('author-name').value.trim();
  if (!name) return;
  setAuthor(name);
  closeModal('modal-author');
  updateAuthorDisplay();
}

function updateAuthorDisplay() {
  const el = document.getElementById('current-author');
  if (el) el.textContent = getAuthor() || 'Anónimo';
}

// ============================================================
// NAVIGATION
// ============================================================
function switchSection(btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sectionId = btn.dataset.section;
  document.getElementById(sectionId).classList.add('active');
  btn.classList.add('active');

  const fab = document.getElementById('fab-add');
  fab.style.display = (sectionId === 'sec-diario' || sectionId === 'sec-inicio') ? 'flex' : 'none';
}

// ============================================================
// MODALS
// ============================================================
function openDiaryModal() {
  document.getElementById('diary-date').value = todayStr();
  document.getElementById('modal-diary').classList.add('open');
  document.getElementById('media-preview').innerHTML = '';
  document.querySelectorAll('.crop-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('diary-notes').value = '';
  pendingMedia = [];
}

function openTaskModal() {
  document.getElementById('task-date').value = todayStr();
  document.getElementById('modal-task').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ============================================================
// DIARY
// ============================================================
let pendingMedia = [];

function toggleCropChip(el) {
  el.classList.toggle('selected');
}

function previewMediaFile(input, type) {
  const preview = document.getElementById('media-preview');
  for (const file of input.files) {
    // Store actual File objects for upload
    pendingMedia.push({ type, file, name: file.name });

    // Show preview
    const url = URL.createObjectURL(file);
    if (type === 'image') {
      preview.innerHTML += `<img src="${url}" alt="foto">`;
    } else if (type === 'video') {
      preview.innerHTML += `<video src="${url}" controls></video>`;
    }
  }
}

// Audio recording
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

function toggleAudioRecording() {
  const btn = document.getElementById('btn-audio');
  if (!isRecording) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
        pendingMedia.push({ type: 'audio', file, name: 'audio.webm' });
        const preview = document.getElementById('media-preview');
        const url = URL.createObjectURL(blob);
        preview.innerHTML += `<audio src="${url}" controls></audio>`;
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      isRecording = true;
      btn.style.color = 'var(--tomato)';
      btn.style.borderColor = 'var(--tomato)';
    }).catch(() => alert('No se pudo acceder al micrófono'));
  } else {
    mediaRecorder.stop();
    isRecording = false;
    btn.style.color = '';
    btn.style.borderColor = '';
  }
}

async function saveDiaryEntry(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  try {
    // Upload media files first
    const mediaUrls = [];
    for (const m of pendingMedia) {
      const result = await uploadFile(m.file);
      if (result.ok) {
        mediaUrls.push({ type: result.type, url: result.url, name: result.name });
      }
    }

    const crops = [];
    document.querySelectorAll('#diary-crops .crop-chip.selected').forEach(c => crops.push(c.dataset.crop));

    await api('POST', '/api/diary', {
      date: document.getElementById('diary-date').value,
      type: document.getElementById('diary-type').value,
      crops,
      notes: document.getElementById('diary-notes').value,
      media: mediaUrls,
      author: getAuthor(),
    });

    closeModal('modal-diary');
    document.getElementById('form-diary').reset();
    await loadDiary();
    await loadUpcomingTasks();
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar Entrada';
  }
}

async function deleteDiaryEntry(id) {
  if (!confirm('¿Eliminar esta entrada?')) return;
  await api('DELETE', `/api/diary/${id}`);
  await loadDiary();
}

async function loadDiary() {
  try {
    const entries = await api('GET', '/api/diary');
    renderDiary(entries);
  } catch {
    document.getElementById('diary-list').innerHTML = '<p style="color:var(--text-light)">Error cargando el diario.</p>';
  }
}

function renderDiary(entries) {
  const container = document.getElementById('diary-list');

  if (!entries || entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        <p>No hay entradas aún.<br>Pulsa + para añadir la primera.</p>
      </div>`;
    return;
  }

  const typeLabels = {
    observacion: 'Observación', siembra: 'Siembra', semillero: 'Semillero',
    trasplante: 'Trasplante', riego: 'Riego', abonado: 'Abonado',
    tratamiento: 'Tratamiento', cosecha: 'Cosecha', labrar: 'Labrar',
    acolchado: 'Acolchado', poda: 'Poda', otro: 'Otro'
  };

  container.innerHTML = entries.map(entry => {
    const tagsHtml = (entry.crops || []).map(c =>
      `<span class="tag tag-${c}">${c}</span>`
    ).join('');

    const mediaHtml = (entry.media || []).map(m => {
      if (m.type === 'image') return `<img src="${m.url}" alt="foto" onclick="window.open(this.src)">`;
      if (m.type === 'video') return `<video src="${m.url}" controls></video>`;
      if (m.type === 'audio') return `<audio src="${m.url}" controls></audio>`;
      return '';
    }).join('');

    const authorHtml = entry.author ? `<span style="color:var(--green-mid);font-weight:600;">· ${escapeHtml(entry.author)}</span>` : '';

    return `
      <div class="card diary-entry">
        <div class="diary-date">${formatDate(entry.date)} · ${typeLabels[entry.type] || entry.type} ${authorHtml}</div>
        <div class="diary-text">${escapeHtml(entry.notes)}</div>
        <div class="diary-tags">${tagsHtml}</div>
        ${mediaHtml ? `<div class="diary-media">${mediaHtml}</div>` : ''}
        <div class="entry-actions">
          <button class="btn-danger" onclick="deleteDiaryEntry(${entry.id})">Eliminar</button>
        </div>
      </div>`;
  }).join('');
}

// ============================================================
// TASKS
// ============================================================
async function saveTask(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  try {
    await api('POST', '/api/tasks', {
      name: document.getElementById('task-name').value,
      date: document.getElementById('task-date').value,
      priority: document.getElementById('task-priority').value,
      category: document.getElementById('task-category').value,
      notes: document.getElementById('task-notes').value,
      author: getAuthor(),
    });

    closeModal('modal-task');
    document.getElementById('form-task').reset();
    await loadTasks();
    await loadUpcomingTasks();
  } catch (err) {
    alert('Error al guardar tarea: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar Tarea';
  }
}

async function toggleTask(id) {
  // Find current state from rendered data
  const tasks = window._cachedTasks || [];
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  await api('PATCH', `/api/tasks/${id}`, { done: !task.done });
  await loadTasks();
  await loadUpcomingTasks();
}

async function deleteTask(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  await api('DELETE', `/api/tasks/${id}`);
  await loadTasks();
  await loadUpcomingTasks();
}

async function loadTasks() {
  try {
    const tasks = await api('GET', '/api/tasks');
    window._cachedTasks = tasks;
    renderTasks(tasks);
  } catch {
    document.getElementById('task-list').innerHTML = '<p style="color:var(--text-light)">Error cargando tareas.</p>';
  }
}

function renderTasks(tasks) {
  const container = document.getElementById('task-list');

  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No hay tareas. Pulsa "+ Tarea" para crear una.</p></div>';
    return;
  }

  container.innerHTML = tasks.map(t => `
    <div class="card task-item ${t.done ? 'done' : ''}">
      <div class="task-check ${t.done ? 'done' : ''}" onclick="toggleTask(${t.id})">
        ${t.done ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </div>
      <div class="task-info">
        <div class="task-name">${escapeHtml(t.name)}</div>
        <div class="task-date">${formatDate(t.date)} · ${t.category}${t.author ? ' · ' + escapeHtml(t.author) : ''}</div>
        ${t.notes ? `<div style="font-size:0.75rem;color:var(--text-light);margin-top:2px;">${escapeHtml(t.notes)}</div>` : ''}
      </div>
      <span class="task-priority priority-${t.priority}">${t.priority}</span>
      <button class="btn-danger" onclick="deleteTask(${t.id})" style="margin-left:4px;">X</button>
    </div>
  `).join('');
}

async function loadUpcomingTasks() {
  try {
    const tasks = await api('GET', '/api/tasks');
    const pending = tasks.filter(t => !t.done).slice(0, 5);
    renderUpcomingTasks(pending);
  } catch {}
}

function renderUpcomingTasks(tasks) {
  const container = document.getElementById('upcoming-tasks');
  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light);">No hay tareas pendientes.</p>';
    return;
  }

  container.innerHTML = tasks.map(t => `
    <div class="task-item" style="border-bottom:1px solid #f0f0f0; padding:8px 0;">
      <div class="task-check ${t.done ? 'done' : ''}" onclick="toggleTask(${t.id})"></div>
      <div class="task-info">
        <div class="task-name" style="font-size:0.85rem;">${escapeHtml(t.name)}</div>
        <div class="task-date">${formatDate(t.date)}</div>
      </div>
      <span class="task-priority priority-${t.priority}">${t.priority}</span>
    </div>
  `).join('');
}

// ============================================================
// WEATHER (Open-Meteo - free, no API key)
// ============================================================
async function loadWeather() {
  try {
    const currentUrl = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&timezone=Europe/Madrid`;
    const currentRes = await fetch(currentUrl);
    const currentData = await currentRes.json();

    if (currentData.current) {
      const c = currentData.current;
      document.getElementById('weather-now').innerHTML = `
        <div class="weather-item"><div class="value">${c.temperature_2m}°C</div><div class="label">Temperatura</div></div>
        <div class="weather-item"><div class="value">${c.relative_humidity_2m}%</div><div class="label">Humedad</div></div>
        <div class="weather-item"><div class="value">${c.precipitation} mm</div><div class="label">Lluvia</div></div>
        <div class="weather-item"><div class="value">${c.wind_speed_10m} km/h</div><div class="label">Viento</div></div>
      `;

      // Save weather to backend
      api('POST', '/api/weather', {
        date: todayStr(),
        temp: c.temperature_2m,
        humidity: c.relative_humidity_2m,
        rain: c.precipitation,
        wind: c.wind_speed_10m,
        weather_code: c.weather_code,
      }).catch(() => {});
    }

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Europe/Madrid&forecast_days=7`;
    const forecastRes = await fetch(forecastUrl);
    const forecastData = await forecastRes.json();

    if (forecastData.daily) {
      const d = forecastData.daily;
      document.getElementById('weather-forecast').innerHTML = d.time.map((date, i) => `
        <div class="forecast-day">
          <div class="date">${formatDateShort(date)}</div>
          <div style="font-size:1.2rem;">${weatherIcon(d.weather_code[i])}</div>
          <div class="temp">${Math.round(d.temperature_2m_max[i])}°/${Math.round(d.temperature_2m_min[i])}°</div>
          <div style="font-size:0.65rem;color:var(--water);">${d.precipitation_sum[i]}mm</div>
        </div>
      `).join('');

      generateRecommendations(forecastData.daily, currentData.current);
    }
  } catch (err) {
    console.error('Error loading weather:', err);
    document.getElementById('weather-now').innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">Sin conexión. Datos meteorológicos no disponibles.</p>';
  }
}

async function loadWeatherHistory() {
  try {
    const end = todayStr();
    const start = dateOffset(-14);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_max&timezone=Europe/Madrid&start_date=${start}&end_date=${end}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.daily) {
      const d = data.daily;
      let html = `<table class="weather-history-table">
        <tr><th>Fecha</th><th>Max</th><th>Min</th><th>Lluvia</th><th>Humedad</th><th>Viento</th></tr>`;
      for (let i = 0; i < d.time.length; i++) {
        html += `<tr>
          <td>${formatDateShort(d.time[i])}</td>
          <td>${Math.round(d.temperature_2m_max[i])}°</td>
          <td>${Math.round(d.temperature_2m_min[i])}°</td>
          <td style="color:var(--water)">${d.precipitation_sum[i]}mm</td>
          <td>${d.relative_humidity_2m_mean ? Math.round(d.relative_humidity_2m_mean[i]) + '%' : '-'}</td>
          <td>${d.wind_speed_10m_max ? Math.round(d.wind_speed_10m_max[i]) : '-'} km/h</td>
        </tr>`;
      }
      html += '</table>';
      document.getElementById('weather-history').innerHTML = html;
    }
  } catch {
    document.getElementById('weather-history').innerHTML = '<p style="color:var(--text-light)">Error cargando historial.</p>';
  }
}

function weatherIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '🌤️';
}

// ============================================================
// RECOMMENDATIONS
// ============================================================
function generateRecommendations(forecast, current) {
  const recos = [];
  const today = new Date();
  const month = today.getMonth() + 1;

  const minTemps = forecast.temperature_2m_min || [];
  const maxTemps = forecast.temperature_2m_max || [];
  const hasFreeze = minTemps.some(t => t < 2);
  const hasCold = minTemps.some(t => t < 8);
  const totalRain = (forecast.precipitation_sum || []).reduce((a, b) => a + b, 0);

  if (hasFreeze) {
    recos.push('⚠️ <b>Alerta de helada</b> en los próximos días. Protege los semilleros y las plántulas con mantas térmicas o plástico.');
  }

  if (hasCold && month <= 4) {
    recos.push('🌡️ Las noches son frescas. Los semilleros de tomate y pimiento deben estar en interior o con protección hasta que las mínimas superen los 10°C.');
  }

  if (totalRain > 20) {
    recos.push('🌧️ Se esperan lluvias abundantes (' + Math.round(totalRain) + 'mm). Aplaza el labrado y asegúrate de que el drenaje del huerto funciona. No riegues estos días.');
  } else if (totalRain < 2) {
    recos.push('☀️ Semana seca. Planifica riego regular. En esta zona de Alcoi, con orientación SO, la evaporación es alta por la tarde.');
  }

  if (month === 3) {
    recos.push('🌱 <b>Marzo</b>: Buen momento para semilleros de tomate y pimiento en interior. Los calabacines y pepinos pueden esperar a abril.');
    recos.push('🪱 Prepara la tierra: labra a 30cm de profundidad y añade materia orgánica (compost, estiércol bien curado).');
  } else if (month === 4) {
    recos.push('🌱 <b>Abril</b>: Semilleros de calabacín y pepino. Trasplante de tomates si las noches superan 10°C.');
  } else if (month === 5) {
    recos.push('🌱 <b>Mayo</b>: Trasplante general al huerto. Instala riego por goteo y acolchado.');
  }

  recos.push('☀️ <b>Orientación SO</b>: Tu huerto recibe sol intenso por la tarde. Ideal para tomates y pimientos. Pepinos y calabacines pueden necesitar sombra en julio-agosto.');

  document.getElementById('recommendations').innerHTML = recos.map(r => `<p style="margin-bottom:8px;">${r}</p>`).join('');
}

// ============================================================
// GARDEN PLANNER
// ============================================================
function renderGardenLayout() {
  const layout = [
    { bancal: 'Bancal A (norte)', sections: [
      { crop: 'tomate', label: 'Tomates (20m)' },
      { crop: 'pimiento', label: 'Pimientos (20m)' },
      { crop: 'calabacin', label: 'Calabacines (20m)' },
      { crop: 'pepino', label: 'Pepinos (20m)' },
    ]},
    { bancal: 'Bancal B (sur)', sections: [
      { crop: 'pimiento', label: 'Pimientos (20m)' },
      { crop: 'tomate', label: 'Tomates (20m)' },
      { crop: 'pepino', label: 'Pepinos (20m)' },
      { crop: 'calabacin', label: 'Calabacines (20m)' },
    ]},
  ];

  const container = document.getElementById('garden-layout');
  let html = '<div class="garden-canvas">';
  html += '<div style="text-align:center;padding:6px;font-size:0.7rem;color:var(--earth);font-weight:600;">← 80 metros →</div>';

  layout.forEach(b => {
    html += `<div class="bancal-row">
      <div class="bancal-label">${b.bancal}</div>
      <div class="bancal-crops">
        ${b.sections.map(s => `<div class="crop-block crop-${s.crop}" style="flex:1;text-align:center;">${s.label}</div>`).join('')}
      </div>
    </div>`;
  });

  html += '<div style="text-align:center;padding:4px;font-size:0.6rem;color:var(--earth);">Pasillo central 0.5m | Bancales 1.2m ancho | Pasillos laterales 0.5m</div>';
  html += '</div>';
  container.innerHTML = html;

  document.getElementById('planting-advice').innerHTML = `
    <p style="margin-bottom:8px;"><b>Distribución en bancal elevado (1.2m ancho):</b></p>
    <p style="margin-bottom:6px;">🍅 <b>Tomates:</b> 2 filas, plantas a 50cm. Con 40m totales: ~160 plantas. Necesitan tutores de 1.5m.</p>
    <p style="margin-bottom:6px;">🫑 <b>Pimientos:</b> 2-3 filas, plantas a 40cm. Con 40m totales: ~200 plantas.</p>
    <p style="margin-bottom:6px;">🥒 <b>Pepinos:</b> 1 fila con espaldera, plantas a 40cm. Con 40m: ~100 plantas.</p>
    <p style="margin-bottom:6px;">🥬 <b>Calabacines:</b> 1 fila, plantas a 80cm. Con 40m: ~50 plantas.</p>
    <p style="margin-top:12px;"><b>Asociaciones favorables:</b></p>
    <p style="margin-bottom:4px;">✅ Tomate + Pimiento: se llevan bien (misma familia, rotar al año siguiente)</p>
    <p style="margin-bottom:4px;">✅ Calabacín + Pepino: ambos cucurbitáceas, buena asociación con distancia</p>
    <p style="margin-bottom:4px;">✅ Intercala albahaca entre tomates (repele plagas)</p>
    <p style="margin-top:8px;font-style:italic;color:var(--text-light);">El próximo año rota: donde había solanáceas (tomate/pimiento) pon cucurbitáceas y viceversa.</p>
  `;
}

// ============================================================
// UTILITIES
// ============================================================
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ============================================================
// INIT
// ============================================================
async function init() {
  showAuthorPicker();
  updateAuthorDisplay();
  renderGardenLayout();

  // Load data from server
  await Promise.all([
    loadDiary(),
    loadTasks(),
    loadUpcomingTasks(),
    loadWeather(),
    loadWeatherHistory(),
  ]);
}

document.addEventListener('DOMContentLoaded', init);
