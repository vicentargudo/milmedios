// ============================================================
// Mi Huerto - Diario de Huerto
// Partida Mariola, 26 - Alcoi (Alicante)
// Coordenadas aprox: 38.71°N, -0.47°W
// Huerto: 5m x 80m, orientación Suroeste
// ============================================================

const CONFIG = {
  lat: 38.71,
  lon: -0.47,
  gardenWidth: 5,    // metros
  gardenLength: 80,  // metros
  orientation: 'SO',
  location: 'Partida Mariola, 26 - Alcoi',
  crops: ['tomate', 'pimiento', 'calabacin', 'pepino'],
};

// ============================================================
// LOCAL STORAGE (IndexedDB wrapper using localStorage for simplicity)
// ============================================================
const DB = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem('huerto_' + key)) || [];
    } catch { return []; }
  },
  set(key, data) {
    localStorage.setItem('huerto_' + key, JSON.stringify(data));
  },
  getObj(key) {
    try {
      return JSON.parse(localStorage.getItem('huerto_' + key)) || {};
    } catch { return {}; }
  },
  setObj(key, data) {
    localStorage.setItem('huerto_' + key, JSON.stringify(data));
  }
};

// ============================================================
// NAVIGATION
// ============================================================
function switchSection(btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sectionId = btn.dataset.section;
  document.getElementById(sectionId).classList.add('active');
  btn.classList.add('active');

  // Show FAB only on diary
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

// Close modal on overlay click
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

function previewMedia(input, type) {
  const preview = document.getElementById('media-preview');
  for (const file of input.files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      pendingMedia.push({ type, data: dataUrl, name: file.name });
      if (type === 'image') {
        preview.innerHTML += `<img src="${dataUrl}" alt="foto">`;
      } else if (type === 'video') {
        preview.innerHTML += `<video src="${dataUrl}" controls></video>`;
      }
    };
    reader.readAsDataURL(file);
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
        const reader = new FileReader();
        reader.onload = (e) => {
          pendingMedia.push({ type: 'audio', data: e.target.result, name: 'audio.webm' });
          const preview = document.getElementById('media-preview');
          preview.innerHTML += `<audio src="${e.target.result}" controls></audio>`;
        };
        reader.readAsDataURL(blob);
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

function saveDiaryEntry(e) {
  e.preventDefault();
  const crops = [];
  document.querySelectorAll('#diary-crops .crop-chip.selected').forEach(c => crops.push(c.dataset.crop));

  const entry = {
    id: Date.now(),
    date: document.getElementById('diary-date').value,
    type: document.getElementById('diary-type').value,
    crops: crops,
    notes: document.getElementById('diary-notes').value,
    media: pendingMedia.slice(),
  };

  const entries = DB.get('diary');
  entries.unshift(entry);
  DB.set('diary', entries);

  closeModal('modal-diary');
  document.getElementById('form-diary').reset();
  renderDiary();
  renderUpcomingTasks();
}

function deleteDiaryEntry(id) {
  if (!confirm('¿Eliminar esta entrada?')) return;
  const entries = DB.get('diary').filter(e => e.id !== id);
  DB.set('diary', entries);
  renderDiary();
}

function renderDiary() {
  const entries = DB.get('diary');
  const container = document.getElementById('diary-list');

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        <p>No hay entradas aún.<br>Pulsa + para añadir la primera.</p>
      </div>`;
    return;
  }

  container.innerHTML = entries.map(entry => {
    const tagsHtml = (entry.crops || []).map(c =>
      `<span class="tag tag-${c}">${c}</span>`
    ).join('');

    const mediaHtml = (entry.media || []).map(m => {
      if (m.type === 'image') return `<img src="${m.data}" alt="foto" onclick="window.open(this.src)">`;
      if (m.type === 'video') return `<video src="${m.data}" controls></video>`;
      if (m.type === 'audio') return `<audio src="${m.data}" controls></audio>`;
      return '';
    }).join('');

    const typeLabels = {
      observacion: 'Observación', siembra: 'Siembra', semillero: 'Semillero',
      trasplante: 'Trasplante', riego: 'Riego', abonado: 'Abonado',
      tratamiento: 'Tratamiento', cosecha: 'Cosecha', labrar: 'Labrar',
      acolchado: 'Acolchado', poda: 'Poda', otro: 'Otro'
    };

    return `
      <div class="card diary-entry">
        <div class="diary-date">${formatDate(entry.date)} &middot; ${typeLabels[entry.type] || entry.type}</div>
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
function saveTask(e) {
  e.preventDefault();
  const task = {
    id: Date.now(),
    name: document.getElementById('task-name').value,
    date: document.getElementById('task-date').value,
    priority: document.getElementById('task-priority').value,
    category: document.getElementById('task-category').value,
    notes: document.getElementById('task-notes').value,
    done: false,
  };

  const tasks = DB.get('tasks');
  tasks.push(task);
  DB.set('tasks', tasks);

  closeModal('modal-task');
  document.getElementById('form-task').reset();
  renderTasks();
  renderUpcomingTasks();
}

function toggleTask(id) {
  const tasks = DB.get('tasks');
  const task = tasks.find(t => t.id === id);
  if (task) task.done = !task.done;
  DB.set('tasks', tasks);
  renderTasks();
  renderUpcomingTasks();
}

function deleteTask(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  const tasks = DB.get('tasks').filter(t => t.id !== id);
  DB.set('tasks', tasks);
  renderTasks();
  renderUpcomingTasks();
}

function renderTasks() {
  const tasks = DB.get('tasks').sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.date.localeCompare(b.date);
  });
  const container = document.getElementById('task-list');

  if (tasks.length === 0) {
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
        <div class="task-date">${formatDate(t.date)} &middot; ${t.category}</div>
        ${t.notes ? `<div style="font-size:0.75rem;color:var(--text-light);margin-top:2px;">${escapeHtml(t.notes)}</div>` : ''}
      </div>
      <span class="task-priority priority-${t.priority}">${t.priority}</span>
      <button class="btn-danger" onclick="deleteTask(${t.id})" style="margin-left:4px;">X</button>
    </div>
  `).join('');
}

function renderUpcomingTasks() {
  const tasks = DB.get('tasks')
    .filter(t => !t.done)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const container = document.getElementById('upcoming-tasks');
  if (tasks.length === 0) {
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
    // Current weather
    const currentUrl = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&timezone=Europe/Madrid`;
    const currentRes = await fetch(currentUrl);
    const currentData = await currentRes.json();

    if (currentData.current) {
      const c = currentData.current;
      const weatherNow = document.getElementById('weather-now');
      weatherNow.innerHTML = `
        <div class="weather-item"><div class="value">${c.temperature_2m}°C</div><div class="label">Temperatura</div></div>
        <div class="weather-item"><div class="value">${c.relative_humidity_2m}%</div><div class="label">Humedad</div></div>
        <div class="weather-item"><div class="value">${c.precipitation} mm</div><div class="label">Lluvia</div></div>
        <div class="weather-item"><div class="value">${c.wind_speed_10m} km/h</div><div class="label">Viento</div></div>
      `;

      // Save to history
      saveWeatherHistory(c);
    }

    // 7-day forecast
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Europe/Madrid&forecast_days=7`;
    const forecastRes = await fetch(forecastUrl);
    const forecastData = await forecastRes.json();

    if (forecastData.daily) {
      const d = forecastData.daily;
      const forecastContainer = document.getElementById('weather-forecast');
      forecastContainer.innerHTML = d.time.map((date, i) => `
        <div class="forecast-day">
          <div class="date">${formatDateShort(date)}</div>
          <div style="font-size:1.2rem;">${weatherIcon(d.weather_code[i])}</div>
          <div class="temp">${Math.round(d.temperature_2m_max[i])}°/${Math.round(d.temperature_2m_min[i])}°</div>
          <div style="font-size:0.65rem;color:var(--water);">${d.precipitation_sum[i]}mm</div>
        </div>
      `).join('');

      // Generate recommendations based on forecast
      generateRecommendations(forecastData.daily, currentData.current);
    }
  } catch (err) {
    console.error('Error loading weather:', err);
    document.getElementById('weather-now').innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">Sin conexión. Datos meteorológicos no disponibles.</p>';
  }
}

function saveWeatherHistory(current) {
  const history = DB.get('weather_history');
  const today = todayStr();
  const existing = history.find(h => h.date === today);
  if (!existing) {
    history.push({
      date: today,
      temp: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      rain: current.precipitation,
      wind: current.wind_speed_10m,
    });
    // Keep last 90 days
    if (history.length > 90) history.shift();
    DB.set('weather_history', history);
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
  } catch (err) {
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
  const month = today.getMonth() + 1; // 1-12

  // Temperature-based
  const minTemps = forecast.temperature_2m_min || [];
  const maxTemps = forecast.temperature_2m_max || [];
  const hasFreeze = minTemps.some(t => t < 2);
  const hasCold = minTemps.some(t => t < 8);
  const hasHeat = maxTemps.some(t => t > 30);
  const totalRain = (forecast.precipitation_sum || []).reduce((a, b) => a + b, 0);

  if (hasFreeze) {
    recos.push('⚠️ <b>Alerta de helada</b> en los próximos días. Protege los semilleros y las plántulas con mantas térmicas o plástico.');
  }

  if (hasCold && month <= 4) {
    recos.push('🌡️ Las noches son frescas. Los semilleros de tomate y pimiento deben estar en interior o con protección hasta que las mínimas superen los 10°C.');
  }

  // Rain-based
  if (totalRain > 20) {
    recos.push('🌧️ Se esperan lluvias abundantes (' + Math.round(totalRain) + 'mm). Aplaza el labrado y asegúrate de que el drenaje del huerto funciona. No riegues estos días.');
  } else if (totalRain < 2) {
    recos.push('☀️ Semana seca. Planifica riego regular. En esta zona de Alcoi, con orientación SO, la evaporación es alta por la tarde.');
  }

  // Season-based planting advice
  if (month === 3) {
    recos.push('🌱 <b>Marzo</b>: Buen momento para semilleros de tomate y pimiento en interior. Los calabacines y pepinos pueden esperar a abril. Tienes tiempo para preparar la tierra: labrar, añadir compost y planificar los bancales.');
    recos.push('🪱 Prepara la tierra: labra a 30cm de profundidad y añade materia orgánica (compost, estiércol bien curado). El acolchado se pondrá después del trasplante.');
  } else if (month === 4) {
    recos.push('🌱 <b>Abril</b>: Semilleros de calabacín y pepino. Trasplante de tomates si las noches superan 10°C. Prepara los tutores para los tomates.');
  } else if (month === 5) {
    recos.push('🌱 <b>Mayo</b>: Trasplante general al huerto. Instala riego por goteo y acolchado (paja o cartón). Cuidado con las últimas heladas tardías en la Mariola.');
  }

  // Orientation specific
  recos.push('☀️ <b>Orientación SO</b>: Tu huerto recibe sol intenso por la tarde. Los tomates y pimientos agradecerán este sol. Los pepinos y calabacines pueden necesitar algo de sombra en julio-agosto.');

  const el = document.getElementById('recommendations');
  el.innerHTML = recos.map(r => `<p style="margin-bottom:8px;">${r}</p>`).join('');
}

// ============================================================
// GARDEN PLANNER
// ============================================================
function renderGardenLayout() {
  // 5m wide x 80m long
  // Bancales de 1.2m ancho + 0.5m pasillo = 1.7m por unidad
  // En 5m de ancho: 2 bancales + pasillos laterales (5 / 1.7 ≈ 2.9 → 2 bancales)
  // Longitud: 80m divididos en secciones de 10m = 8 secciones por bancal
  // Total: 2 bancales x 8 secciones = 16 parcelas

  const layout = [
    { bancal: 'Bancal A (norte)', sections: [
      { crop: 'tomate', length: '20m', label: 'Tomates (20m)' },
      { crop: 'pimiento', length: '20m', label: 'Pimientos (20m)' },
      { crop: 'calabacin', length: '20m', label: 'Calabacines (20m)' },
      { crop: 'pepino', length: '20m', label: 'Pepinos (20m)' },
    ]},
    { bancal: 'Bancal B (sur)', sections: [
      { crop: 'pimiento', length: '20m', label: 'Pimientos (20m)' },
      { crop: 'tomate', length: '20m', label: 'Tomates (20m)' },
      { crop: 'pepino', length: '20m', label: 'Pepinos (20m)' },
      { crop: 'calabacin', length: '20m', label: 'Calabacines (20m)' },
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

  // Planting advice
  document.getElementById('planting-advice').innerHTML = `
    <p style="margin-bottom:8px;"><b>Distribución en bancal elevado (1.2m ancho):</b></p>
    <p style="margin-bottom:6px;">🍅 <b>Tomates:</b> 2 filas, plantas a 50cm. Con 40m totales (2 bancales × 20m): ~160 plantas. Necesitan tutores de 1.5m.</p>
    <p style="margin-bottom:6px;">🫑 <b>Pimientos:</b> 2-3 filas, plantas a 40cm. Con 40m totales: ~200 plantas.</p>
    <p style="margin-bottom:6px;">🥒 <b>Pepinos:</b> 1 fila con espaldera, plantas a 40cm. Con 40m: ~100 plantas. Trepar les ahorra espacio.</p>
    <p style="margin-bottom:6px;">🥬 <b>Calabacines:</b> 1 fila, plantas a 80cm (son grandes). Con 40m: ~50 plantas. No necesitan mucho, crecen solos.</p>
    <p style="margin-top:12px;"><b>Asociaciones favorables:</b></p>
    <p style="margin-bottom:4px;">✅ Tomate + Pimiento: se llevan bien (misma familia, pero rotar al año siguiente)</p>
    <p style="margin-bottom:4px;">✅ Calabacín + Pepino: ambos cucurbitáceas, buena asociación pero con distancia</p>
    <p style="margin-bottom:4px;">✅ Intercala albahaca entre tomates (repele plagas)</p>
    <p style="margin-top:8px;font-style:italic;color:var(--text-light);">El próximo año rota: donde había solanáceas (tomate/pimiento) pon cucurbitáceas (pepino/calabacín) y viceversa.</p>
  `;
}

// ============================================================
// INITIAL DEFAULT TASKS (seeds for the calendar)
// ============================================================
function seedDefaultTasks() {
  if (DB.getObj('seeded').done) return;

  const year = new Date().getFullYear();
  const defaults = [
    { name: 'Labrar el huerto (30cm profundidad)', date: `${year}-03-15`, priority: 'alta', category: 'labrar', notes: 'Labrar toda la parcela, retirar piedras y malas hierbas.' },
    { name: 'Añadir compost/estiércol', date: `${year}-03-16`, priority: 'alta', category: 'abonado', notes: 'Mezclar compost maduro o estiércol bien curado con la tierra.' },
    { name: 'Preparar bancales', date: `${year}-03-20`, priority: 'alta', category: 'otro', notes: 'Marcar bancales de 1.2m ancho y pasillos de 0.5m.' },
    { name: 'Semillero de pimientos', date: `${year}-03-10`, priority: 'alta', category: 'semillero', notes: 'En interior o invernadero, temperatura 20-25°C. Tardan en germinar (10-20 días).' },
    { name: 'Semillero de calabacines', date: `${year}-04-01`, priority: 'media', category: 'semillero', notes: 'En macetas individuales, temperatura 20°C mínimo.' },
    { name: 'Semillero de pepinos', date: `${year}-04-01`, priority: 'media', category: 'semillero', notes: 'Similar a calabacín. Ambiente cálido y húmedo.' },
    { name: 'Instalar riego por goteo', date: `${year}-04-15`, priority: 'alta', category: 'riego', notes: 'Tender mangueras de goteo en ambos bancales. Programador con 2 riegos/día en verano.' },
    { name: 'Trasplantar tomates al huerto', date: `${year}-05-01`, priority: 'alta', category: 'trasplante', notes: 'Cuando tengan 15-20cm y las noches >10°C. Enterrar hasta las primeras hojas.' },
    { name: 'Trasplantar pimientos', date: `${year}-05-01`, priority: 'alta', category: 'trasplante', notes: 'Similar a tomates pero no enterrar el tallo.' },
    { name: 'Trasplantar calabacines y pepinos', date: `${year}-05-10`, priority: 'media', category: 'trasplante', notes: 'Cuando hayan pasado las últimas heladas. Dejar espacio suficiente.' },
    { name: 'Acolchado (mulch) en bancales', date: `${year}-05-15`, priority: 'media', category: 'acolchado', notes: 'Paja, cartón o corteza. Retiene humedad, evita malas hierbas, protege raíces.' },
    { name: 'Colocar tutores para tomates', date: `${year}-05-10`, priority: 'alta', category: 'otro', notes: 'Cañas o estacas de 1.5m. Atar con hilo de rafia sin apretar.' },
    { name: 'Instalar espalderas para pepinos', date: `${year}-05-10`, priority: 'media', category: 'otro', notes: 'Red o cañas para que trepen. Ahorra espacio y mejora la ventilación.' },
    { name: 'Primera poda de tomates (chupones)', date: `${year}-06-01`, priority: 'media', category: 'poda', notes: 'Eliminar brotes axilares semanalmente. Dejar 1-2 tallos principales.' },
    { name: 'Revisión de plagas y enfermedades', date: `${year}-06-15`, priority: 'media', category: 'tratamiento', notes: 'Buscar pulgón, mosca blanca, araña roja. Tratamiento ecológico: jabón potásico.' },
  ];

  const tasks = DB.get('tasks');
  defaults.forEach(d => {
    tasks.push({
      id: Date.now() + Math.random() * 1000,
      ...d,
      done: false,
    });
  });
  DB.set('tasks', tasks);
  DB.setObj('seeded', { done: true });
}

// Seed initial diary entry for today's tomato seedbed
function seedInitialDiary() {
  if (DB.getObj('diary_seeded').done) return;

  const entries = DB.get('diary');
  entries.unshift({
    id: Date.now(),
    date: '2026-03-08',
    type: 'semillero',
    crops: ['tomate'],
    notes: 'Hoy hice el semillero de tomate. Primer paso de la temporada.',
    media: [],
  });
  DB.set('diary', entries);
  DB.setObj('diary_seeded', { done: true });
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
// SERVICE WORKER REGISTRATION
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ============================================================
// INIT
// ============================================================
function init() {
  seedDefaultTasks();
  seedInitialDiary();
  renderDiary();
  renderTasks();
  renderGardenLayout();
  renderUpcomingTasks();
  loadWeather();
  loadWeatherHistory();
}

document.addEventListener('DOMContentLoaded', init);
